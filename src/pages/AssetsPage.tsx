import { useEffect, useState } from "react";
import type { UpdateProfilePayload } from "@/lib/allium/avatar-sso";
import {
  Check,
  ImageOff,
  Layers,
  Palette,
  PersonStanding,
  Shirt,
  Skull as SkullIcon,
} from "lucide-react";
import { sso } from "@/lib/allium/avatar-sso";
import { useAuth } from "../context/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EquipField =
  | "bodyId"
  | "skullId"
  | "clothingIdMaterial"
  | "clothingIdTop"
  | "clothingIdBottom"
  | "clothingIdShoes";

interface AssetItem {
  id: string;
  name: string;
  thumbnail?: string | null;
  badges: string[];
  description?: string;
  link?: { label: string; href: string };
  equipField?: EquipField;
}

type CategoryKey = "cloths" | "materials" | "skulls" | "skull-materials" | "bodies";

function clothEquipField(type: string): EquipField | undefined {
  const t = type.toLowerCase();
  if (t.includes("top")) return "clothingIdTop";
  if (t.includes("bottom")) return "clothingIdBottom";
  if (t.includes("shoe")) return "clothingIdShoes";
  return undefined;
}

const CATEGORIES: { key: CategoryKey; label: string; icon: typeof Shirt }[] = [
  { key: "cloths", label: "Clothing", icon: Shirt },
  { key: "materials", label: "Materials", icon: Palette },
  { key: "skulls", label: "Skulls", icon: SkullIcon },
  { key: "skull-materials", label: "Skull materials", icon: Layers },
  { key: "bodies", label: "Bodies", icon: PersonStanding },
];

async function fetchCategory(category: CategoryKey): Promise<AssetItem[]> {
  switch (category) {
    case "cloths": {
      const list = await sso.clothGetAll({ skip: 0, limit: 20, sort: "asc" });
      return list.map((item) => ({
        id: item.id,
        name: item.name,
        thumbnail: item.thumb,
        badges: [item.type, item.bodyDefinition, item.public ? "Public" : "Private"],
        description: item.description,
        equipField: clothEquipField(item.type),
      }));
    }
    case "materials": {
      const list = await sso.materialGetAll({ skip: 0, limit: 20, sort: "asc" });
      return list.map((item) => ({
        id: item.id,
        name: item.name,
        thumbnail: item.thumb,
        badges: [item.type, item.public ? "Public" : "Private"],
        description: item.description,
        equipField: "clothingIdMaterial",
      }));
    }
    case "skulls": {
      const list = await sso.skullGetAll();
      return list.map((item) => ({
        id: item.id,
        name: item.name,
        thumbnail: item.previewUrl,
        badges: [item.gender, item.public ? "Public" : "Private"],
        link: { label: "View 3D model", href: item.url3d },
        equipField: "skullId",
      }));
    }
    case "skull-materials": {
      const list = await sso.skullMaterialGetAll();
      return list.map((item) => ({
        id: item.id,
        name: item.name,
        thumbnail: item.previewUrl,
        badges: [item.type],
        description: item.description,
      }));
    }
    case "bodies": {
      const list = await sso.bodyGetAll();
      return list.map((item) => ({
        id: item.id,
        name: item.name,
        thumbnail: item.previewUrl,
        badges: [item.gender, item.shape],
        description: item.description,
        equipField: "bodyId",
      }));
    }
  }
}

export default function AssetsPage() {
  const { profile, refreshProfile } = useAuth();
  const [category, setCategory] = useState<CategoryKey>("cloths");
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [equippingId, setEquippingId] = useState<string | null>(null);
  const [equipError, setEquipError] = useState<string | null>(null);

  const isEquipped = (item: AssetItem) => {
    if (!item.equipField || !profile) return false;
    if (item.equipField === "bodyId") return String(profile.bodyId) === item.id;
    return profile[item.equipField] === item.id;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEquipError(null);
    fetchCategory(category)
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        const equipped = data.find((item) => item.equipField && profile?.[item.equipField] === item.id);
        setSelectedId(equipped?.id ?? data[0]?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const handleEquip = async (item: AssetItem) => {
    if (!item.equipField) return;
    setEquipError(null);
    setEquippingId(item.id);
    try {
      await sso.profileUpdate({ [item.equipField]: item.id } as UpdateProfilePayload);
      await refreshProfile();
    } catch (err) {
      setEquipError(err instanceof Error ? err.message : "Failed to equip item.");
    } finally {
      setEquippingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1">Build your avatar</h1>
        <p className="text-sm text-muted-foreground">
          Pick a category, choose an item, and equip it on your avatar.
        </p>
      </div>

      <div className="grid grid-cols-[180px_1fr_300px] gap-5">
        <nav className="flex flex-col gap-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = cat.key === category;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-all",
                  active
                    ? "bg-gradient-to-r from-primary to-brand-2 font-semibold text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{cat.label}</span>
              </button>
            );
          })}
        </nav>

        <div>
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items found.</p>
          )}
          {!loading && items.length > 0 && (
            <div className="grid max-h-[560px] grid-cols-3 gap-3 overflow-y-auto pr-1">
              {items.map((item) => {
                const active = item.id === selectedId;
                const equipped = isEquipped(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-xl border-2 border-transparent bg-muted transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                      active && "border-primary shadow-lg shadow-primary/20",
                    )}
                  >
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageOff className="size-6" />
                      </div>
                    )}
                    {equipped && (
                      <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-2 text-on-brand shadow">
                        <Check className="size-3" />
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim/70 to-transparent p-2 pt-6">
                      <p className="truncate text-xs font-medium text-on-brand">{item.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="flex flex-col gap-3">
            {!selected && (
              <p className="text-sm text-muted-foreground">Select an item to preview it.</p>
            )}
            {selected && (
              <>
                {selected.thumbnail ? (
                  <img src={selected.thumbnail} alt="" className="w-full rounded-lg" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ImageOff className="size-8" />
                  </div>
                )}
                <div>
                  <h3 className="mb-1.5 text-base font-semibold text-foreground">
                    {selected.name}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.badges
                      .filter((badge): badge is string => Boolean(badge))
                      .map((badge) => (
                        <Badge key={badge} variant="secondary">
                          {badge}
                        </Badge>
                      ))}
                  </div>
                </div>
                {selected.description && (
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                )}
                {selected.link && (
                  <a
                    href={selected.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm"
                  >
                    {selected.link.label}
                  </a>
                )}

                {equipError && (
                  <Alert variant="destructive">
                    <AlertDescription>{equipError}</AlertDescription>
                  </Alert>
                )}

                {selected.equipField ? (
                  isEquipped(selected) ? (
                    <Button type="button" variant="outline" disabled className="self-start">
                      <Check className="size-4" />
                      Equipped
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => handleEquip(selected)}
                      disabled={equippingId === selected.id}
                      className="self-start"
                    >
                      {equippingId === selected.id ? "Equipping..." : "Equip"}
                    </Button>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">Preview only.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
