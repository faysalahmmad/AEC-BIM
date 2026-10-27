import { useEffect, useState } from "react";
import type { AssetWithRelations } from "@/lib/allium/asset-manager";
import { organization, type Space } from "@/lib/allium/allium-core";
import { ensureSpace } from "@/lib/allium/spaces";
import { isUnreal, latestCompleted } from "@/lib/unreal";

// Maps each Unreal asset id to its space, creating the space as soon as a build completes.
export function useAssetSpaces(orgId: string | null, assets: AssetWithRelations[]) {
  const [spaceIds, setSpaceIds] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const ready = assets.filter((a) => isUnreal(a) && latestCompleted(a));
  const key = ready.map((a) => a.id).join(",");

  useEffect(() => {
    if (!orgId || ready.length === 0) return;
    let cancelled = false;
    organization.spaces
      .getSpaceAll(orgId)
      .then(async (spaces: Space[]) => {
        for (const asset of ready) {
          const space = await ensureSpace(orgId, asset, spaces);
          if (cancelled) return;
          setSpaceIds((prev) =>
            prev[asset.id] === space.id ? prev : { ...prev, [asset.id]: space.id },
          );
        }
      })
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof Error ? err.message : "Could not create the space."),
      );
    return () => {
      cancelled = true;
    };
    // `ready` is derived from `assets`; `key` changes exactly when its ids do.
  }, [orgId, key]);

  return { spaceIds, spaceError: error };
}
