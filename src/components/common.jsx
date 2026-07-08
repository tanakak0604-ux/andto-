import React, { useState, useRef, useEffect } from "react";
import { BTN, C } from "../constants";

function PriorityDot({ p }) {
  const c = p === "high" ? C.accent : p === "medium" ? C.doing : C.muted;
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />;
}

function StatusBadge({ s }) {
  const m = { todo: ["未着手", C.todoLight, C.todo], doing: ["進行中", C.doingLight, C.doing], done: ["完了", C.doneLight, C.done] }[s];
  return <span style={{ background: m[1], color: m[2], fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{m[0]}</span>;
}


function Toast({ message, onClose }) {
  // message: 文字列、または { text, actionLabel, onAction }（Undo付きトースト）
  const isObj = typeof message === "object" && message !== null;
  const text = isObj ? message.text : message;
  const hasAction = isObj && message.actionLabel;
  useEffect(() => { const t = setTimeout(onClose, hasAction ? 6000 : 3000); return () => clearTimeout(t); }, [onClose, hasAction]);
  return (
    <div style={{ position:"fixed", bottom:24, right:24, background:"#333", color:"#fff", padding:"12px 20px", borderRadius:8, zIndex:9999, fontSize:13, boxShadow:"0 4px 12px rgba(0,0,0,0.2)", display:"flex", alignItems:"center", gap:10 }}>
      <span>{(hasAction || text.startsWith("⚠️")) ? text : "🔄 " + text}</span>
      {hasAction && (
        <button onClick={() => { message.onAction(); onClose(); }}
          style={{ background:"transparent", border:`1.5px solid ${C.sage}`, color:"#9FD3A8", cursor:"pointer", fontSize:12, fontWeight:700, borderRadius:6, padding:"3px 10px", whiteSpace:"nowrap" }}>
          {message.actionLabel}
        </button>
      )}
      <button aria-label="通知を閉じる" onClick={onClose} style={{ background:"transparent", border:"none", color:"#aaa", cursor:"pointer", fontSize:14, padding:0 }}>✕</button>
    </div>
  );
}


// アプリ内の削除確認モーダル（window.confirmの置き換え）
function ConfirmDialog({ open, title, message, confirmLabel = "削除する", onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{ position:"fixed", inset:0, background:"rgba(45,42,36,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9000, animation:"fadeIn 0.15s ease" }}>
      <div role="dialog" aria-modal="true" aria-label={title || "確認"} onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:14, padding:"22px 24px", width:380, maxWidth:"88vw", boxShadow:"0 12px 40px rgba(0,0,0,0.2)" }}>
        {title && <div style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:8 }}>{title}</div>}
        <div style={{ fontSize:13, color:C.muted, lineHeight:1.7, marginBottom:18 }}>{message}</div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <button onClick={onCancel} style={BTN.ghost}>キャンセル</button>
          <button onClick={onConfirm} autoFocus style={{ background:"#E53935", border:"none", color:"#fff", borderRadius:6, padding:"6px 16px", fontSize:13, fontWeight:600, cursor:"pointer" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export { PriorityDot, StatusBadge, Toast, ConfirmDialog };
