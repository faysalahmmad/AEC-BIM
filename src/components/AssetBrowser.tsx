import { useEffect, useState, type ReactNode } from "react";
import "./AssetBrowser.css";

interface AssetBrowserProps<T> {
  fetchAll: () => Promise<T[]>;
  fetchById: (id: string) => Promise<T>;
  getId: (item: T) => string;
  renderListItem: (item: T) => ReactNode;
  renderDetail: (item: T) => ReactNode;
}

export default function AssetBrowser<T>({
  fetchAll,
  fetchById,
  getId,
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

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="asset-browser-error">{error}</p>;
  if (items.length === 0) return <p>No items found.</p>;

  return (
    <div className="asset-browser">
      <ul className="asset-browser-list">
        {items.map((item) => {
          const id = getId(item);
          return (
            <li key={id}>
              <button
                type="button"
                className={id === selectedId ? "active" : ""}
                onClick={() => setSelectedId(id === selectedId ? null : id)}
              >
                {renderListItem(item)}
              </button>
            </li>
          );
        })}
      </ul>
      {selectedId && (
        <div className="asset-browser-detail">
          {detailLoading && <p>Loading detail...</p>}
          {!detailLoading && detail && renderDetail(detail)}
          {!detailLoading && !detail && <p>Could not load detail.</p>}
        </div>
      )}
    </div>
  );
}
