import type { AssetWithRelations } from "@/lib/allium/asset-manager";
import { getContentDelivery } from "./content-delivery";
import { organization, type Space } from "./allium-core";
import { latestCompleted } from "../unreal";

const inFlight = new Map<string, Promise<Space>>();

// A space pins one built version, the one Content Delivery streams. Every built Unreal
// asset gets exactly one: reuse the existing space, else create it.
export function ensureSpace(
  orgId: string,
  asset: AssetWithRelations,
  spaces: Space[],
): Promise<Space> {
  const existing = spaces.find((s) => s.unrealProjectId === asset.id);
  if (existing) return Promise.resolve(existing);
  const pending = inFlight.get(asset.id);
  if (pending) return pending;

  const version = latestCompleted(asset);
  if (!version) return Promise.reject(new Error("No built version to create a space from."));

  const name = asset.unrealProjects?.[0]?.displayName || asset.name;
  const created = (async () => {
    const space = await organization.spaces.create({
      name,
      orgId,
      unrealProject: {
        unrealProjectName: name,
        unrealProjectId: asset.id,
        unrealProjectVersionId: version.id,
      },
    });
    await organization.spaces.updateSetting(space.id, {
      avatarControlSystem: "EVENT_MODE",
    });
    if (asset.thumb) {
      await organization.spaces.update(space.id, { thumb: asset.thumb! });
    }
    return space;
  })().finally(() => inFlight.delete(asset.id));
  inFlight.set(asset.id, created);
  return created;
}

// An Unreal space streams only on a cloud GPU, so a project that never saved its streaming
// settings gets the defaults (pixel streaming, every GPU class with capacity, us-central1)
// before the first session.
export async function ensureStreamingConfiguration(): Promise<void> {
  const contentDelivery = getContentDelivery();
  const current = await contentDelivery.configuration.get();
  if (current) return;
  const [regions, gpus] = await Promise.all([
    contentDelivery.catalog.regions(),
    contentDelivery.catalog.gpuClasses(),
  ]);
  await contentDelivery.configuration.set({
    isPixelStreaming: true,
    gpuClasses: gpus.filter((g) => g.availableIn.length > 0).map((g) => g.name),
    regions: regions.some((r) => r.code === "us-central1")
      ? ["us-central1"]
      : regions.slice(0, 1).map((r) => r.code),
  });
}
