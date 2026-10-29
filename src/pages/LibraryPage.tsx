import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { AssetWithRelations } from "@/lib/allium/asset-manager";
import { isDecorated } from "@/lib/room-items";
import { Armchair, ArrowUpRight, Box, DoorOpen, Play } from "lucide-react";
import { organization } from "@/lib/allium/allium-core";
import { assetManager } from "@/lib/allium/asset-manager";
import { useAuth } from "../context/AuthContext";
import { useAssetSpaces } from "@/lib/use-asset-spaces";
import { buildPercent, inProgress, isUnreal, versionsOf } from "@/lib/unreal";
import { StatusPill } from "../components/AssetStatusBadges";
import GlbPreview, { isGlb } from "../components/GlbPreview";
import UploadDialog, { type UploadKind } from "../components/UploadDialog";
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

// One tile for rooms, designs and items; `state` is the line under the name.
function LibraryTile({
  asset,
  spaceId,
  state,
}: {
  asset: AssetWithRelations;
  spaceId?: string;
  state?: string;
}) {
  const latest = versionsOf(asset)[0];
  const building = isUnreal(asset) && inProgress(latest);
  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20">
      <Link to={`/assets/${asset.id}`} className="absolute inset-0 block">
        {!isUnreal(asset) &&
        asset.downloadUrl &&
        isGlb(asset.objectName ?? asset.name) ? (
          <GlbPreview
            src={asset.downloadUrl}
            className="size-full bg-gradient-to-br from-primary/25 to-brand-2/25"
          />
        ) : asset.thumb ? (
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
        <StatusPill
          asset={asset}
          className="absolute top-3 right-3 backdrop-blur-md"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-on-brand">
              {asset.name}
            </p>
            <p className="text-xs text-on-brand/70">
              {isUnreal(asset) ? "Room" : "Item"}
              {state && ` · ${state}`}
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
          Open in designer
        </Link>
      )}
    </div>
  );
}

export type LibraryView = "rooms" | "items" | "designs";

const VIEWS: Record<
  LibraryView,
  { title: string; description: string; empty: string }
> = {
  rooms: {
    title: "Rooms",
    description: "Bare rooms, ready to be decorated.",
    empty: "No rooms yet. Upload a room to start designing.",
  },
  items: {
    title: "Items",
    description: "3D models you can place in a room.",
    empty: "No items yet. Upload an item to build your library.",
  },
  designs: {
    title: "Designs",
    description: "Rooms you decorated and saved.",
    empty: "No designs yet.",
  },
};

export default function LibraryPage({ view }: { view: LibraryView }) {
  const { profile } = useAuth();

  const [orgId, setOrgId] = useState<string | null>(null);

  const [assets, setAssets] = useState<AssetWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [dropKey, setDropKey] = useState(0);
  const [uploadKind, setUploadKind] = useState<UploadKind>("room");
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
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load your library.",
        ),
      );
  }, []);

  // The API key is scoped to one Allium project, so getAll() already returns only its assets.
  const handleCreateOrg = async (e: FormEvent) => {
    e.preventDefault();
    setOrgError(null);
    setCreatingOrg(true);
    try {
      const created = await organization.organization.create({
        name: orgName.trim(),
      });
      setOrgId(created.id);
      setNoOrg(false);
      setOrgModalOpen(false);
    } catch (err) {
      setOrgError(
        err instanceof Error ? err.message : "Failed to create organization.",
      );
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
        (err) =>
          !quiet &&
          setError(
            err instanceof Error ? err.message : "Failed to load your library.",
          ),
      )
      .finally(() => !quiet && setLoading(false));
  };

  useEffect(() => {
    loadAssets();
  }, []);

  // A build takes minutes: keep refreshing while any Unreal asset is still on its way.
  const building = assets.some(
    (a) => isUnreal(a) && inProgress(versionsOf(a)[0]),
  );
  useEffect(() => {
    if (!building) return;
    const timer = setInterval(() => loadAssets(true), 10_000);
    return () => clearInterval(timer);
  }, [building]);

  // Each built Unreal asset gets its space, so it can be streamed from here.
  const { spaceIds, spaceError } = useAssetSpaces(orgId, assets);

  const [savedSpaces, setSavedSpaces] = useState<Set<string>>(new Set());
  const roomsKey = assets.map((a) => spaceIds[a.id] ?? "").join(",");

  // A room is decorated once its design was saved from the stream panel.
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    organization.spaces
      .getSpaceAll(orgId)
      .then(
        (spaces) =>
          !cancelled &&
          setSavedSpaces(
            new Set(spaces.filter(isDecorated).map((sp) => sp.id)),
          ),
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgId, roomsKey]);

  const openUpload = (kind: UploadKind, file: File | null) => {
    if (!orgId) {
      setOrgModalOpen(true);
      return;
    }
    setUploadKind(kind);
    setDroppedFile(file);
    setDropKey((k) => k + 1);
    setUploadOpen(true);
  };

  // A room is an Unreal project; it is a design once its decoration was saved, a bare room
  // otherwise (including while it is still building). Items are the 3D models.
  const isDesign = (a: AssetWithRelations) => savedSpaces.has(spaceIds[a.id]);
  const list = assets.filter((a) =>
    view === "items"
      ? !isUnreal(a)
      : isUnreal(a) && (view === "designs") === isDesign(a),
  );
  const bareRooms = assets.filter((a) => isUnreal(a) && !isDesign(a));
  const { title, description, empty } = VIEWS[view];
  const uploadKindForView: UploadKind | null =
    view === "rooms" ? "room" : view === "items" ? "item" : null;
  const canUpload = !((!orgId && !noOrg) || !profile);

  return (
    <div className="flex flex-col gap-10">
      <Dialog open={orgModalOpen} onOpenChange={setOrgModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create an organization</DialogTitle>
            <DialogDescription>
              You need an organization before you can upload.
            </DialogDescription>
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

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-3xl">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        {uploadKindForView && (
          <Button
            type="button"
            disabled={!canUpload}
            onClick={() => openUpload(uploadKindForView, null)}
          >
            {view === "rooms" ? <DoorOpen /> : <Armchair />}
            {view === "rooms" ? "Upload room" : "Upload item"}
          </Button>
        )}
      </header>

      {list.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((a) => (
            <LibraryTile
              key={a.id}
              asset={a}
              spaceId={view === "items" ? undefined : spaceIds[a.id]}
              state={
                view === "items"
                  ? undefined
                  : isDesign(a)
                    ? "Designed"
                    : "Empty"
              }
            />
          ))}
        </div>
      )}
      {view !== "designs" && !loading && !error && list.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      )}

      {view === "designs" && !loading && !error && list.length === 0 && (
        <section>
          <h2 className="mb-1">Start a design</h2>
          <p className="mb-4 text-muted-foreground">
            Open a room, add items and press Save design.
          </p>
          {bareRooms.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {bareRooms.map((a) => (
                <LibraryTile
                  key={a.id}
                  asset={a}
                  spaceId={spaceIds[a.id]}
                  state="Empty"
                />
              ))}
            </div>
          ) : (
            <Button asChild>
              <Link to="/rooms">Upload a room first</Link>
            </Button>
          )}
        </section>
      )}

      {orgId && profile && (
        <UploadDialog
          key={dropKey}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          orgId={orgId}
          userId={profile.id}
          kind={uploadKind}
          initialFile={droppedFile}
          onUploaded={() => loadAssets()}
        />
      )}
    </div>
  );
}
