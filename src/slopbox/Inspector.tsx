import { ReactNode } from "react";
import { WidgetSize } from "../types/widgets";
import { SlopIcon, SLOP_ICONS } from "./icons";
import { ALL_WIDGET_SIZES, filledSizes, nodesFor, SLOP_KINDS, SLOP_SWATCHES, SlopDef, SlopKind, SlopNode } from "./schema";
import { sanitizeSvg } from "./svg";

interface Props {
  def: SlopDef;
  size: WidgetSize;
  node: SlopNode | null;
  onNode: (patch: Partial<SlopNode>) => void;
  onDef: (patch: Partial<SlopDef>) => void;
  onCopyLayout: (from: WidgetSize) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="slop-field">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Num({
  value,
  onChange,
  step = 0.5,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? Number(value.toFixed(1)) : 0}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function Swatches({
  value,
  onChange,
}: {
  value?: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="slop-swatches">
      {SLOP_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          className={value === c ? "on" : ""}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function toHex(value?: string) {
  if (value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    return value;
  }
  return "#f4f5f7";
}

export function SlopInspector({
  def,
  size,
  node,
  onNode,
  onDef,
  onCopyLayout,
}: Props) {
  const kindLabel = SLOP_KINDS.find((k) => k.kind === node?.kind)?.label ?? "None";
  const available = filledSizes(def);

  return (
    <aside className="slop-inspector">
      <h2>Inspector</h2>

      <div className="slop-block">
        <div className="slop-block-title">Widget</div>
        <Field label="Name">
          <input value={def.name} onChange={(e) => onDef({ name: e.target.value })} />
        </Field>
        <Field label="On home screen">
          <p className="slop-hint" style={{ margin: 0 }}>
            {available.length
              ? available.join(" · ")
              : "None yet. Add elements to a size to make it available."}
          </p>
        </Field>
        <Field label="Copy layout from">
          <div className="slop-size-toggles">
            {ALL_WIDGET_SIZES.filter((s) => s !== size && nodesFor(def, s).length > 0).map((s) => (
              <button key={s} type="button" onClick={() => onCopyLayout(s)}>
                {s}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {!node ? (
        <p className="slop-hint">Select an element on the canvas.</p>
      ) : (
        <>
          <div className="slop-block">
            <div className="slop-block-title">{kindLabel}</div>
            <Field label="Descriptor">
              <input
                value={node.descriptor ?? ""}
                placeholder="e.g. climate.indoorTemp"
                onChange={(e) => onNode({ descriptor: e.target.value })}
              />
            </Field>
            <Field label="Hook note">
              <textarea
                className="slop-hook-note"
                rows={3}
                value={node.hook ?? ""}
                placeholder="What this should bind to. Invisible on the widget, included in export."
                onChange={(e) => onNode({ hook: e.target.value })}
              />
            </Field>
            {hasText(node.kind) && (
              <Field label="Text">
                <input value={node.text ?? ""} onChange={(e) => onNode({ text: e.target.value })} />
              </Field>
            )}
            {node.kind === "icon" && (
              <>
                <div
                  className="slop-svg-drop"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (!file) return;
                    void file.text().then((text) => {
                      const svg = sanitizeSvg(text);
                      if (svg) onNode({ svg, icon: "custom" });
                    });
                  }}
                >
                  {node.svg && (
                    <div
                      className="slop-svg-preview"
                      dangerouslySetInnerHTML={{ __html: node.svg }}
                    />
                  )}
                  <span>{node.svg ? "Custom SVG on this icon" : "Drop an SVG here"}</span>
                  <label className="slop-svg-choose">
                    Choose SVG
                    <input
                      type="file"
                      accept=".svg,image/svg+xml"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        void file.text().then((text) => {
                          const svg = sanitizeSvg(text);
                          if (svg) onNode({ svg, icon: "custom" });
                        });
                      }}
                    />
                  </label>
                  {node.svg && (
                    <button
                      type="button"
                      className="slop-svg-clear"
                      onClick={() => onNode({ svg: "" })}
                    >
                      Remove SVG
                    </button>
                  )}
                </div>
                {!node.svg && (
                  <div className="slop-icon-grid">
                    {SLOP_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={node.icon === icon ? "on" : ""}
                        onClick={() => onNode({ icon, svg: "" })}
                        aria-label={icon}
                      >
                        <SlopIcon name={icon} size={16} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {(node.kind === "bar" || node.kind === "gauge") && (
              <Field label="Value">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={node.value ?? 0}
                  onChange={(e) => onNode({ value: Number(e.target.value) })}
                />
              </Field>
            )}
          </div>

          <div className="slop-block">
            <div className="slop-block-title">Type</div>
            {hasText(node.kind) && (
              <>
                <Field label="Size">
                  <Num value={node.fontSize ?? 13} step={1} onChange={(fontSize) => onNode({ fontSize })} />
                </Field>
                <Field label="Weight">
                  <div className="slop-size-toggles">
                    {[500, 600, 700].map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={(node.fontWeight ?? 600) === w ? "on" : ""}
                        onClick={() => onNode({ fontWeight: w })}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Align">
                  <div className="slop-size-toggles">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={(node.align ?? "left") === a ? "on" : ""}
                        onClick={() => onNode({ align: a })}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}
            <Field label="Color">
              <Swatches value={node.color} onChange={(color) => onNode({ color })} />
            </Field>
            {hasFill(node.kind) && (
              <Field label="Fill">
                <Swatches value={node.fill} onChange={(fill) => onNode({ fill })} />
              </Field>
            )}
            {(node.kind === "bar" || node.kind === "gauge") && (
              <Field label="Accent">
                <Swatches value={node.accent} onChange={(accent) => onNode({ accent })} />
              </Field>
            )}
            <Field label="Opacity">
              <input
                type="range"
                min={0.15}
                max={1}
                step={0.05}
                value={node.opacity ?? 1}
                onChange={(e) => onNode({ opacity: Number(e.target.value) })}
              />
            </Field>
            {hasFill(node.kind) && (
              <Field label="Radius">
                <Num value={node.radius ?? 0} step={1} onChange={(radius) => onNode({ radius })} />
              </Field>
            )}
          </div>

          <div className="slop-block">
            <div className="slop-block-title">Box</div>
            <div className="slop-xywh">
              <Field label="X">
                <Num value={node.x} onChange={(x) => onNode({ x })} />
              </Field>
              <Field label="Y">
                <Num value={node.y} onChange={(y) => onNode({ y })} />
              </Field>
              <Field label="W">
                <Num value={node.w} onChange={(w) => onNode({ w })} />
              </Field>
              <Field label="H">
                <Num value={node.h} onChange={(h) => onNode({ h })} />
              </Field>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function hasText(kind: SlopKind) {
  return kind === "text" || kind === "metric" || kind === "button" || kind === "chip" || kind === "gauge";
}

function hasFill(kind: SlopKind) {
  return kind === "button" || kind === "chip" || kind === "box" || kind === "divider" || kind === "bar";
}
