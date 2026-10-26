import type { AssetWithRelations } from "@/lib/allium/asset-manager";
import { cn } from "@/lib/utils";

type Tone = "success" | "info" | "warning" | "destructive" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const DOT_CLASS: Record<Tone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
};

// Collapse the three lifecycle statuses into the one thing a person cares about.
export function assetStatus(asset: AssetWithRelations): { label: string; tone: Tone } {
  const isUnreal = asset.assetType === "UNREAL_PROJECT";
  const statuses = [asset.uploadStatus, asset.validationStatus, isUnreal ? asset.buildStatus : null];
  if (statuses.some((s) => s === "FAILED" || s === "INVALID")) {
    return { label: "Failed", tone: "destructive" };
  }
  if (isUnreal && (asset.buildStatus === "BUILDING" || asset.buildStatus === "REBUILDING")) {
    return { label: "Building", tone: "warning" };
  }
  if (asset.uploadStatus === "COMPLETED" && asset.validationStatus === "VALID") {
    if (!isUnreal || asset.buildStatus === "COMPLETED") {
      return { label: "Ready", tone: "success" };
    }
  }
  if (asset.uploadStatus === "COMPLETED") return { label: "Processing", tone: "info" };
  return { label: "Uploading", tone: "info" };
}

export function StatusPill({ asset, className }: { asset: AssetWithRelations; className?: string }) {
  const { label, tone } = assetStatus(asset);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} />
      {label}
    </span>
  );
}

export default StatusPill;
