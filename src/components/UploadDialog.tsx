import { useRef, useState } from "react";
import type {
  AssetType,
  InitiateUploadRequest,
  UploadPart,
  UploadSession,
} from "@/lib/allium/asset-manager";
import { CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";
import { assetManager } from "@/lib/allium/asset-manager";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// GCS multipart parts must be at least 5 MiB (except the final part). 8 MiB keeps
// part counts reasonable while staying comfortably above that floor.
const CHUNK_SIZE = 8 * 1024 * 1024;
const CONCURRENCY = 4;

const UE_VERSIONS = ["5.0.3", "5.2.1"] as const;
const TARGETS = ["Development", "Shipping"] as const;

type Phase = "form" | "uploading" | "done" | "error";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  projectId: string;
  userId: string;
  orgName?: string;
  projectName?: string;
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

function stripQuotes(etag: string): string {
  return etag.replace(/^"|"$/g, "");
}

export default function UploadDialog({
  open,
  onOpenChange,
  orgId,
  projectId,
  userId,
  orgName,
  projectName,
  onUploaded,
}: UploadDialogProps) {
  const [assetType, setAssetType] = useState<AssetType>("UNREAL_PROJECT");
  const [displayName, setDisplayName] = useState("");
  const [ueVersion, setUeVersion] = useState<(typeof UE_VERSIONS)[number]>("5.2.1");
  const [target, setTarget] = useState<(typeof TARGETS)[number]>("Development");
  const [file, setFile] = useState<File | null>(null);

  const [phase, setPhase] = useState<Phase>("form");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Keep the active session so a cancel can abort it in GCS.
  const sessionRef = useRef<UploadSession | null>(null);

  const reset = () => {
    setAssetType("UNREAL_PROJECT");
    setDisplayName("");
    setUeVersion("5.2.1");
    setTarget("Development");
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
      // 1. Resume an interrupted upload for this filename if one exists, else initiate.
      setStatusText("Preparing upload...");
      let session = await assetManager.upload.getSession(file.name);
      let existingParts: UploadPart[] = [];

      if (session) {
        setStatusText("Resuming previous upload...");
        existingParts = await assetManager.upload.listParts(session.objectName, session.uploadId);
      } else {
        const initiateData: InitiateUploadRequest = {
          orgId,
          projectId,
          userId,
          assetType,
          assetFilename: file.name,
          assetDisplayName: displayName || undefined,
          ...(assetType === "UNREAL_PROJECT"
            ? {
                unrealProjectDisplayName: displayName || undefined,
                unrealEngineVersion: ueVersion,
                target,
                selfPackaged: true,
              }
            : { other_3dDisplayName: displayName || undefined }),
        };
        const initiated = await assetManager.upload.initiate(initiateData);
        session = {
          orgId: initiated.orgId,
          projectId: initiated.projectId,
          assetId: initiated.assetId,
          assetVersionId: initiated.assetVersionId,
          uploadId: initiated.uploadId,
          objectName: initiated.objectName,
        };
      }
      sessionRef.current = session;

      // 2. Work out which parts still need uploading.
      const totalParts = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      const parts = new Map<number, string>();
      for (const p of existingParts) parts.set(p.partNumber, p.etag);
      const missing: number[] = [];
      for (let n = 1; n <= totalParts; n++) if (!parts.has(n)) missing.push(n);

      setProgress({ done: parts.size, total: totalParts });

      // 3. Batch-fetch signed URLs for the missing parts.
      if (missing.length > 0) {
        setStatusText(`Uploading ${missing.length} part(s)...`);
        const signedUrls = await assetManager.upload.batchGetSignedUrls(
          session.orgId,
          session.projectId,
          session.assetId,
          session.assetVersionId,
          session.uploadId,
          session.objectName,
          missing,
        );

        // 4. PUT each chunk directly to GCS with bounded parallelism; retry once
        //    with a fresh signed URL on failure (pre-fetched URLs can expire).
        await runPool(missing, CONCURRENCY, async (partNumber) => {
          try {
            const etag = await putPart(partNumber, signedUrls[partNumber]);
            parts.set(partNumber, etag);
          } catch {
            const freshUrl = await assetManager.upload.getSignedUrl(
              session!.orgId,
              session!.projectId,
              session!.assetId,
              session!.assetVersionId,
              session!.uploadId,
              session!.objectName,
              partNumber,
            );
            const etag = await putPart(partNumber, freshUrl);
            parts.set(partNumber, etag);
          }
          setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
        });
      }

      // 5. Assemble the object and mark the asset as uploaded.
      setStatusText("Finalizing...");
      const orderedParts = Array.from(parts.entries())
        .map(([partNumber, etag]) => ({ partNumber, etag }))
        .sort((a, b) => a.partNumber - b.partNumber);

      await assetManager.upload.complete({
        orgId: session.orgId,
        projectId: session.projectId,
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New upload</DialogTitle>
          <DialogDescription>
            {orgName && projectName
              ? `Uploading to ${projectName} · ${orgName}`
              : "Upload a project asset."}
          </DialogDescription>
        </DialogHeader>

        {phase === "form" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Asset type</Label>
              <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNREAL_PROJECT">Unreal Project</SelectItem>
                  <SelectItem value="OTHER_3D">Other 3D</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My Project"
              />
            </div>

            {assetType === "UNREAL_PROJECT" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Unreal Engine version</Label>
                  <Select value={ueVersion} onValueChange={(v) => setUeVersion(v as typeof ueVersion)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UE_VERSIONS.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Target</Label>
                  <Select value={target} onValueChange={(v) => setTarget(v as typeof target)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGETS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <span className="text-xs text-muted-foreground">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              )}
            </div>
          </div>
        )}

        {(phase === "uploading" || phase === "done") && (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              {phase === "uploading" ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="size-4 text-success" />
              )}
              <span>{statusText}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-brand-2 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {progress.done} / {progress.total} parts · {pct}%
            </span>
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
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={startUpload} disabled={!file}>
                <Upload className="size-4" />
                Start upload
              </Button>
            </>
          )}
          {phase === "uploading" && (
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel upload
            </Button>
          )}
          {(phase === "done" || phase === "error") && (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
