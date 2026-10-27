import { useRef, useState } from "react";
import type { AssetType, InitiateUploadRequest, UploadSession } from "@/lib/allium/asset-manager";
import { CheckCircle2, FileBox, Upload, XCircle } from "lucide-react";
import { assetManager, getPluginTags } from "@/lib/allium/asset-manager";
import { logEvent } from "@/lib/allium/event-log";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

// GCS multipart parts must be at least 5 MiB (except the final part). 8 MiB keeps
// part counts reasonable while staying comfortably above that floor.
const CHUNK_SIZE = 8 * 1024 * 1024;
const CONCURRENCY = 4;

type Phase = "form" | "uploading" | "done" | "error";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  userId: string;
  initialFile?: File | null;
  onUploaded: () => void;
}

// Run an async worker over items with bounded concurrency.
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

const MODEL_EXTENSIONS = [".glb", ".gltf", ".fbx", ".obj", ".usd", ".usdz", ".ifc", ".rvt", ".dwg"];

// Default the asset type from the file name; the user can still switch it.
function guessAssetType(filename: string): AssetType {
  const name = filename.toLowerCase();
  return MODEL_EXTENSIONS.some((ext) => name.endsWith(ext)) ? "OTHER_3D" : "UNREAL_PROJECT";
}

function formatSize(bytes: number): string {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function stripQuotes(etag: string): string {
  return etag.replace(/^"|"$/g, "");
}

export default function UploadDialog({
  open,
  onOpenChange,
  orgId,
  userId,
  initialFile = null,
  onUploaded,
}: UploadDialogProps) {
  const [assetType, setAssetType] = useState<AssetType>(() =>
    initialFile ? guessAssetType(initialFile.name) : "UNREAL_PROJECT",
  );
  const [displayName, setDisplayName] = useState("");
  const [file, setFile] = useState<File | null>(initialFile);

  const [phase, setPhase] = useState<Phase>("form");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Keep the active session so a cancel can abort it in GCS.
  const sessionRef = useRef<UploadSession | null>(null);

  const reset = () => {
    setAssetType("UNREAL_PROJECT");
    setDisplayName("");
    setFile(null);
    setPhase("form");
    setProgress({ done: 0, total: 0 });
    setStatusText("");
    setError(null);
    sessionRef.current = null;
  };

  const handleOpenChange = (next: boolean) => {
    if (phase === "uploading") return; // don't allow closing mid-upload
    if (!next) reset();
    onOpenChange(next);
  };

  // PUT a single chunk to its signed GCS URL and return the ETag GCS assigns it.
  const putPart = async (partNumber: number, url: string): Promise<string> => {
    const start = (partNumber - 1) * CHUNK_SIZE;
    const blob = file!.slice(start, Math.min(start + CHUNK_SIZE, file!.size));
    const res = await fetch(url, { method: "PUT", body: blob });
    if (!res.ok) throw new Error(`Part ${partNumber} failed (HTTP ${res.status})`);
    const etag = res.headers.get("etag") ?? res.headers.get("ETag");
    if (!etag) {
      throw new Error(
        `Part ${partNumber}: no ETag returned. The GCS bucket must expose the ETag header via CORS.`,
      );
    }
    return stripQuotes(etag);
  };

  const startUpload = async () => {
    if (!file) return;
    setPhase("uploading");
    setError(null);

    try {
      // 1. Initiate a fresh upload.
      setStatusText("Preparing upload...");
      const finalName = displayName.trim() || file.name.replace(/\.[^.]+$/, "");
      // Unreal projects are always Multiplayer builds: the plugin tag is the first one Asset
      // Manager lists, so the user picks nothing.
      let pluginVersionTag: string | undefined;
      if (assetType === "UNREAL_PROJECT") {
        if (!/\.zip$/i.test(file.name)) throw new Error("An Unreal project must be a .zip file.");
        pluginVersionTag = (await getPluginTags())[0]?.versionTag;
        if (!pluginVersionTag) throw new Error("No plugin version is available for builds yet.");
      }
      // Asset Manager takes the plugin tag; the SDK sends the request body as is.
      const initiateData: InitiateUploadRequest & {
        pluginVersionTag?: string;
      } = {
        orgId,
        userId,
        assetType,
        assetFilename: file.name,
        assetDisplayName: finalName,
        ...(assetType === "UNREAL_PROJECT"
          ? {
              unrealProjectDisplayName: finalName,
              selfPackaged: false,
              pluginVersionTag,
            }
          : { other_3dDisplayName: finalName }),
      };
      const initiated = await assetManager.upload.initiate(initiateData);
      const session: UploadSession = {
        orgId: initiated.orgId,
        projectId: initiated.projectId,
        assetId: initiated.assetId,
        assetVersionId: initiated.assetVersionId,
        uploadId: initiated.uploadId,
        objectName: initiated.objectName,
      };
      sessionRef.current = session;

      // 2. Every part needs uploading.
      const totalParts = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
      const parts = new Map<number, string>();

      setProgress({ done: 0, total: totalParts });

      // 3. Batch-fetch signed URLs for every part.
      setStatusText(`Uploading ${totalParts} part(s)...`);
      const signedUrls = await assetManager.upload.batchGetSignedUrls(
        session.orgId,
        session.assetId,
        session.assetVersionId,
        session.uploadId,
        session.objectName,
        partNumbers,
      );

      // 4. PUT each chunk directly to GCS with bounded parallelism. On failure,
      //    pull the session and retry once with a fresh signed URL for that part.
      await runPool(partNumbers, CONCURRENCY, async (partNumber) => {
        try {
          const etag = await putPart(partNumber, signedUrls[partNumber]);
          parts.set(partNumber, etag);
        } catch {
          logEvent(`upload.part ${partNumber} retry`, false);
          const current = (await assetManager.upload.getSession(file.name)) ?? session;
          sessionRef.current = current;
          const freshUrl = await assetManager.upload.getSignedUrl(
            current.orgId,
            current.assetId,
            current.assetVersionId,
            current.uploadId,
            current.objectName,
            partNumber,
          );
          const etag = await putPart(partNumber, freshUrl);
          parts.set(partNumber, etag);
        }
        setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
      });
      logEvent(`upload.parts ${totalParts}/${totalParts}`);

      // 5. Assemble the object and mark the asset as uploaded.
      setStatusText("Finalizing...");
      const orderedParts = Array.from(parts.entries())
        .map(([partNumber, etag]) => ({ partNumber, etag }))
        .sort((a, b) => a.partNumber - b.partNumber);

      await assetManager.upload.complete({
        orgId: session.orgId,
        assetId: session.assetId,
        assetType,
        assetVersionId: session.assetVersionId,
        uploadId: session.uploadId,
        objectName: session.objectName,
        parts: orderedParts,
      });

      setPhase("done");
      setStatusText("Upload complete.");
      onUploaded();
    } catch (err) {
      logEvent("upload ✗", false);
      setPhase("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  const handleCancel = async () => {
    const session = sessionRef.current;
    if (session) {
      try {
        await assetManager.upload.abort({ ...session, assetType });
      } catch {
        // best-effort cleanup
      }
    }
    reset();
    onOpenChange(false);
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chooseFile = (next: File | null) => {
    setFile(next);
    if (next) setAssetType(guessAssetType(next.name));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {phase === "done" ? "All set" : phase === "error" ? "Upload failed" : "Upload"}
          </DialogTitle>
          {phase === "form" && (
            <DialogDescription>Pick a file and name it. That is all we need.</DialogDescription>
          )}
        </DialogHeader>

        {phase === "form" && (
          <div className="flex flex-col gap-5">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-brand-2 text-on-brand">
                {file ? <FileBox className="size-6" /> : <Upload className="size-6" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">
                  {file ? file.name : "Choose a file"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {file
                    ? `${formatSize(file.size)} · click to change`
                    : "Unreal project (.zip) or 3D model"}
                </span>
              </span>
            </button>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display-name">Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={file ? file.name.replace(/\.[^.]+$/, "") : "My model"}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                {(
                  [
                    ["UNREAL_PROJECT", "Unreal project"],
                    ["OTHER_3D", "3D model"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAssetType(value)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      assetType === value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(phase === "uploading" || phase === "done") && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            {phase === "done" ? (
              <span className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-8" />
              </span>
            ) : (
              <span className="text-5xl font-semibold tracking-tight text-foreground tabular-nums">
                {pct}%
              </span>
            )}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-brand-2 transition-all duration-300"
                style={{ width: `${phase === "done" ? 100 : pct}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {phase === "done" ? "Your upload is being processed." : statusText}
            </p>
          </div>
        )}

        {phase === "error" && error && (
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {phase === "form" && (
            <Button
              type="button"
              size="lg"
              onClick={startUpload}
              disabled={!file}
              className="h-11 w-full"
            >
              <Upload className="size-4" />
              Upload
            </Button>
          )}
          {phase === "uploading" && (
            <Button type="button" variant="outline" onClick={handleCancel} className="w-full">
              Cancel upload
            </Button>
          )}
          {(phase === "done" || phase === "error") && (
            <Button type="button" onClick={() => handleOpenChange(false)} className="h-11 w-full">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
