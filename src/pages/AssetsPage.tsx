import { useState } from "react";
import type { Body, Cloth, Material, Skull, SkullMaterial } from "@alliumcloud/avatar-sso";
import sso from "../lib/sso";
import AssetBrowser from "../components/AssetBrowser";

const TABS = ["cloths", "materials", "skulls", "skull-materials", "bodies"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  cloths: "Clothing",
  materials: "Materials",
  skulls: "Skulls",
  "skull-materials": "Skull materials",
  bodies: "Bodies",
};

export default function AssetsPage() {
  const [tab, setTab] = useState<Tab>("cloths");

  return (
    <div>
      <h1>Assets</h1>
      <div className="auth-form-mode" style={{ marginBottom: "1.5rem" }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={t === tab ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "cloths" && (
        <AssetBrowser<Cloth>
          fetchAll={() => sso.clothGetAll()}
          fetchById={sso.clothGetById}
          getId={(item) => item.id}
          renderListItem={(item) => item.name}
          renderDetail={(item) => (
            <dl>
              {item.thumb && (
                <img src={item.thumb} alt="" style={{ gridColumn: "1 / -1" }} />
              )}
              <dt>Name</dt>
              <dd>{item.name}</dd>
              <dt>Type</dt>
              <dd>{item.type}</dd>
              <dt>Body</dt>
              <dd>{item.bodyDefinition}</dd>
              <dt>Public</dt>
              <dd>{item.public ? "Yes" : "No"}</dd>
              <dt>Description</dt>
              <dd>{item.description}</dd>
            </dl>
          )}
        />
      )}

      {tab === "materials" && (
        <AssetBrowser<Material>
          fetchAll={() => sso.materialGetAll()}
          fetchById={sso.materialGetById}
          getId={(item) => item.id}
          renderListItem={(item) => item.name}
          renderDetail={(item) => (
            <dl>
              {item.thumb && (
                <img src={item.thumb} alt="" style={{ gridColumn: "1 / -1" }} />
              )}
              <dt>Name</dt>
              <dd>{item.name}</dd>
              <dt>Type</dt>
              <dd>{item.type}</dd>
              <dt>Public</dt>
              <dd>{item.public ? "Yes" : "No"}</dd>
              <dt>Description</dt>
              <dd>{item.description}</dd>
            </dl>
          )}
        />
      )}

      {tab === "skulls" && (
        <AssetBrowser<Skull>
          fetchAll={() => sso.skullGetAll()}
          fetchById={sso.skullGetById}
          getId={(item) => item.id}
          renderListItem={(item) => item.name}
          renderDetail={(item) => (
            <dl>
              {item.previewUrl && (
                <img src={item.previewUrl} alt="" style={{ gridColumn: "1 / -1" }} />
              )}
              <dt>Name</dt>
              <dd>{item.name}</dd>
              <dt>Gender</dt>
              <dd>{item.gender}</dd>
              <dt>Public</dt>
              <dd>{item.public ? "Yes" : "No"}</dd>
              <dt>3D model</dt>
              <dd>
                <a href={item.url3d} target="_blank" rel="noreferrer">
                  {item.url3d}
                </a>
              </dd>
            </dl>
          )}
        />
      )}

      {tab === "skull-materials" && (
        <AssetBrowser<SkullMaterial>
          fetchAll={() => sso.skullMaterialGetAll()}
          fetchById={sso.skullMaterialGetById}
          getId={(item) => item.id}
          renderListItem={(item) => item.name}
          renderDetail={(item) => (
            <dl>
              {item.previewUrl && (
                <img src={item.previewUrl} alt="" style={{ gridColumn: "1 / -1" }} />
              )}
              <dt>Name</dt>
              <dd>{item.name}</dd>
              <dt>Type</dt>
              <dd>{item.type}</dd>
              <dt>Description</dt>
              <dd>{item.description}</dd>
            </dl>
          )}
        />
      )}

      {tab === "bodies" && (
        <AssetBrowser<Body>
          fetchAll={() => sso.bodyGetAll()}
          fetchById={sso.bodyGetById}
          getId={(item) => item.id}
          renderListItem={(item) => item.name}
          renderDetail={(item) => (
            <dl>
              {item.previewUrl && (
                <img src={item.previewUrl} alt="" style={{ gridColumn: "1 / -1" }} />
              )}
              <dt>Name</dt>
              <dd>{item.name}</dd>
              <dt>Gender</dt>
              <dd>{item.gender}</dd>
              <dt>Shape</dt>
              <dd>{item.shape}</dd>
              <dt>Description</dt>
              <dd>{item.description}</dd>
            </dl>
          )}
        />
      )}
    </div>
  );
}
