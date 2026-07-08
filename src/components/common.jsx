import React, { useState, useRef, useEffect } from "react";
import { C } from "../constants";

function PriorityDot({ p }) {
  const c = p === "high" ? C.accent : p === "medium" ? C.doing : C.muted;
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />;
}

function StatusBadge({ s }) {
  const m = { todo: ["未着手", C.todoLight, C.todo], doing: ["進行中", C.doingLight, C.doing], done: ["完了", C.doneLight, C.done] }[s];
  return <span style={{ background: m[1], color: m[2], fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{m[0]}</span>;
}


function Toast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position:"fixed", bottom:24, right:24, background:"#333", color:"#fff", padding:"12px 20px", borderRadius:8, zIndex:9999, fontSize:13, boxShadow:"0 4px 12px rgba(0,0,0,0.2)", display:"flex", alignItems:"center", gap:10 }}>
      <span>🔄 {message}</span>
      <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#aaa", cursor:"pointer", fontSize:14, padding:0 }}>✕</button>
    </div>
  );
}


export { PriorityDot, StatusBadge, Toast };
