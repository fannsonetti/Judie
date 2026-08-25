import { useEffect, useMemo, useRef, useState } from "react";
import { WidgetSize } from "../types/widgets";
import { SlopLayer } from "./render";
import {
  CANONICAL,
  duplicateNode,
  EDITOR_GRID_PX,
  moveNode,
  nodesFor,
  resizeNode,
  snapBoxToGrid,
  SlopDef,
  SlopKind,
  SlopNode,
} from "./schema";
import { ContextMenu, MenuItem } from "./ContextMenu";
import { PreviewHome } from "./PreviewHome";
import { novaShellSize, NOVA_FRAME, NOVA_SAFE_BOTTOM, NOVA_STATUS_H, novaPagePad, liveFrame } from "../lib/widgetGrid";
import { svgFromFile } from "./svg";

type Handle = "nw" | "ne" | "sw" | "se";

export interface CanvasActions {
  onAdd: (kind: SlopKind, xPct: number, yPct: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: (xPct: number, yPct: number) => void;
  onBringFront: () => void;
  onSendBack: () => void;
  onDropSvg: (svg: string, xPct: number, yPct: number, nodeId: string | null) => void;
  canPaste: boolean;
}

interface Props {
  def: SlopDef;
  size: WidgetSize;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNodes: (nodes: SlopNode[], size: WidgetSize) => void;
  showGrid: boolean;
  preview?: boolean;
  zoom?: number;
  onFitZoom?: (zoom: number) => void;
  actions: CanvasActions;
}

function pickNodeAt(nodes: SlopNode[], x: number, y: number): SlopNode | null {
  const hits = nodes.filter(
    (n) => x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h
  );
  if (!hits.length) return null;
  hits.sort((a, b) => a.w * a.h - b.w * b.h);
  return hits[0];
}

function pctPoint(
  el: HTMLElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * 100,
    y: ((clientY - r.top) / r.height) * 100,
  };
}

function guidesFor(nodes: SlopNode[], current: SlopNode, snap = 0.7) {
  const lines: { axis: "x" | "y"; at: number }[] = [];
  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;
  const edges = {
    x: [current.x, cx, current.x + current.w],
    y: [current.y, cy, current.y + current.h],
  };
  for (const other of nodes) {
    if (other.id === current.id) continue;
    const ox = [other.x, other.x + other.w / 2, other.x + other.w];
    const oy = [other.y, other.y + other.h / 2, other.y + other.h];
    for (const a of edges.x) {
      for (const b of ox) {
        if (Math.abs(a - b) <= snap) lines.push({ axis: "x", at: b });
      }
    }
    for (const a of edges.y) {
      for (const b of oy) {
        if (Math.abs(a - b) <= snap) lines.push({ axis: "y", at: b });
      }
    }
  }
  const uniq: typeof lines = [];
  for (const line of lines) {
    if (!uniq.some((u) => u.axis === line.axis && Math.abs(u.at - line.at) < 0.05)) {
      uniq.push(line);
    }
  }
  return uniq;
}

function PixelGrid({
  width,
  height,
  stepX,
  stepY,
}: {
  width: number;
  height: number;
  stepX: number;
  stepY: number;
}) {
  const verts: number[] = [];
  const hors: number[] = [];
  for (let x = stepX; x < width; x += stepX) verts.push(x);
  for (let y = stepY; y < height; y += stepY) hors.push(y);
  const majorX = stepX * 5;
  const majorY = stepY * 5;
  return (
    <svg
      className="slop-pixel-grid"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {verts.map((x) => (
        <line
          key={`v${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          className={Math.abs(x % majorX) < 0.01 ? "major" : undefined}
        />
      ))}
      {hors.map((y) => (
        <line
          key={`h${y}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          className={Math.abs(y % majorY) < 0.01 ? "major" : undefined}
        />
      ))}
    </svg>
  );
}

export function SlopCanvas({
  def,
  size,
  selectedId,
  onSelect,
  onNodes,
  showGrid,
  preview = false,
  zoom = 1,
  onFitZoom,
  actions,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(NOVA_FRAME);
  const canon = CANONICAL[size];
  const shell = novaShellSize(size, frame);
  const [fitZoom, setFitZoom] = useState(1);
  const [guides, setGuides] = useState<{ axis: "x" | "y"; at: number }[]>([]);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    nodeId: string | null;
    pct: { x: number; y: number };
  } | null>(null);
  const [draft, setDraft] = useState<SlopNode[] | null>(null);
  const onNodesRef = useRef(onNodes);
  onNodesRef.current = onNodes;
  const drag = useRef<{
    kind: "move" | "resize";
    handle?: Handle;
    id: string;
    start: { x: number; y: number };
    origin: SlopNode;
    nodes: SlopNode[];
    last: SlopNode[];
    dirty: boolean;
    size: WidgetSize;
    lastPoint: { x: number; y: number };
  } | null>(null);

  const storeNodes = nodesFor(def, size);
  const nodes = draft ?? storeNodes;
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    const sync = () => setFrame(liveFrame());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const pad = 48;
      const live = liveFrame();
      if (preview) {
        setFitZoom(Math.min(1, (r.width - pad) / live.w, (r.height - pad) / live.h));
      } else {
        const liveShell = novaShellSize(size, live);
        setFitZoom(Math.min((r.width - pad) / liveShell.w, (r.height - pad) / liveShell.h));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [preview, size]);

  const displayScale = preview ? fitZoom : zoom;

  useEffect(() => {
    onFitZoom?.(fitZoom);
  }, [fitZoom, onFitZoom]);

  useEffect(() => {
    setDraft(null);
  }, [def.id, size]);

  const snapNode = (node: SlopNode, snap: boolean) =>
    snap ? { ...node, ...snapBoxToGrid(node, canon) } : node;

  const applyDrag = (clientX: number, clientY: number, snap: boolean) => {
    const face = faceRef.current;
    const d = drag.current;
    if (!face || !d) return;
    d.lastPoint = { x: clientX, y: clientY };
    const p = pctPoint(face, clientX, clientY);
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    let next = d.origin;
    if (d.kind === "move") {
      next = snapNode(moveNode(d.origin, dx, dy), snap);
    } else {
      const o = d.origin;
      let x = o.x;
      let y = o.y;
      let w = o.w;
      let h = o.h;
      if (d.handle === "se") {
        w = o.w + dx;
        h = o.h + dy;
      } else if (d.handle === "ne") {
        w = o.w + dx;
        y = o.y + dy;
        h = o.h - dy;
      } else if (d.handle === "sw") {
        x = o.x + dx;
        w = o.w - dx;
        h = o.h + dy;
      } else {
        x = o.x + dx;
        y = o.y + dy;
        w = o.w - dx;
        h = o.h - dy;
      }
      next = snapNode(resizeNode(o, { x, y, w: Math.max(2, w), h: Math.max(1, h) }), snap);
    }
    setGuides(snap ? guidesFor(d.nodes, next) : []);
    const last = d.nodes.map((n) => (n.id === d.id ? next : n));
    d.last = last;
    d.dirty = true;
    setDraft(last);
  };

  const onPointerMove = (e: PointerEvent) => {
    applyDrag(e.clientX, e.clientY, !e.shiftKey);
  };

  const onShiftToggle = (e: KeyboardEvent) => {
    if (e.key !== "Shift") return;
    const d = drag.current;
    if (!d) return;
    applyDrag(d.lastPoint.x, d.lastPoint.y, !e.shiftKey);
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    setGuides([]);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("keydown", onShiftToggle);
    window.removeEventListener("keyup", onShiftToggle);
    if (!d?.dirty) {
      setDraft(null);
      return;
    }
    const persist = d.last;
    setDraft(null);
    onNodesRef.current(persist, d.size);
  };

  const begin = (kind: "move" | "resize", node: SlopNode, e: React.PointerEvent, handle?: Handle) => {
    if (e.button === 2) return;
    e.stopPropagation();
    e.preventDefault();
    const face = faceRef.current;
    if (!face) return;
    onSelect(node.id);
    const origin = node;
    const startNodes = nodes.map((n) => (n.id === node.id ? origin : n));
    drag.current = {
      kind,
      handle,
      id: node.id,
      start: pctPoint(face, e.clientX, e.clientY),
      origin,
      nodes: startNodes,
      last: startNodes,
      dirty: false,
      size,
      lastPoint: { x: e.clientX, y: e.clientY },
    };
    setDraft(startNodes);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("keydown", onShiftToggle);
    window.addEventListener("keyup", onShiftToggle);
  };

  const openMenu = (e: React.MouseEvent, nodeId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const face = faceRef.current;
    const pct = face ? pctPoint(face, e.clientX, e.clientY) : { x: 8, y: 8 };
    if (nodeId) onSelect(nodeId);
    setMenu({ x: e.clientX, y: e.clientY, nodeId, pct });
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const svg = await svgFromFile(file);
    if (!svg) return;
    const face = faceRef.current;
    const pct = face ? pctPoint(face, e.clientX, e.clientY) : { x: 8, y: 8 };
    const hit = (e.target as HTMLElement).closest("[data-node-id]") as HTMLElement | null;
    actions.onDropSvg(svg, pct.x, pct.y, hit?.dataset.nodeId ?? null);
  };

  const pickMenu = (id: string) => {
    if (!menu) return;
    if (id.startsWith("add-")) {
      actions.onAdd(id.slice(4) as SlopKind, menu.pct.x, menu.pct.y);
      return;
    }
    if (id === "duplicate") actions.onDuplicate();
    if (id === "delete") actions.onDelete();
    if (id === "copy") actions.onCopy();
    if (id === "paste") actions.onPaste(menu.pct.x, menu.pct.y);
    if (id === "front") actions.onBringFront();
    if (id === "back") actions.onSendBack();
  };

  const menuItems: MenuItem[] = menu?.nodeId
    ? [
        { id: "duplicate", label: "Duplicate" },
        { id: "copy", label: "Copy" },
        { id: "paste", label: "Paste", disabled: !actions.canPaste },
        { id: "sep1", label: "", separator: true },
        { id: "front", label: "Bring to front" },
        { id: "back", label: "Send to back" },
        { id: "sep2", label: "", separator: true },
        { id: "delete", label: "Delete", danger: true },
      ]
    : [
        { id: "add-text", label: "Add label" },
        { id: "add-metric", label: "Add metric" },
        { id: "add-list", label: "Add list" },
        { id: "add-pair", label: "Add pair" },
        { id: "add-icon", label: "Add icon" },
        { id: "add-bar", label: "Add bar" },
        { id: "add-button", label: "Add button" },
        { id: "add-toggle", label: "Add toggle" },
        { id: "sep1", label: "", separator: true },
        { id: "paste", label: "Paste", disabled: !actions.canPaste },
      ];

  const label = useMemo(() => {
    if (preview) return "Home preview";
    return null;
  }, [preview]);

  const editing = !preview;
  const pad = novaPagePad(frame.w);

  return (
    <div
      className={`slop-stage ${preview ? "preview" : ""}`}
      ref={stageRef}
      onPointerDown={() => onSelect(null)}
      onContextMenu={(e) => {
        if (preview) {
          e.preventDefault();
          return;
        }
        openMenu(e, null);
      }}
    >
      {label && <div className="slop-stage-label">{label}</div>}
      {preview ? (
        <div
          className="slop-preview-scale"
          style={{ width: frame.w * displayScale, height: frame.h * displayScale }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="app-shell slop-preview-nova"
            style={{
              width: frame.w,
              height: frame.h,
              transform: `scale(${displayScale})`,
              transformOrigin: "top left",
            }}
          >
            <header className="status-bar">
              <div className="status-left">
                <span className="status-brand">Judie</span>
              </div>
              <div className="status-center">
                <div className="status-time">12:00</div>
                <div className="status-date">Preview</div>
              </div>
              <div className="status-right">
                <span className="status-pill">Room</span>
              </div>
            </header>
            <div
              className="slop-preview-page"
              style={{
                padding: `${4}px ${pad}px ${NOVA_SAFE_BOTTOM}px`,
                height: frame.h - NOVA_STATUS_H,
              }}
            >
              <PreviewHome def={def} size={size} />
            </div>
          </div>
        </div>
      ) : (
        <div
          className="slop-artboard-scale"
          style={{ width: shell.w * displayScale, height: shell.h * displayScale }}
          onPointerDown={(e) => e.stopPropagation()}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => void onDrop(e)}
        >
          <div
            className="widget-shell slop-artboard"
            style={{
              width: shell.w,
              height: shell.h,
              transform: `scale(${displayScale})`,
              transformOrigin: "top left",
            }}
          >
            <div ref={faceRef} className="widget-face slop-artboard-face">
              <SlopLayer
                def={{ ...def, layouts: { ...def.layouts, [size]: nodes } }}
                size={size}
                width={shell.w}
                height={shell.h}
              />
              {editing && showGrid && (
                <PixelGrid
                  width={shell.w}
                  height={shell.h}
                  stepX={EDITOR_GRID_PX * (shell.w / canon.w)}
                  stepY={EDITOR_GRID_PX * (shell.h / canon.h)}
                />
              )}
              {editing && nodes.length === 0 && (
                <div className="slop-empty">Use Add to place an element on the canvas.</div>
              )}
              {editing && (
                <div
                  className="slop-hit-layer"
                  onPointerDown={(e) => {
                    if (e.button === 2) return;
                    const p = pctPoint(e.currentTarget, e.clientX, e.clientY);
                    const node = pickNodeAt(nodes, p.x, p.y);
                    if (!node) {
                      onSelect(null);
                      return;
                    }
                    begin("move", node, e);
                  }}
                  onContextMenu={(e) => {
                    const p = pctPoint(e.currentTarget, e.clientX, e.clientY);
                    const node = pickNodeAt(nodes, p.x, p.y);
                    openMenu(e, node?.id ?? null);
                  }}
                />
              )}
              {editing && selected && (
                <div
                  className="slop-selection"
                  style={{
                    left: `${selected.x}%`,
                    top: `${selected.y}%`,
                    width: `${selected.w}%`,
                    height: `${selected.h}%`,
                  }}
                >
                  {(["nw", "ne", "sw", "se"] as Handle[]).map((h) => (
                    <span
                      key={h}
                      className={`slop-handle ${h}`}
                      onPointerDown={(e) => begin("resize", selected, e, h)}
                    />
                  ))}
                </div>
              )}
              {editing &&
                guides.map((g, i) => (
                  <div
                    key={`${g.axis}${g.at}${i}`}
                    className={`slop-guide ${g.axis}`}
                    style={g.axis === "x" ? { left: `${g.at}%` } : { top: `${g.at}%` }}
                  />
                ))}
            </div>
          </div>
        </div>
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onPick={pickMenu}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

export function nudgeSelected(
  nodes: SlopNode[],
  selectedId: string | null,
  dx: number,
  dy: number
): SlopNode[] | null {
  if (!selectedId) return null;
  const target = nodes.find((n) => n.id === selectedId);
  if (!target) return null;
  const next = moveNode(target, dx, dy);
  return nodes.map((n) => (n.id === selectedId ? next : n));
}

export function duplicateSelected(nodes: SlopNode[], selectedId: string | null) {
  const target = nodes.find((n) => n.id === selectedId);
  if (!target) return null;
  const copy = duplicateNode(target);
  return { nodes: [...nodes, copy], id: copy.id };
}

export function deleteSelected(nodes: SlopNode[], selectedId: string | null) {
  if (!selectedId) return null;
  return nodes.filter((n) => n.id !== selectedId);
}

export function bringToFront(nodes: SlopNode[], selectedId: string | null) {
  if (!selectedId) return null;
  const target = nodes.find((n) => n.id === selectedId);
  if (!target) return null;
  return [...nodes.filter((n) => n.id !== selectedId), target];
}

export function sendToBack(nodes: SlopNode[], selectedId: string | null) {
  if (!selectedId) return null;
  const target = nodes.find((n) => n.id === selectedId);
  if (!target) return null;
  return [target, ...nodes.filter((n) => n.id !== selectedId)];
}
