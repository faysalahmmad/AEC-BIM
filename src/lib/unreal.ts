import type { AssetWithRelations, UnrealProjectVersion } from "@/lib/allium/asset-manager";

// The build status Asset Manager reports per version (state), as a percent.
const COMPLETE = new Set(["volume_copy_complete", "rebuild_rollback_complete"]);

const PERCENT: Record<string, number> = {
  new: 0,
  rebuild_started: 1,
  builder_pod_creating: 1,
  package_validator_pod_creating: 1,
  package_validator_required: 1,
  upload_complete: 1,
  detecting_engine_version: 2,
  builder_pod_waiting_for_ready: 5,
  package_validator_pod_waiting_for_ready: 5,
  builder_pod_ready: 10,
  package_validator_pod_ready: 10,
  builder_downloading_project_version: 15,
  builder_downloading_plugin_version: 25,
  builder_copying_plugin_version: 35,
  builder_building: 40,
  package_validator_validating: 40,
  builder_uploading: 45,
  builder_settings_uploaded: 45,
  builder_update_unreal_project_name: 45,
  builder_upload_complete: 50,
  package_validator_complete: 50,
  volume_copy_pvcs_creating: 65,
  volume_copy_pvcs_bound: 70,
  volume_copy_pods_creating: 75,
  volume_copy_pods_waiting_for_ready: 80,
  volume_copy_pods_ready: 85,
  volume_copy_region_copying: 90,
  rebuild_rolling_back: 90,
  volume_copy_region_complete: 95,
};

const time = (d: unknown) => new Date(d as string).getTime();

/** Every version of an Unreal asset, newest first. */
export const versionsOf = (asset: AssetWithRelations, loaded?: UnrealProjectVersion[]) =>
  [...(loaded ?? asset.unrealProjects?.[0]?.versions ?? [])].sort(
    (a, b) => time(b.createdAt) - time(a.createdAt),
  );

export const isComplete = (v: UnrealProjectVersion | undefined): boolean =>
  !!v && COMPLETE.has(v.state);

/** The newest built version, the one a space can pin. */
export const latestCompleted = (asset: AssetWithRelations, loaded?: UnrealProjectVersion[]) =>
  versionsOf(asset, loaded).find(isComplete);

/** 0–100, or -1 when the version failed, expired or has not moved for 3 hours. */
export function buildPercent(v: UnrealProjectVersion | undefined): number {
  if (!v?.state) return 0;
  if (COMPLETE.has(v.state)) return 100;
  if (/failed|timed_out|expired|invalid/.test(v.state)) return -1;
  if ((Date.now() - (v.updatedAt ? time(v.updatedAt) : Date.now())) / 3_600_000 > 3) return -1;
  return PERCENT[v.state] ?? 0;
}

/** A version on its way (worth polling for). */
export const inProgress = (v: UnrealProjectVersion | undefined): boolean => {
  const p = buildPercent(v);
  return !!v && p >= 0 && p < 100;
};

export const isUnreal = (a: AssetWithRelations): boolean => a.assetType === "UNREAL_PROJECT";
