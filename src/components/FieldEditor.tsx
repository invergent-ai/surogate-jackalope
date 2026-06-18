import { useEffect, useRef, useState } from "react";

export type FieldKind = "text" | "num" | "enum" | "bool";
export type FieldVal = string | number | boolean;
export type Values = Record<string, FieldVal>;

export interface FieldDef {
  group: string;
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  help?: string;
  desc?: Record<string, string>;
  show?: (v: Values) => boolean;
}

// A grouped, inline label·value editor — the desktop analogue of jackalope's
// terminal FieldEditor. No dropdowns: enums cycle on click (or ←→), bools toggle,
// text/num edit inline. ▸ marks the cursor row; ↳ shows the focused field's why.
export function FieldEditor({
  schema,
  values,
  onChange,
  onLaunch,
  doneLabel = "review & launch",
  showLaunch = true,
}: {
  schema: FieldDef[];
  values: Values;
  onChange: (v: Values) => void;
  onLaunch: () => void;
  doneLabel?: string;
  showLaunch?: boolean;
}) {
  const visible = schema.filter((f) => !f.show || f.show(values));
  const launchRow = visible.length;
  const [cursor, setCursor] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [buf, setBuf] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const cur = Math.min(cursor, launchRow);
  const set = (k: string, v: FieldVal) => onChange({ ...values, [k]: v });

  const cycle = (f: FieldDef, dir: 1 | -1) => {
    const opts = f.options!;
    const i = opts.indexOf(String(values[f.key]));
    const next = i < 0 ? 0 : (i + dir + opts.length) % opts.length;
    set(f.key, opts[next]!);
  };

  const activate = (f: FieldDef) => {
    if (f.kind === "bool") set(f.key, !values[f.key]);
    else if (f.kind === "enum") cycle(f, 1);
    else {
      setBuf(String(values[f.key] ?? ""));
      setEditing(f.key);
    }
  };

  const commit = (f: FieldDef) => {
    const v = buf.trim();
    if (f.kind === "num") {
      if (v !== "") set(f.key, Number(v));
    } else set(f.key, v);
    setEditing(null);
  };

  // keyboard navigation (when the editor has focus)
  function onKey(e: React.KeyboardEvent) {
    if (editing) return; // input handles its own keys
    if (e.key === "ArrowDown") { setCursor((c) => Math.min(launchRow, c + 1)); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setCursor((c) => Math.max(0, c - 1)); e.preventDefault(); }
    else if (cur === launchRow && e.key === "Enter") { onLaunch(); }
    else {
      const f = visible[cur];
      if (!f) return;
      if (e.key === "ArrowRight" && f.kind === "enum") cycle(f, 1);
      else if (e.key === "ArrowLeft" && f.kind === "enum") cycle(f, -1);
      else if (e.key === "Enter" || (e.key === " " && f.kind === "bool")) { activate(f); e.preventDefault(); }
      else if (e.key.toLowerCase() === "g") onLaunch();
    }
  }

  useEffect(() => { rootRef.current?.focus(); }, []);

  // build grouped rows
  const rows: React.ReactNode[] = [];
  let lastGroup = "";
  visible.forEach((f, i) => {
    if (f.group !== lastGroup) {
      rows.push(<div className="fe-group" key={`g${i}`}>{f.group.toUpperCase()}</div>);
      lastGroup = f.group;
    }
    const on = i === cur;
    const isEditing = editing === f.key;
    const hint = f.kind === "bool" ? "space" : f.kind === "enum" ? "◄ ►" : "edit";
    rows.push(
      <button
        key={f.key}
        className={"fe-row" + (on ? " on" : "")}
        onClick={() => { setCursor(i); if (!isEditing) activate(f); }}
      >
        <span className="cur">{on ? "▸ " : "  "}</span>
        <span className="lbl">{f.label}</span>
        {isEditing ? (
          <input
            className="fe-edit"
            autoFocus
            value={buf}
            onChange={(e) => setBuf(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => commit(f)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(f);
              else if (e.key === "Escape") setEditing(null);
              e.stopPropagation();
            }}
          />
        ) : f.kind === "bool" ? (
          <span className={"val " + (values[f.key] ? "bool-on" : "bool-off")}>{values[f.key] ? "on" : "off"}</span>
        ) : (
          <span className={"val" + (f.kind === "enum" ? " on-enum" : "")}>{String(values[f.key] ?? "—") || "—"}</span>
        )}
        {on && !isEditing && <span className="fe-hint">{hint}</span>}
      </button>,
    );
    if (on && !isEditing && (f.kind === "enum" ? f.desc?.[String(values[f.key])] : f.help)) {
      rows.push(
        <div className="fe-desc" key={`d${i}`}>↳ {f.kind === "enum" ? f.desc![String(values[f.key])] : f.help}</div>,
      );
    }
  });

  return (
    <div className="fe" ref={rootRef} tabIndex={0} onKeyDown={onKey}>
      <div className="fe-help">
        <b>▶</b> click a value to change it · enums cycle · ⏎/g to {doneLabel.split(" ").pop()}
      </div>
      {rows}
      {showLaunch && (
        <button className={"fe-launch" + (cur === launchRow ? " on" : "")} onClick={onLaunch}>
          {doneLabel}
        </button>
      )}
    </div>
  );
}
