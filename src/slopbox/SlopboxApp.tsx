import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WidgetSize } from "../types/widgets";
import {
  ALL_WIDGET_SIZES,
  CANONICAL,
  defaultNode,
  duplicateNode,
  EDITOR_GRID_PX,
  filledSizes,
  fitTextNode,
  isTextLike,
  nodesFor,
  nudgeNodePx,
  snapBoxToGrid,
  SLOP_KINDS,
  SlopKind,
  SlopNode,
} from "./schema";
import { useSlopStore } from "./store";
import {
  SlopCanvas,
  bringToFront,
  deleteSelected,
  duplicateSelected,
  sendToBack,
} from "./Canvas";
import { SlopInspector } from "./Inspector";
import { SlopDropMenu } from "./DropMenu";
import { SlopSidebar } from "./Sidebar";
import {
  downloadText,
  exportHookCode,
  parseWidgetFile,
  serializeWidget,
  slugName,
} from "./export";
import { useCustomWidgetStore } from "../store/customWidgetStore";

interface Props {
  onClose?: () => void;
}

export function WidgetCreatorApp({ onClose }: Props) {
  const widgets = useSlopStore((s) => s.widgets);
  const selectedId = useSlopStore((s) => s.selectedId);
  const select = useSlopStore((s) => s.select);
  const setNodes = useSlopStore((s) => s.setNodes);
  const patch = useSlopStore((s) => s.patch);
  const copyLayout = useSlopStore((s) => s.copyLayout);
  const importOne = useSlopStore((s) => s.importOne);
  const publish = useCustomWidgetStore((s) => s.importOne);
  const fileRef = useRef<HTMLInputElement>(null);
  const clip = useRef<SlopNode | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  const [publishedFlash, setPublishedFlash] = useState(false);

  const current = widgets.find((w) => w.id === selectedId) ?? widgets[0] ?? null;

  useEffect(() => {
    if (!selectedId && widgets[0]) select(widgets[0].id);
  }, [selectedId, widgets, select]);
  const [size, setSize] = useState<WidgetSize>("1x2");
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [preview, setPreview] = useState(false);
  const [zoom, setZoom] = useState(1);
  const fitZoomRef = useRef(1);
  const [savedFlash, setSavedFlash] = useState(false);
  const [histTick, setHistTick] = useState(0);
  const past = useRef<SlopNode[][]>([]);
  const future = useRef<SlopNode[][]>([]);
  const skipPush = useRef(false);

  useEffect(() => {
    past.current = [];
    future.current = [];
    setNodeId(null);
    setZoom(fitZoomRef.current);
  }, [current?.id, size]);

  const zoomPct = Math.round(zoom * 100);

  const nodes = useMemo(
    () => (current ? nodesFor(current, size) : []),
    [current, size]
  );

  const commit = useCallback(
    (next: SlopNode[], push = true, forSize: WidgetSize = size) => {
      if (!current) return;
      if (forSize !== size) {
        setNodes(current.id, forSize, next);
        return;
      }
      if (push && !skipPush.current) {
        past.current = [...past.current.slice(-50), nodes];
        future.current = [];
      }
      skipPush.current = false;
      setNodes(current.id, forSize, next);
      setHistTick((n) => n + 1);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 700);
    },
    [current, nodes, setNodes, size]
  );

  const undo = useCallback(() => {
    if (!past.current.length) return;
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(nodes);
    skipPush.current = true;
    commit(prev, false);
  }, [commit, nodes]);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    const next = future.current.pop();
    if (!next) return;
    past.current.push(nodes);
    skipPush.current = true;
    commit(next, false);
  }, [commit, nodes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing) return;
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const result = duplicateSelected(nodes, nodeId);
        if (result) {
          const copy = result.nodes.find((n) => n.id === result.id);
          const snapped = copy
            ? result.nodes.map((n) =>
                n.id === result.id ? { ...n, ...snapBoxToGrid(n, CANONICAL[size]) } : n
              )
            : result.nodes;
          commit(snapped);
          setNodeId(result.id);
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const next = deleteSelected(nodes, nodeId);
        if (next) {
          e.preventDefault();
          commit(next);
          setNodeId(null);
        }
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        if (!nodeId) return;
        const target = nodes.find((n) => n.id === nodeId);
        if (!target) return;
        const step = e.shiftKey ? EDITOR_GRID_PX / 2 : EDITOR_GRID_PX;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const next = nudgeNodePx(target, dx, dy, CANONICAL[size]);
        commit(nodes.map((n) => (n.id === nodeId ? next : n)));
      }
      if (e.key === "Escape") setNodeId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, nodeId, nodes, redo, size, undo]);

  const addKind = (kind: SlopKind, xPct?: number, yPct?: number) => {
    if (!current) return;
    const node = defaultNode(
      kind,
      xPct ?? 8 + (nodes.length % 5) * 4,
      yPct ?? 10 + (nodes.length % 4) * 6,
      CANONICAL[size]
    );
    const snapped = { ...node, ...snapBoxToGrid(node, CANONICAL[size]) };
    commit([...nodes, snapped]);
    setNodeId(snapped.id);
  };

  const selectedNode = nodes.find((n) => n.id === nodeId) ?? null;

  const patchNode = (p: Partial<SlopNode>) => {
    if (!selectedNode) return;
    let next = { ...selectedNode, ...p };
    if (
      isTextLike(next.kind) &&
      ("text" in p || "fontSize" in p || "fontWeight" in p || "letterSpacing" in p)
    ) {
      next = fitTextNode(next, CANONICAL[size]);
    }
    commit(nodes.map((n) => (n.id === selectedNode.id ? next : n)));
  };

  const exportJson = () => {
    if (!current) return;
    downloadText(
      `${slugName(current.name)}.judie-widget.json`,
      serializeWidget(current),
      "application/json"
    );
  };

  const exportCode = () => {
    if (!current) return;
    downloadText(
      `${slugName(current.name)}.widget.ts`,
      exportHookCode(current),
      "text/plain"
    );
  };

  const saveToJudie = () => {
    if (!current) return;
    if (!filledSizes(current).length) {
      window.alert("Lay out at least one size before saving to Judie.");
      return;
    }
    publish(current);
    setPublishedFlash(true);
    window.setTimeout(() => setPublishedFlash(false), 1200);
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const def = parseWidgetFile(await file.text());
      const id = importOne(def);
      select(id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not import that file.");
    }
  };

  return (
    <div className="slop-app" onContextMenu={(e) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea")) return;
      e.preventDefault();
    }}>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,.judie-widget.json,.nova-widget.json"
        hidden
        onChange={(e) => {
          void onImportFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <SlopSidebar
        onPick={(id) => {
          select(id);
          setNodeId(null);
        }}
        onImport={() => fileRef.current?.click()}
        onClose={onClose}
      />

      <div className="slop-main">
        <header className="slop-top">
          <div className="slop-size-tabs">
            {ALL_WIDGET_SIZES.map((s) => {
              const filled = current ? nodesFor(current, s).length > 0 : false;
              return (
                <button
                  key={s}
                  type="button"
                  className={`${s === size ? "on" : ""} ${filled ? "" : "empty"}`.trim()}
                  onClick={() => setSize(s)}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <label className="slop-grid-toggle">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
            />
            Grid
          </label>
          <label className="slop-grid-toggle">
            <input
              type="checkbox"
              checked={preview}
              onChange={(e) => setPreview(e.target.checked)}
            />
            Preview
          </label>
          <div className="slop-zoom">
            <span className="slop-zoom-label">Zoom</span>
            <input
              type="range"
              className="slop-zoom-slider"
              min={25}
              max={200}
              step={5}
              value={zoomPct}
              disabled={preview}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
            />
            <span className="slop-zoom-value">{zoomPct}%</span>
            <button
              type="button"
              className="slop-zoom-btn"
              disabled={preview}
              onClick={() => setZoom(1)}
              title="Actual home-screen size"
            >
              100%
            </button>
            <button
              type="button"
              className="slop-zoom-btn"
              disabled={preview}
              onClick={() => setZoom(fitZoomRef.current)}
            >
              Fit
            </button>
          </div>
          <span className={`slop-saved ${savedFlash || publishedFlash ? "on" : ""}`}>
            {publishedFlash ? "On home library" : "Draft saved"}
          </span>
          <div className="slop-top-actions">
            <button type="button" onClick={undo} disabled={histTick >= 0 && past.current.length === 0}>
              Undo
            </button>
            <SlopDropMenu label="Add" disabled={!current || preview}>
              <div className="slop-add-grid">
                {SLOP_KINDS.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => addKind(item.kind)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </SlopDropMenu>
            <SlopDropMenu
              label="Save"
              primary
              disabled={!current}
              items={[
                { id: "judie", label: "Save to Judie" },
                { id: "json", label: "Export JSON" },
                { id: "code", label: "Export code" },
                { id: "import", label: "Import JSON" },
              ]}
              onPick={(id) => {
                if (id === "judie") saveToJudie();
                if (id === "json") exportJson();
                if (id === "code") exportCode();
                if (id === "import") fileRef.current?.click();
              }}
            />
          </div>
        </header>

        {current ? (
          <SlopCanvas
            def={current}
            size={size}
            selectedId={nodeId}
            onSelect={setNodeId}
            onNodes={(next, forSize) => commit(next, true, forSize)}
            showGrid={showGrid}
            preview={preview}
            zoom={zoom}
            onFitZoom={(fit) => {
              fitZoomRef.current = fit;
            }}
            actions={{
              onAdd: (kind, x, y) => addKind(kind, x, y),
              onDuplicate: () => {
                const result = duplicateSelected(nodes, nodeId);
                if (result) {
                  commit(
                    result.nodes.map((n) =>
                      n.id === result.id ? { ...n, ...snapBoxToGrid(n, CANONICAL[size]) } : n
                    )
                  );
                  setNodeId(result.id);
                }
              },
              onDelete: () => {
                const next = deleteSelected(nodes, nodeId);
                if (next) {
                  commit(next);
                  setNodeId(null);
                }
              },
              onCopy: () => {
                const node = nodes.find((n) => n.id === nodeId);
                if (!node) return;
                clip.current = node;
                setCanPaste(true);
              },
              onPaste: (x, y) => {
                if (!clip.current) return;
                const copy = duplicateNode({ ...clip.current, x, y });
                const snapped = { ...copy, ...snapBoxToGrid(copy, CANONICAL[size]) };
                commit([...nodes, snapped]);
                setNodeId(snapped.id);
              },
              onBringFront: () => {
                const next = bringToFront(nodes, nodeId);
                if (next) commit(next);
              },
              onSendBack: () => {
                const next = sendToBack(nodes, nodeId);
                if (next) commit(next);
              },
              onDropSvg: (svg, x, y, targetId) => {
                const target = targetId ? nodes.find((n) => n.id === targetId) : null;
                if (target?.kind === "icon") {
                  commit(
                    nodes.map((n) =>
                      n.id === targetId ? { ...n, svg, icon: "custom" } : n
                    )
                  );
                  setNodeId(targetId);
                  return;
                }
                const node = defaultNode("icon", x, y);
                const snapped = {
                  ...node,
                  ...snapBoxToGrid(node, CANONICAL[size]),
                  svg,
                  icon: "custom",
                };
                commit([...nodes, snapped]);
                setNodeId(snapped.id);
              },
              canPaste,
            }}
          />
        ) : (
          <div className="slop-stage slop-stage-empty">
            Make a widget from the left, then Save to Judie to use it on the home screen.
          </div>
        )}
      </div>

      {current && (
        <SlopInspector
          def={current}
          size={size}
          node={selectedNode}
          nodes={nodes}
          onSelect={setNodeId}
          onNode={patchNode}
          onDef={(p) => patch(current.id, p)}
          onCopyLayout={(from) => copyLayout(current.id, from, size)}
          onFront={() => {
            const next = bringToFront(nodes, nodeId);
            if (next) commit(next);
          }}
          onBack={() => {
            const next = sendToBack(nodes, nodeId);
            if (next) commit(next);
          }}
          onDelete={() => {
            const next = deleteSelected(nodes, nodeId);
            if (next) {
              commit(next);
              setNodeId(null);
            }
          }}
          preview={preview}
        />
      )}
    </div>
  );
}
