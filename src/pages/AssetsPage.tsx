import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { AssetWithRelations } from "@/lib/allium/asset-manager";
import { ArrowUpRight, Box, CloudUpload, Play } from "lucide-react";
import { organization } from "@/lib/allium/allium-core";
import { assetManager } from "@/lib/allium/asset-manager";
import { useAuth } from "../context/AuthContext";
import { useAssetSpaces } from "@/lib/use-asset-spaces";
import { buildPercent, inProgress, isUnreal, versionsOf } from "@/lib/unreal";
import { StatusPill } from "../components/AssetStatusBadges";
import { cn } from "@/lib/utils";
import UploadDialog from "../components/UploadDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AssetsPage() {
  const { profile } = useAuth();

  const [orgId, setOrgId] = useState<string | null>(null);

  const [assets, setAssets] = useState<AssetWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [dropKey, setDropKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [noOrg, setNoOrg] = useState(false);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  // Uploads still need an org ID. Resolve the user's first organization.
  useEffect(() => {
    organization.organization
      .getByUser()
      .then((list) => {
        if (list.length === 0) {
          setNoOrg(true);
          setOrgModalOpen(true);
        }
        setOrgId((current) => current ?? list[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load assets."));
  }, []);

  // The API key is scoped to one Allium project, so getAll() already returns only its assets.
  const handleCreateOrg = async (e: FormEvent) => {
    e.preventDefault();
    setOrgError(null);
    setCreatingOrg(true);
    try {
      const created = await organization.organization.create({ name: orgName.trim() });
      setOrgId(created.id);
      setNoOrg(false);
      setOrgModalOpen(false);
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : "Failed to create organization.");
    } finally {
      setCreatingOrg(false);
    }
  };

  const loadAssets = (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    assetManager.assets
      .getAll()
      .then(setAssets)
      .catch(
        (err) => !quiet && setError(err instanceof Error ? err.message : "Failed to load assets."),
      )
      .finally(() => !quiet && setLoading(false));
  };

  useEffect(() => {
    loadAssets();
  }, []);

  // A build takes minutes: keep refreshing while any Unreal asset is still on its way.
  const building = assets.some((a) => isUnreal(a) && inProgress(versionsOf(a)[0]));
  useEffect(() => {
    if (!building) return;
    const timer = setInterval(() => loadAssets(true), 10_000);
    return () => clearInterval(timer);
  }, [building]);

  // Each built Unreal asset gets its space, so it can be streamed from here.
  const { spaceIds, spaceError } = useAssetSpaces(orgId, assets);

  const openUpload = (file: File | null) => {
    if (!orgId) {
      setOrgModalOpen(true);
      return;
    }
    setDroppedFile(file);
    setDropKey((k) => k + 1);
    setUploadOpen(true);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    openUpload(e.dataTransfer.files?.[0] ?? null);
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Upload drop zone */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        disabled={(!orgId && !noOrg) || !profile}
        className={cn(
          "group relative flex w-full flex-col items-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-all duration-200 disabled:opacity-60",
          dragging
            ? "border-primary bg-accent shadow-xl shadow-primary/20"
            : "border-border bg-card hover:border-primary hover:shadow-xl hover:shadow-primary/10",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-blueprint-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <span className="relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand-2 text-on-brand shadow-lg shadow-primary/30 transition-transform duration-200 group-hover:-translate-y-1">
          <CloudUpload className="size-8" />
        </span>
        <span className="relative">
          <span className="block text-xl font-semibold text-foreground">
            Drop a model here, or click to upload
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Unreal projects and 3D files. We take care of the rest.
          </span>
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          openUpload(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <Dialog open={orgModalOpen} onOpenChange={setOrgModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create an organization</DialogTitle>
            <DialogDescription>You need an organization before you can upload.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOrg} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                autoFocus
                required
              />
            </div>
            {orgError && (
              <Alert variant="destructive">
                <AlertDescription>{orgError}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={creatingOrg || !orgName.trim()}>
              {creatingOrg ? "Creating..." : "Create organization"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {(error || spaceError) && (
        <Alert variant="destructive">
          <AlertDescription>{error ?? spaceError}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading assets...</p>}

      {!loading && !error && assets.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Nothing here yet. Your uploads will appear as tiles.
        </p>
      )}

      {!loading && assets.length > 0 && (
        <section>
          <h2 className="mb-4">Your assets</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => {
              const latest = versionsOf(asset)[0];
              const building = isUnreal(asset) && inProgress(latest);
              const spaceId = spaceIds[asset.id];
              return (
                <div
                  key={asset.id}
                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20"
                >
                  <Link to={`/assets/${asset.id}`} className="absolute inset-0 block">
                    {asset.thumb ? (
                      <img
                        src={asset.thumb}
                        alt=""
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/25 to-brand-2/25">
                        <Box className="size-12 text-primary/60" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-scrim/75 via-scrim/10 to-transparent" />
                    <StatusPill asset={asset} className="absolute top-3 right-3 backdrop-blur-md" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-on-brand">
                          {asset.name}
                        </p>
                        <p className="text-xs text-on-brand/70">
                          {asset.assetType === "UNREAL_PROJECT" ? "Unreal project" : "3D model"}
                        </p>
                      </div>
                      <ArrowUpRight className="size-5 shrink-0 text-on-brand opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                    </div>
                    {building && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-on-brand/20">
                        <div
                          className="h-full bg-brand-2 transition-all duration-500"
                          style={{ width: `${Math.max(buildPercent(latest), 3)}%` }}
                        />
                      </div>
                    )}
                  </Link>
                  {spaceId && (
                    <Link
                      to={`/stream/${spaceId}`}
                      className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
                    >
                      <Play className="size-3.5 fill-current" />
                      Stream
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {orgId && profile && (
        <UploadDialog
          key={dropKey}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          orgId={orgId}
          userId={profile.id}
          initialFile={droppedFile}
          onUploaded={() => loadAssets()}
        />
      )}
    </div>
  );
}
