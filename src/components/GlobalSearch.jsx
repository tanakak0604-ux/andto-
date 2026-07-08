import React, { useState, useRef, useEffect } from "react";
import { C } from "../constants";

// 全体検索モーダル（Ctrl+K / ヘッダーの🔍から）
// プロジェクト・タスク・議事録・決定事項を横断検索し、クリックでそのプロジェクトへ移動
function GlobalSearch({ projects, open, onClose, onNavigate }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);

  useEffect(() => { if (open) { setQ(""); setSel(0); } }, [open]);
  useEffect(() => { setSel(0); }, [q]);

  if (!open) return null;

  const query = q.trim().toLowerCase();
  const results = [];
  if (query) {
    for (const p of projects) {
      if (results.length >= 30) break;
      if (p.name.toLowerCase().includes(query)) {
        results.push({ type: "プロジェクト", icon: "📁", title: p.name, sub: "", projectId: p.id, color: p.color });
      }
      for (const t of p.tasks || []) {
        if ((t.title || "").toLowerCase().includes(query)) {
          results.push({ type: "タスク", icon: "📋", title: t.title, sub: p.name, projectId: p.id, color: p.color });
        }
      }
      for (const m of p.minutes || []) {
        const inTitle = (m.title || "").toLowerCase().includes(query);
        const idx = (m.content || "").toLowerCase().indexOf(query);
        if (inTitle || idx >= 0) {
          const snippet = idx >= 0 ? "…" + (m.content || "").slice(Math.max(0, idx - 15), idx + 35).replace(/\n/g, " ") + "…" : p.name;
          results.push({ type: "議事録", icon: "📝", title: m.title || "議事録", sub: snippet, projectId: p.id, color: p.color });
        }
      }
      for (const d of p.decisions || []) {
        if ((d.text || "").toLowerCase().includes(query)) {
          results.push({ type: "決定事項", icon: "📌", title: (d.text || "").slice(0, 60), sub: p.name, projectId: p.id, color: p.color });
        }
      }
    }
  }
  const shown = results.slice(0, 30);

  const pick = (r) => { if (!r) return; onNavigate(r.projectId); onClose(); };
  const onKey = (e) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, shown.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); pick(shown[sel]); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,42,36,0.45)", zIndex: 9100, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "12vh", animation: "fadeIn 0.12s ease" }}>
      <div role="dialog" aria-modal="true" aria-label="全体検索" onClick={e => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: 14, width: 560, maxWidth: "92vw", boxShadow: "0 16px 48px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1.5px solid ${C.border}` }}>
          <span style={{ fontSize: 15 }}>🔍</span>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="プロジェクト・タスク・議事録・決定事項を検索..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", color: C.text }} />
          <span style={{ fontSize: 10, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, padding: "2px 6px", fontWeight: 700 }}>Esc</span>
        </div>
        <div ref={listRef} style={{ maxHeight: "50vh", overflowY: "auto" }}>
          {query && shown.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center", color: C.muted, fontSize: 13 }}>「{q}」に一致する結果がありません</div>
          )}
          {!query && (
            <div style={{ padding: "28px 16px", textAlign: "center", color: C.muted, fontSize: 12 }}>キーワードを入力すると全プロジェクトを横断検索します<br /><span style={{ fontSize: 11 }}>↑↓で選択、Enterで移動</span></div>
          )}
          {shown.map((r, i) => (
            <div key={i} onClick={() => pick(r)} onMouseEnter={() => setSel(i)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", background: i === sel ? C.hover : "transparent", borderLeft: i === sel ? `3px solid ${r.color || C.accent}` : "3px solid transparent" }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                {r.sub && <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</div>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: r.color || C.muted, background: `${r.color || C.muted}18`, borderRadius: 12, padding: "2px 8px", flexShrink: 0 }}>{r.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { GlobalSearch };
