import { getConfigurator } from "@/lib/allium/configurator";
import { organization } from "@/lib/allium/allium-core";

export type Vector3 = { x: number; y: number; z: number };
export type SpaceItem = Awaited<ReturnType<typeof organization.spaces.getItems>>[number];
export type Room = { orgId: string; spaceId: string };

// A .glb is uploaded as a room asset and placed as a RuntimeModel space item.
const MODEL_TYPE = "RuntimeModel";
const PART_SIZE = 8 * 1024 * 1024;
const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 };

export const isRoomItem = (item: SpaceItem) => item.type === MODEL_TYPE;

export const positionOf = (item: SpaceItem): Vector3 => ({
  ...ORIGIN,
  ...((item.position as Partial<Vector3> | null) ?? {}),
});

export async function uploadRoomItem(
  room: Room,
  file: File,
  at: { position: Vector3; rotation: Vector3 } = { position: ORIGIN, rotation: ORIGIN },
): Promise<string> {
  const spaceItemId = crypto.randomUUID();
  const { asset } = getConfigurator();
  const { uploadId, objectName } = await asset.initiateUpload({
    ...room,
    spaceItemId,
    assetFilename: file.name,
  });
  try {
    const partNumbers = Array.from(
      { length: Math.max(1, Math.ceil(file.size / PART_SIZE)) },
      (_, i) => i + 1,
    );
    const urls = (await asset.getBatchSignedUrls({ objectName, uploadId, partNumbers })) as Record<
      number,
      string
    >;
    const parts: { partNumber: number; etag: string }[] = [];
    for (const partNumber of partNumbers) {
      const body = file.slice((partNumber - 1) * PART_SIZE, partNumber * PART_SIZE);
      const res = await fetch(urls[partNumber], { method: "PUT", body });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      parts.push({ partNumber, etag: res.headers.get("ETag") ?? "" });
    }
    const glb = await asset.completeUpload({
      objectName,
      uploadId,
      spaceId: room.spaceId,
      spaceItemId,
      assetFilename: file.name,
      parts,
    });
    await asset.createObject({
      ...room,
      spaceItemId,
      name: file.name.replace(/\.glb$/i, ""),
      type: MODEL_TYPE,
      gltfUrl: glb.downloadUrl,
      gltfPath: glb.objectName,
      gltfBucket: glb.bucket,
      materialOverrideId: "None",
      scale: { x: 1, y: 1, z: 1 },
      autoScale: true,
      offsetUniformScale: 1,
      collisionsEnabled: true,
      offsetUpRotation: 0,
      ...at,
    });
  } catch (err) {
    await asset.abortUpload({ objectName, uploadId }).catch(() => {});
    throw err;
  }
  return spaceItemId;
}

export const listRoomItems = async (spaceId: string) =>
  (await organization.spaces.getItems(spaceId)).filter(isRoomItem);

export const movePosition = (room: Room, spaceItemId: string, position: Vector3) =>
  getConfigurator().transform.updatePosition(spaceItemId, { ...room, spaceItemId, position });

export const deleteRoomItem = (room: Room, spaceItemId: string) =>
  getConfigurator().layer.deleteItem(spaceItemId, { ...room, spaceItemId });

// A room is "decorated" once the user saves its design: the space description carries the mark.
const DECORATED_MARK = "aec-bim:decorated";

export const isDecorated = (space: { description: string | null }) =>
  space.description === DECORATED_MARK;

export const saveDecorated = (spaceId: string) =>
  organization.spaces.update(spaceId, { description: DECORATED_MARK });
