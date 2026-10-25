import type { AssetWithRelations } from "@/lib/allium/asset-manager";
import { Badge } from "@/components/ui/badge";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

// Map a lifecycle status value onto a badge variant. Terminal-good states use the
// primary (default) look, in-flight states use outline, failures use destructive.
function variantForStatus(status: string): BadgeVariant {
  switch (status) {
    case "COMPLETED":
    case "VALID":
      return "default";
    case "FAILED":
    case "INVALID":
      return "destructive";
    case "BUILDING":
      return "outline";
    default:
      return "secondary"; // PENDING and anything unknown
  }
}

export default function AssetStatusBadges({ asset }: { asset: AssetWithRelations }) {
  const isUnreal = asset.assetType === "UNREAL_PROJECT";
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant={variantForStatus(asset.uploadStatus)}>
        Upload: {asset.uploadStatus}
      </Badge>
      {isUnreal && (
        <Badge variant={variantForStatus(asset.buildStatus)}>
          Build: {asset.buildStatus}
        </Badge>
      )}
      <Badge variant={variantForStatus(asset.validationStatus)}>
        Validation: {asset.validationStatus}
      </Badge>
    </div>
  );
}
