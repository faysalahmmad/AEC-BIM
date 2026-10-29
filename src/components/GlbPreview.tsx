import { createElement, useEffect, useRef, useState } from "react";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";

export const isGlb = (name: string | null | undefined) => !!name && /\.glb(\?|$)/i.test(name);

// A slowly turning 3D preview of a .glb; `interactive` lets the viewer drag and zoom it. The viewer library loads on first use, and a model
// that cannot be fetched or parsed falls back to the placeholder icon.
export default function GlbPreview({
  src,
  className,
  interactive = false,
}: {
  src: string;
  className?: string;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer")
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onError = () => setFailed(true);
    el.addEventListener("error", onError);
    return () => el.removeEventListener("error", onError);
  }, [ready]);

  if (failed || !ready) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <Box className="size-10 text-primary/60" />
      </div>
    );
  }

  return createElement("model-viewer", {
    ref,
    src,
    "auto-rotate": "",
    "interaction-prompt": "none",
    ...(interactive ? { "camera-controls": "" } : { "disable-zoom": "" }),
    "shadow-intensity": "1",
    loading: "eager",
    // In a tile the viewer only displays: the tile around it is a link.
    style: {
      width: "100%",
      height: "100%",
      pointerEvents: interactive ? "auto" : "none",
      background: "transparent",
    },
    class: className,
  });
}
