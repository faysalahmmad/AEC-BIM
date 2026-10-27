import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AssetWithRelations, UnrealProjectVersion } from "@/lib/allium/asset-manager";
import { ArrowLeft, Box, Check, Download, Loader2, Play, Trash2, Upload, X } from "lucide-react";
import { assetManager } from "@/lib/allium/asset-manager";
import { organization } from "@/lib/allium/allium-core";
import { useAuth } from "../context/AuthContext";
import { StatusPill } from "../components/AssetStatusBadges";
import { useAssetSpaces } from "@/lib/use-asset-spaces";
import { buildPercent, inProgress } from "@/lib/unreal";
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

export default function AssetDetailPage() {
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
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // A build takes minutes: refresh the asset and its versions until the newest one is done.
  const building =
    inProgress(versions[0]) ||
    (asset?.uploadStatus === "COMPLETED" &&
      asset.assetType === "UNREAL_PROJECT" &&
      versions.length === 0);
  useEffect(() => {
    if (!assetId || !building) return;
    const timer = setInterval(() => {
      assetManager.assets
        .getById(assetId)
        .then(setAsset)
        .catch(() => {});
      assetManager.versions
        .getByAsset(assetId)
        .then(setVersions)
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(timer);
  }, [assetId, building]);

  // The built asset gets its space, so it can be streamed.
  const { spaceIds, spaceError } = useAssetSpaces(
    asset?.orgId ?? null,
    asset
      ? [
          {
            ...asset,
            unrealProjects: asset.unrealProjects?.map((p) => ({
              ...p,
              versions,
            })),
          },
        ]
      : [],
  );

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
    setDeleteError(null);
    try {
      // Drop the asset's space first so it does not linger without a project to stream.
      const spaceId = spaceIds[assetId];
      if (spaceId) {
        await organization.spaces.delete(spaceId).catch(() => {});
      }
      await assetManager.assets.delete(assetId);
      navigate("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Deletion failed.");
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
  const isUnreal = asset.assetType === "UNREAL_PROJECT";

  const steps: {
    label: string;
    state: "done" | "active" | "failed" | "waiting";
  }[] = [
    {
      label: "Uploaded",
      state:
        asset.uploadStatus === "COMPLETED"
          ? "done"
          : asset.uploadStatus === "FAILED"
            ? "failed"
            : "active",
    },
    {
      label: "Validated",
      state:
        asset.validationStatus === "VALID"
          ? "done"
          : asset.validationStatus === "INVALID"
            ? "failed"
            : asset.uploadStatus === "COMPLETED"
              ? "active"
              : "waiting",
    },
    ...(isUnreal
      ? [
          {
            label: "Built",
            state:
              asset.buildStatus === "COMPLETED"
                ? ("done" as const)
                : asset.buildStatus === "FAILED"
                  ? ("failed" as const)
                  : asset.buildStatus === "BUILDING" || asset.buildStatus === "REBUILDING"
                    ? ("active" as const)
                    : ("waiting" as const),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <BackLink />

      {/* Hero */}
      <div className="relative min-h-72 overflow-hidden rounded-3xl bg-muted shadow-xl shadow-primary/10 sm:aspect-[21/9]">
        {asset.thumb ? (
          <img src={asset.thumb} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/30 to-brand-2/30">
            <Box className="size-20 text-primary/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-scrim/80 via-scrim/20 to-transparent" />

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
        <button
          type="button"
          onClick={() => thumbInputRef.current?.click()}
          disabled={uploadingThumb}
          className="absolute top-4 right-4 inline-flex items-center gap-2 rounded-full bg-on-brand/15 px-4 py-2 text-sm font-medium text-on-brand backdrop-blur-md transition-colors hover:bg-on-brand/25 disabled:opacity-60"
        >
          {uploadingThumb ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploadingThumb ? "Uploading..." : "Change cover"}
        </button>

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6 sm:p-8">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <StatusPill asset={asset} className="backdrop-blur-md" />
              <span className="text-sm text-on-brand/80">
                {isUnreal ? "Unreal project" : "3D model"}
              </span>
            </div>
            <h1 className="mb-0 truncate text-4xl text-on-brand">{asset.name}</h1>
          </div>
          {assetId && spaceIds[assetId] && (
            <Button asChild size="lg" className="h-11 rounded-full px-6">
              <Link to={`/stream/${spaceIds[assetId]}`}>
                <Play className="size-4 fill-current" />
                Stream
              </Link>
            </Button>
          )}
          {asset.downloadUrl && (
            <Button asChild size="lg" variant="secondary" className="h-11 rounded-full px-6">
              <a href={asset.downloadUrl} target="_blank" rel="noreferrer">
                <Download className="size-4" />
                Download
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Details */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="mb-0">Details</h2>
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
                placeholder="What is this model?"
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

        {/* Progress */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="mb-0">Progress</h2>
            {isUnreal && versions[0] && buildPercent(versions[0]) >= 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-brand-2 transition-all duration-500"
                    style={{ width: `${buildPercent(versions[0])}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{buildPercent(versions[0])}% built</p>
              </div>
            )}
            {spaceError && (
              <Alert variant="destructive">
                <AlertDescription>{spaceError}</AlertDescription>
              </Alert>
            )}
            <ol className="flex flex-col gap-3">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full",
                      step.state === "done" && "bg-success/15 text-success",
                      step.state === "active" && "bg-info/15 text-info",
                      step.state === "failed" && "bg-destructive/15 text-destructive",
                      step.state === "waiting" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.state === "done" && <Check className="size-4" />}
                    {step.state === "active" && <Loader2 className="size-4 animate-spin" />}
                    {step.state === "failed" && <X className="size-4" />}
                    {step.state === "waiting" && (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <span
                    className={cn(
                      step.state === "waiting"
                        ? "text-muted-foreground"
                        : "font-medium text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Version history (Unreal projects only) */}
      {isUnreal && (
        <section>
          <h2 className="mb-3">Versions</h2>
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
                          {version.unrealEngineVersion && (
                            <Badge variant="secondary">UE {version.unrealEngineVersion}</Badge>
                          )}
                          {version.pluginVersionId && (
                            <Badge variant="secondary" title={version.pluginVersionId}>
                              Plugin {version.pluginVersionId.slice(0, 8)}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {new Date(version.createdAt).toLocaleString()}
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
        </section>
      )}

      {/* Delete */}
      <div className="flex flex-col items-start gap-3">
        {deleteError && (
          <Alert variant="destructive">
            <AlertDescription>{deleteError}</AlertDescription>
          </Alert>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" className="text-destructive" disabled={deleting}>
              <Trash2 className="size-4" />
              {deleting ? "Deleting..." : "Delete asset"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this asset permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes <strong>{asset.name}</strong> and every associated resource, including
                files and records. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete permanently</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to assets
    </Link>
  );
}
