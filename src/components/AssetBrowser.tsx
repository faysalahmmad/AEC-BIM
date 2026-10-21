import { useEffect, useState, type ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AssetBrowserProps<T> {
  fetchAll: () => Promise<T[]>;
  fetchById: (id: string) => Promise<T>;
  getId: (item: T) => string;
  getThumbnail?: (item: T) => string | null | undefined;
  renderListItem: (item: T) => ReactNode;
  renderDetail: (item: T) => ReactNode;
}

export default function AssetBrowser<T>({
  fetchAll,
  fetchById,
  getId,
  getThumbnail,
  renderListItem,
  renderDetail,
}: AssetBrowserProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<T | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAll()
      .then((data) => {
        if (!cancelled) setItems(data);
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
  }, [fetchAll]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetchById(selectedId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, fetchById]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No items found.</p>;

  return (
    <div className="grid grid-cols-2 gap-6 text-left">
      <div className="grid max-h-[480px] grid-cols-2 gap-3 overflow-y-auto pr-1">
        {items.map((item) => {
          const id = getId(item);
          const thumb = getThumbnail?.(item);
          const active = id === selectedId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedId(id === selectedId ? null : id)}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border-2 border-transparent bg-muted transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                active && "border-primary shadow-lg shadow-primary/20",
              )}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ImageOff className="size-6" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                <p className="truncate text-xs font-medium text-white">{renderListItem(item)}</p>
              </div>
            </button>
          );
        })}
      </div>
      {selectedId && (
        <Card>
          <CardContent>
            {detailLoading && <p className="text-sm text-muted-foreground">Loading detail...</p>}
            {!detailLoading && detail && renderDetail(detail)}
            {!detailLoading && !detail && (
              <p className="text-sm text-muted-foreground">Could not load detail.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
