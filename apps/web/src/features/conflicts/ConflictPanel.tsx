import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { parseHlc } from "@tracker/schema";
import { db } from "../../db/db";
import {
  dismissAllConflicts,
  dismissConflict,
  restoreConflict,
} from "../../db/conflictRepo";
import "../issues/panel.css";
import "./conflicts.css";

function show(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const shown = text === "" ? "(empty)" : text;
  return shown.length > 120 ? `${shown.slice(0, 120)}...` : shown;
}

function who(hlc: string): string {
  const { node, wall } = parseHlc(hlc);
  return `device ${node.slice(0, 6)} at ${new Date(wall).toLocaleTimeString()}`;
}

export function ConflictPanel({ onClose }: { onClose: () => void }) {
  const rows = useLiveQuery(
    async () => {
      const open = await db.conflicts.where("status").equals("open").toArray();
      open.sort((a, b) => b.detectedAt - a.detectedAt);

      const issueIds = Array.from(new Set(open.map((c) => c.issueId)));
      const issues = await db.issues.bulkGet(issueIds);
      const titles = new Map(
        issues.flatMap((i) => (i ? [[i.id, i.title] as const] : []))
      );

      return open.map((c) => ({
        ...c,
        issueTitle: titles.get(c.issueId) ?? "(unknown issue)",
      }));
    },
    [],
    []
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside className="panel conflict-panel" aria-label="Conflicts">
      <div className="panel-top">
        <h2>Conflicts</h2>
        <button onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      <p className="conflict-help">
        Two devices edited the same field without seeing each other. The newer
        edit was kept. You can bring back the overwritten value.
      </p>

      {rows.length === 0 && (
        <p className="conflict-empty">No open conflicts.</p>
      )}

      {rows.map((c) => (
        <section key={c.key} className="conflict-card">
          <div className="conflict-title">
            {c.issueTitle} <span className="badge">{c.field}</span>
          </div>

          <div className="conflict-side kept">
            <strong>Kept</strong>
            <div className="conflict-value">{show(c.winner.value)}</div>
            <small>{who(c.winner.hlc)}</small>
          </div>

          <div className="conflict-side lost">
            <strong>Overwritten</strong>
            <div className="conflict-value">{show(c.loser.value)}</div>
            <small>{who(c.loser.hlc)}</small>
          </div>

          <div className="conflict-actions">
            <button className="primary" onClick={() => restoreConflict(c.key)}>
              Restore overwritten value
            </button>
            <button onClick={() => dismissConflict(c.key)}>Dismiss</button>
          </div>
        </section>
      ))}

      {rows.length > 1 && (
        <button onClick={() => dismissAllConflicts()}>Dismiss all</button>
      )}
    </aside>
  );
}
