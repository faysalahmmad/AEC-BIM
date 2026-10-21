import { useState } from "react";
import type { Body, Cloth, Material, Skull, SkullMaterial } from "@alliumcloud/avatar-sso";
import sso from "../lib/sso";
import AssetBrowser from "../components/AssetBrowser";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const TABS = ["cloths", "materials", "skulls", "skull-materials", "bodies"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  cloths: "Clothing",
  materials: "Materials",
  skulls: "Skulls",
  "skull-materials": "Skull materials",
  bodies: "Bodies",
};

function AssetDetail({
  image,
  name,
  badges,
  description,
  link,
}: {
  image?: string | null;
  name: string;
  badges: (string | null | undefined)[];
  description?: string;
  link?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col gap-3">
      {image && <img src={image} alt="" className="w-full rounded-lg" />}
      <div>
        <h3 className="mb-1.5 text-base font-semibold text-foreground">{name}</h3>
        <div className="flex flex-wrap gap-1.5">
          {badges
            .filter((badge): badge is string => Boolean(badge))
            .map((badge) => (
              <Badge key={badge} variant="secondary">
                {badge}
              </Badge>
            ))}
        </div>
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {link && (
        <a href={link.href} target="_blank" rel="noreferrer" className="text-sm">
          {link.label}
        </a>
      )}
    </div>
  );
}

export default function AssetsPage() {
  const [tab, setTab] = useState<Tab>("cloths");

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1">Assets</h1>
        <p className="text-sm text-muted-foreground">
          Browse the clothing, materials, skulls, and bodies available to your avatars.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="mb-6">
        <TabsList className="w-full">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cloths">
          <AssetBrowser<Cloth>
            fetchAll={() => sso.clothGetAll({ skip: 0, limit: 20, sort: "asc" })}
            fetchById={sso.clothGetById}
            getId={(item) => item.id}
            getThumbnail={(item) => item.thumb}
            renderListItem={(item) => item.name}
            renderDetail={(item) => (
              <AssetDetail
                image={item.thumb}
                name={item.name}
                badges={[item.type, item.bodyDefinition, item.public ? "Public" : "Private"]}
                description={item.description}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="materials">
          <AssetBrowser<Material>
            fetchAll={() => sso.materialGetAll({ skip: 0, limit: 20, sort: "asc" })}
            fetchById={sso.materialGetById}
            getId={(item) => item.id}
            getThumbnail={(item) => item.thumb}
            renderListItem={(item) => item.name}
            renderDetail={(item) => (
              <AssetDetail
                image={item.thumb}
                name={item.name}
                badges={[item.type, item.public ? "Public" : "Private"]}
                description={item.description}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="skulls">
          <AssetBrowser<Skull>
            fetchAll={() => sso.skullGetAll()}
            fetchById={sso.skullGetById}
            getId={(item) => item.id}
            getThumbnail={(item) => item.previewUrl}
            renderListItem={(item) => item.name}
            renderDetail={(item) => (
              <AssetDetail
                image={item.previewUrl}
                name={item.name}
                badges={[item.gender, item.public ? "Public" : "Private"]}
                link={{ label: "View 3D model", href: item.url3d }}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="skull-materials">
          <AssetBrowser<SkullMaterial>
            fetchAll={() => sso.skullMaterialGetAll()}
            fetchById={sso.skullMaterialGetById}
            getId={(item) => item.id}
            getThumbnail={(item) => item.previewUrl}
            renderListItem={(item) => item.name}
            renderDetail={(item) => (
              <AssetDetail
                image={item.previewUrl}
                name={item.name}
                badges={[item.type]}
                description={item.description}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="bodies">
          <AssetBrowser<Body>
            fetchAll={() => sso.bodyGetAll()}
            fetchById={sso.bodyGetById}
            getId={(item) => item.id}
            getThumbnail={(item) => item.previewUrl}
            renderListItem={(item) => item.name}
            renderDetail={(item) => (
              <AssetDetail
                image={item.previewUrl}
                name={item.name}
                badges={[item.gender, item.shape]}
                description={item.description}
              />
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
