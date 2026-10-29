import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Save, Trash2, Upload } from "lucide-react";
import type { AlliumPixelStreamingPlayer } from "@/lib/allium/content-delivery";
import {
  deleteRoomItem,
  listRoomItems,
  movePosition,
  positionOf,
  saveDecorated,
  uploadRoomItem,
  type Room,
  type SpaceItem,
  type Vector3,
} from "@/lib/room-items";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const AXES = ["x", "y", "z"] as const;
const POLL_MS = 2000;

const interaction = (
  player: AlliumPixelStreamingPlayer,
  id: string,
  interactionType: string,
  interactionData?: object,
) =>
  player.send({
    messageType: "interactionEvent",
    payload: {
      id,
      type: "item",
      interactionType,
      ...(interactionData ? { interactionData } : {}),
    },
  });

// Room items are space items: the sidebar lists them, a click selects one in the stream, and
// the position fields preview live in Unreal and are saved with the Configurator SDK on commit.
// The designer's chrome lives on the stream page: this component renders its controls into the
// page's toolbar and sidebar.
export default function RoomDesignPanel({
  player,
  room,
  toolbar,
  sidebar,
}: {
  player: AlliumPixelStreamingPlayer;
  room: Room;
  toolbar: HTMLElement | null;
  sidebar: HTMLElement | null;
}) {
  const [items, setItems] = useState<SpaceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Vector3 | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<string | null>(null);
  const spawnRef = useRef<{ position: Vector3; rotation: Vector3 } | undefined>(
    undefined,
  );

  const fail = (err: unknown) =>
    setError(err instanceof Error ? err.message : "Request failed.");

  // Writes are queued, so the stored items are re-read on a timer.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listRoomItems(room.spaceId)
        .then((next) => !cancelled && setItems(next))
        .catch(fail);
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [room.spaceId]);

  // Edit mode: free camera and hover highlights, plus the camera data new items spawn from.
  useEffect(() => {
    player.send({ messageType: "cmsEditMode", payload: { isToggledOn: true } });
    player.send({
      messageType: "updateSpatialDataFrequency",
      payload: { frequency: 0.2 },
    });
    const off = player.onResponse("room-spatial", (response) => {
      try {
        const msg = JSON.parse(response);
        if (msg.messageType !== "lsd") return;
        const { lap, camPos, rot } = msg.payload as Record<
          "lap" | "camPos" | "rot",
          Vector3
        >;
        // Unreal's axes map to item axes as { x: v.z, y: v.x, z: v.y }.
        const look = { x: lap.z, y: lap.x, z: lap.y };
        const cam = { x: camPos.z, y: camPos.x, z: camPos.y };
        const facing = Math.atan2(cam.y - look.y, cam.x - look.x);
        spawnRef.current = {
          position: {
            x: look.x - 300 * Math.cos(facing),
            y: look.y - 300 * Math.sin(facing),
            z: look.z - 50,
          },
          rotation: { x: 0, y: Math.abs(rot.y) - 90, z: 0 },
        };
      } catch {
        // Other content in the Unreal project may send its own messages.
      }
    });
    return () => {
      off();
      if (selectedRef.current)
        interaction(player, selectedRef.current, "select", {
          isSelected: false,
        });
      player.send({
        messageType: "cmsEditMode",
        payload: { isToggledOn: false },
      });
    };
  }, [player]);

  const select = (item: SpaceItem | null) => {
    if (selectedRef.current)
      interaction(player, selectedRef.current, "select", { isSelected: false });
    selectedRef.current = item?.id ?? null;
    setSelectedId(item?.id ?? null);
    setDraft(item ? positionOf(item) : null);
    if (item) interaction(player, item.id, "select", { isSelected: true });
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    player.send({
      messageType: "showAddObjectLoader",
      payload: { show: true },
    });
    try {
      await uploadRoomItem(room, file, spawnRef.current);
    } catch (err) {
      player.send({
        messageType: "showAddObjectLoader",
        payload: { show: false },
      });
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  // Saving marks the room as decorated, so the dashboard lists it under Decorated rooms.
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveDecorated(room.spaceId);
      setSaved(true);
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const setAxis = (axis: (typeof AXES)[number], value: number) => {
    if (!selectedId || !draft) return;
    const next = { ...draft, [axis]: value };
    setDraft(next);
    interaction(player, selectedId, "position", { value: next });
  };

  const commit = () => {
    if (selectedId && draft) movePosition(room, selectedId, draft).catch(fail);
  };

  const remove = (item: SpaceItem) => {
    if (selectedId === item.id) select(null);
    setItems((all) => all.filter((i) => i.id !== item.id));
    deleteRoomItem(room, item.id).catch(fail);
  };

  const selected = items.find((i) => i.id === selectedId);

  return (
    <>
      {toolbar &&
        createPortal(
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".glb,model/gltf-binary"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleUpload(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              Add item (.glb)
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || items.length === 0}
              onClick={handleSave}
            >
              {saving ? (
                <Loader2 className="animate-spin" />
              ) : saved ? (
                <Check />
              ) : (
                <Save />
              )}
              {saved ? "Design saved" : "Save design"}
            </Button>
          </>,
          toolbar,
        )}

      {sidebar &&
        createPortal(
          <>
            <div className="flex items-baseline justify-between">
              <h2 className="mb-0 text-sm font-semibold">In this room</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {items.length}
              </span>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {items.length === 0 && (
                <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-muted-foreground">
                  No items yet. Use Add item to place one.
                </li>
              )}
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => select(item.id === selectedId ? null : item)}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left hover:bg-accent",
                      item.id === selectedId && "bg-accent font-medium",
                    )}
                  >
                    {item.name}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => remove(item)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>

            {selected && draft && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <span className="truncate text-sm font-medium">
                  {selected.name}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {AXES.map((axis) => (
                    <label
                      key={axis}
                      className="flex flex-col gap-1 text-xs text-muted-foreground"
                    >
                      {axis.toUpperCase()}
                      <Input
                        type="number"
                        step={10}
                        value={draft[axis]}
                        onChange={(e) => setAxis(axis, +e.target.value || 0)}
                        onBlur={commit}
                        onKeyDown={(e) => e.key === "Enter" && commit()}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>,
          sidebar,
        )}
    </>
  );
}
