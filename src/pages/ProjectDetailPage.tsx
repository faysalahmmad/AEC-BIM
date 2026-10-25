import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  AssetWithRelations,
  DeleteProjectReport,
  UnrealProjectVersion,
} from "@/lib/allium/asset-manager";
import { ArrowLeft, Download, ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { assetManager } from "@/lib/allium/asset-manager";
import { useAuth } from "../context/AuthContext";
import AssetStatusBadges from "../components/AssetStatusBadges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Coarse per-version progress group → colour dot for the timeline.
const STATE_GROUP_COLOR: Record<string, string> = {
  uploading: "bg-info",
  uploaded: "bg-info",
  validating: "bg-warning",
  building: "bg-warning",
  deploying: "bg-brand-2",
  complete: "bg-success",
  failed: "bg-destructive",
  expired: "bg-muted-foreground",
};

export default function ProjectDetailPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [asset, setAsset] = useState<AssetWithRelations | null>(null);
  const [versions, setVersions] = useState<UnrealProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteReport, setDeleteReport] = useState<DeleteProjectReport | null>(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    assetManager.assets
      .getById(assetId)
      .then((data) => {
        if (cancelled) return;
        setAsset(data);
        setName(data.name);
        setDescription(data.description ?? "");
        // Version history only applies to Unreal projects.
        if (data.assetType === "UNREAL_PROJECT") {
          return assetManager.versions.getByAsset(assetId).then((v) => {
            if (!cancelled) setVersions(v);
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load asset.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const handleSave = async () => {
    if (!assetId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await assetManager.assets.update(assetId, { name, description });
      setAsset(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleThumb = async (file: File) => {
    if (!assetId || !profile) return;
    setUploadingThumb(true);
    setSaveError(null);
    try {
      const updated = await assetManager.assets.uploadThumb(assetId, profile.id, file);
      setAsset(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to upload thumbnail.");
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleDelete = async () => {
    if (!assetId) return;
    setDeleting(true);
    try {
      const report = await assetManager.sanitization.deleteProjectAndFootprint(assetId);
      if (report.fullyDeleted) {
        navigate("/projects");
      } else {
        setDeleteReport(report);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Deletion failed.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading asset...</p>;
  }

  if (error || !asset) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <Alert variant="destructive">
          <AlertDescription>{error ?? "Asset not found."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const dirty = name !== asset.name || description !== (asset.description ?? "");

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1">{asset.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {asset.assetType === "UNREAL_PROJECT" ? "Unreal Project" : "Other 3D"}
            </Badge>
            {asset.downloadUrl && (
              <a
                href={asset.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Download className="size-3.5" />
                Download build
              </a>
            )}
          </div>
        </div>
      </div>

      <AssetStatusBadges asset={asset} />

      <div className="grid grid-cols-[240px_1fr] gap-6">
        {/* Thumbnail */}
        <div className="flex flex-col gap-2">
          <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-muted">
            {asset.thumb ? (
              <img src={asset.thumb} alt="" className="size-full object-cover" />
            ) : (
              <ImageOff className="size-8 text-muted-foreground" />
            )}
          </div>
          <input
            ref={thumbInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleThumb(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => thumbInputRef.current?.click()}
            disabled={uploadingThumb}
          >
            {uploadingThumb ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploadingThumb ? "Uploading..." : "Change thumbnail"}
          </Button>
        </div>

        {/* Metadata editor */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            <Button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="self-start"
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Version history (Unreal projects only) */}
      {asset.assetType === "UNREAL_PROJECT" && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Version history</h2>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-0 py-2">
                {versions.map((version, i) => (
                  <div key={version.id}>
                    {i > 0 && <Separator />}
                    <div className="flex items-center gap-3 py-3">
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          STATE_GROUP_COLOR[version.stateGroup] ?? "bg-muted-foreground",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{version.name}</span>
                          <Badge variant="outline">{version.stateGroup}</Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {version.state} · {new Date(version.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {version.downloadUrl && (
                        <a
                          href={version.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Danger zone */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-destructive">Danger zone</h2>
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Permanently delete this asset and its entire footprint — GCS files, Kubernetes
              PVCs, and all database records. This cannot be undone.
            </p>

            {deleteReport && (
              <Alert variant="destructive">
                <AlertDescription>
                  <p className="mb-2 font-medium">
                    Some deletion steps did not complete. Manual cleanup may be required:
                  </p>
                  <ul className="flex flex-col gap-1">
                    {deleteReport.steps.map((step) => (
                      <li key={step.step} className="text-xs">
                        {step.success ? "✓" : step.skipped ? "–" : "✗"} {step.step}
                        {step.error ? ` — ${step.error}` : ""}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="self-start" disabled={deleting}>
                  <Trash2 className="size-4" />
                  {deleting ? "Deleting..." : "Delete project & footprint"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this project permanently?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes <strong>{asset.name}</strong> and every associated resource.
                    This action is irreversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete permanently</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/projects"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to projects
    </Link>
  );
}
