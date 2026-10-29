import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  getContentDelivery,
  isContentDeliveryError,
  SDK_KEY_PROBLEM,
  type AlliumPixelStreamingPlayer,
} from "@/lib/allium/content-delivery";
import { logEvent } from "@/lib/allium/event-log";
import { organization } from "@/lib/allium/allium-core";
import { ensureStreamingConfiguration } from "@/lib/allium/spaces";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import RoomDesignPanel from "@/components/RoomDesignPanel";

const FAILURES: Record<string, string> = {
  no_gpu_available:
    "No GPU is free in the configured regions right now. Try again in a minute.",
  engine_runtime_unavailable:
    "No engine image for this project's Unreal version.",
  content_not_ready: "The project version is not on a streaming volume yet.",
  region_unavailable: "None of the configured regions can stream this project.",
  room_full: "This space is full. Try again later.",
  max_session_length: "Your time in this space is up.",
};

// Refusals at sessions.create(): the space's rule in Application Configurations.
const REFUSED: Record<string, string> = {
  LOGIN_REQUIRED: "Sign in to enter this space.",
  SPACE_ACCESS_DENIED: "You don't have access to this space.",
  USER_TOKEN_INVALID:
    "Your sign-in could not be verified. Turn on Accept Allium SSO on the Content Delivery key.",
  USER_BLOCKED: "Your account is blocked on this site.",
};

type Phase = "starting" | "live" | "blocked" | "ended" | "failed";

export default function StreamPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<AlliumPixelStreamingPlayer | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [message, setMessage] = useState("Starting your stream...");
  const [attempt, setAttempt] = useState(0);
  const [player, setPlayer] = useState<AlliumPixelStreamingPlayer | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);
  const [sidebarSlot, setSidebarSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!spaceId) return;
    organization.spaces
      .getById(spaceId)
      .then((space) => {
        setOrgId(space?.orgId ?? null);
        setRoomName(space?.name ?? "");
      })
      .catch(() => setOrgId(null));
  }, [spaceId]);

  useEffect(() => {
    if (!spaceId || !stageRef.current) return;
    const stage = stageRef.current;
    let cancelled = false;
    let sessionId: string | null = null;
    setPhase("starting");
    setMessage("Starting your stream...");

    const fail = (text: string) => {
      if (cancelled) return;
      setPhase("failed");
      setMessage(text);
    };

    (async () => {
      let contentDelivery: ReturnType<typeof getContentDelivery>;
      try {
        contentDelivery = getContentDelivery();
      } catch {
        return fail(SDK_KEY_PROBLEM);
      }
      try {
        await ensureStreamingConfiguration();
        const created = await contentDelivery.sessions
          .create({ spaceId })
          .catch((err: unknown) => {
            const refusal = isContentDeliveryError(err)
              ? REFUSED[err.code]
              : undefined;
            throw refusal ? new Error(refusal) : err;
          });
        sessionId = created.id;
        if (cancelled)
          return void (await contentDelivery.sessions
            .end(created.id)
            .catch(() => {}));

        const t0 = Date.now();
        const tick = setInterval(
          () =>
            setMessage(
              `Starting your stream... ${Math.round((Date.now() - t0) / 1000)} s (a cold GPU node takes a few minutes)`,
            ),
          1000,
        );
        let ready;
        try {
          ready = await contentDelivery.sessions.waitUntilReady(created.id, {
            timeoutMs: 900_000,
          });
        } finally {
          clearInterval(tick);
        }
        if (cancelled)
          return void (await contentDelivery.sessions
            .end(ready.id)
            .catch(() => {}));
        if (ready.status !== "ready") return;
        if (ready.mode === "browser-native") {
          return fail("This space is not an Unreal pixel stream.");
        }

        // Rendered at the stage's size; destroying the player ends the session.
        const player = await contentDelivery.mount(ready, {
          parent: stage,
          matchViewport: true,
          logLevel: "warn",
        });
        if (cancelled) return void player.destroy();
        playerRef.current = player;
        setPlayer(player);
        sessionId = null;
        player.on("connected", () => logEvent("player.connected"));
        player.on("streaming", () => {
          logEvent("player.streaming");
          if (!cancelled) setPhase("live");
        });
        player.on("playRejected", () => {
          logEvent("player.playRejected", false);
          if (!cancelled) setPhase("blocked");
        });
        player.on("destroyed", () => logEvent("player.destroyed"));
        player.on("disconnected", (info) => {
          logEvent(`player.disconnected (${info.reason})`, false);
          if (cancelled) return;
          if (info.canReconnect) {
            setPhase("ended");
            setMessage("The stream ended.");
            player.destroy();
          } else setMessage(`Reconnecting... (${info.reason})`);
        });
        player.on("error", (e) => {
          logEvent(`player.error: ${e.message}`, false);
          console.warn(`player: ${e.message}`);
        });
      } catch (err) {
        const reason = isContentDeliveryError(err)
          ? (err.reason ?? err.code)
          : "";
        if (reason === "INVALID_KEY" || reason === "CONFIG")
          return fail(SDK_KEY_PROBLEM);
        fail(
          FAILURES[reason] ??
            (err instanceof Error
              ? err.message
              : "Could not start the stream."),
        );
        if (sessionId) {
          await contentDelivery.sessions.end(sessionId!).catch(() => {});
        }
      }
    })();

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      setPlayer(null);
      if (sessionId) {
        void getContentDelivery()
          .sessions.end(sessionId!)
          .catch(() => {});
      }
    };
  }, [spaceId, attempt]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-scrim">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <span className="h-5 w-px bg-border" />
        <h1 className="mb-0 min-w-0 truncate text-base font-semibold">
          {roomName || "Designer"}
        </h1>
        <div ref={setToolbarSlot} className="ml-auto flex items-center gap-2" />
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <div ref={stageRef} className="size-full" />

          {phase !== "live" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-scrim/80 px-6 text-center">
              {phase === "starting" && (
                <Loader2 className="size-10 animate-spin text-on-brand" />
              )}
              {phase === "failed" || phase === "ended" ? (
                <>
                  {phase === "failed" && (
                    <Alert variant="destructive" className="max-w-md text-left">
                      <AlertDescription>{message}</AlertDescription>
                    </Alert>
                  )}
                  {phase === "ended" && (
                    <p className="text-on-brand">{message}</p>
                  )}
                  <Button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                  >
                    Try again
                  </Button>
                </>
              ) : phase === "blocked" ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={() => playerRef.current?.play()}
                >
                  Click to start
                </Button>
              ) : (
                <p className="max-w-md text-on-brand/80">{message}</p>
              )}
            </div>
          )}
        </div>

        <aside
          ref={setSidebarSlot}
          className={
            phase === "live"
              ? "flex w-72 shrink-0 flex-col gap-3 border-l border-border bg-card p-4 text-sm"
              : "hidden"
          }
        />
      </div>

      {phase === "live" && player && orgId && spaceId && (
        <RoomDesignPanel
          player={player}
          room={{ orgId, spaceId }}
          toolbar={toolbarSlot}
          sidebar={sidebarSlot}
        />
      )}
    </div>
  );
}
