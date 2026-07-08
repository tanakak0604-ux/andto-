import React, { useState, useRef, useEffect } from "react";
import { BTN, C, btn } from "../constants";
import { uid } from "../lib/text";

function MilestonePage({ project, onUpdate }) {
  const [form, setForm] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [viewMode, setViewMode] = useState("timeline");
  const milestones = project.milestones || [];
  const sorted = [...milestones].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });
  const save = () => {
    if (!form.name.trim()) return;
    const exists = milestones.find(m => m.id === form.id);
    const updated = exists ? milestones.map(m => m.id === form.id ? form : m) : [...milestones, form];
    onUpdate({ ...project, milestones: updated });
    setForm(null);
  };
  const toggleAchieved = (id) => {
    onUpdate({ ...project, milestones: milestones.map(m => m.id === id ? { ...m, achieved: !m.achieved } : m) });
  };
  const del = (id) => { onUpdate({ ...project, milestones: milestones.filter(m => m.id !== id) }); setConfirmDeleteId(null); };

  const renderTimeline = () => {
    const PH = ["調査企画","基本計画","基本設計","実施設計","監理","竣工"];
    const pd = project.phaseDates || {};
    const allDates = [...PH.map(p => pd[p]).filter(Boolean), ...milestones.filter(m => m.date).map(m => m.date), ...(project.events||[]).filter(e=>e.date).map(e=>e.date)].map(d => new Date(d));
    if (allDates.length === 0) return (
      <div style={{ textAlign:"center", padding:"48px 0", color:C.muted, fontSize:13 }}>日付が設定されたフェーズまたはマイルストーンがありません</div>
    );
    const minMs = Math.min(...allDates.map(d => d.getTime()));
    const maxMs = Math.max(...allDates.map(d => d.getTime()));
    const startDate = new Date(minMs); startDate.setDate(1); startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date(maxMs); endDate.setDate(1); endDate.setMonth(endDate.getMonth() + 2);
    const totalDays = (endDate - startDate) / 86400000;
    const availW = Math.max(900, window.innerWidth - 120);
    const PX = Math.max(2, Math.min(14, availW / totalDays));
    const totalW = Math.ceil(totalDays * PX);
    const toX = d => Math.round((new Date(d) - startDate) / 86400000 * PX);

    const monthLabels = [];
    const cur = new Date(startDate);
    while (cur < endDate) { monthLabels.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }

    const today = new Date(); today.setHours(0,0,0,0);

    // pd[label] は各フェーズの開始日
    // 今日がどのフェーズ期間（開始日〜次フェーズ開始日）に入るかを判定
    const validPH = PH.filter(p => pd[p]);
    let curPhaseLabel = null;
    for (let i = 0; i < validPH.length; i++) {
      const start = new Date(pd[validPH[i]]);
      const end = validPH[i + 1] ? new Date(pd[validPH[i + 1]]) : new Date("9999-12-31");
      if (today >= start && today < end) { curPhaseLabel = validPH[i]; break; }
    }

    const phBg = "#EFEFED";
    const phBd = "#C8C8C4";
    const CUR_BG = "#BFBFBB"; const CUR_BD = "#999";
    const segments = [];
    validPH.forEach((label, i) => {
      const x = toX(pd[label]);
      const nextStart = validPH[i + 1] ? toX(pd[validPH[i + 1]]) : totalW;
      const w = Math.max(nextStart - x, 28);
      const phIdx = PH.indexOf(label);
      segments.push({ label, x, w, bg: phBg, bd: phBd, cur: label === curPhaseLabel });
    });
    const todayX = toX(today);
    const datedMs = sorted.filter(m => m.date);
    const undatedMs = sorted.filter(m => !m.date);
    const datedEvents = (project.events || []).filter(e => e.date).sort((a,b) => a.date < b.date ? -1 : 1);
    const allItems = [
      ...datedMs.map(m => ({ ...m, type: 'milestone' })),
      ...datedEvents.map(e => ({ id: e.id, name: e.title, date: e.date, achieved: false, type: 'event' }))
    ].sort((a, b) => a.date < b.date ? -1 : 1);

    return (
      <div>
        <div style={{ overflowX:"auto", background:C.surface, borderRadius:12, border:`1.5px solid ${C.border}`, padding:16 }}>
          <div style={{ position:"relative", width:totalW, minWidth:totalW }}>
            {todayX >= 0 && todayX <= totalW && (
              <div style={{ position:"absolute", left:todayX, top:0, bottom:0, width:1.5, background:C.accent, zIndex:10, pointerEvents:"none" }}>
                <div style={{ position:"absolute", top:-16, left:-10, fontSize:9, fontWeight:800, color:C.accent, whiteSpace:"nowrap" }}>今日</div>
              </div>
            )}
            <div style={{ position:"relative", height:28, borderBottom:`1px solid ${C.border}`, marginBottom:10 }}>
              {monthLabels.map((ml, i) => (
                <div key={i} style={{ position:"absolute", left:toX(ml), fontSize:10, fontWeight:700, color:C.muted, whiteSpace:"nowrap", paddingLeft:3, top:6 }}>
                  {ml.getFullYear()}/{String(ml.getMonth()+1).padStart(2,"0")}
                </div>
              ))}
            </div>
            {segments.length > 0 && (
              <div style={{ position:"relative", height:36, marginBottom:14 }}>
                {segments.map((seg, i) => (
                  <div key={i} title={seg.label} style={{ position:"absolute", left:seg.x, width:Math.max(seg.w, 28), top:2, height:32, background:seg.cur?CUR_BG:seg.bg, border:`1.5px solid ${seg.cur?CUR_BD:seg.bd}`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:seg.cur?700:500, color:seg.cur?"#333":"#999", overflow:"hidden", whiteSpace:"nowrap", padding:"0 5px" }}>
                    {seg.label}
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const ITEM_W = 80, ROW_H = 58;
              const rowEnds = [];
              const itemsWithRow = allItems.map(item => {
                const x = toX(item.date);
                let rowIdx = rowEnds.findIndex(endX => x - endX >= ITEM_W / 2 + 4);
                if (rowIdx === -1) { rowIdx = rowEnds.length; rowEnds.push(x + ITEM_W / 2); }
                else rowEnds[rowIdx] = x + ITEM_W / 2;
                return { ...item, rowIdx };
              });
              const numRows = Math.max(rowEnds.length, 1);
              return (
                <div style={{ position:"relative", height: allItems.length > 0 ? numRows * ROW_H + 10 : 8, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
                  {itemsWithRow.map(item => (
                    <div key={item.id} title={item.name}
                      onClick={item.type === 'milestone' ? () => setForm({ id:item.id, name:item.name, date:item.date, achieved:item.achieved }) : undefined}
                      style={{ position:"absolute", left:toX(item.date), top: item.rowIdx * ROW_H, transform:"translateX(-50%)", display:"flex", flexDirection:"column", alignItems:"center", width:ITEM_W, cursor: item.type === 'milestone' ? "pointer" : "default" }}>
                      <div style={{ fontSize:15, opacity:item.achieved?0.35:1, lineHeight:1 }}>{item.type === 'milestone' ? '🚩' : '📅'}</div>
                      <div style={{ fontSize:9, fontWeight:700, color:item.achieved?C.muted:(item.type==='event'?C.muted:C.text), textAlign:"center", maxWidth:72, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:2, textDecoration:item.achieved?"line-through":"none" }}>{item.name}</div>
                      <div style={{ fontSize:8, color:C.muted, marginTop:1 }}>{item.date.slice(5).replace("-","/")}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
        {undatedMs.length > 0 && (
          <div style={{ marginTop:12, background:C.surface, borderRadius:12, border:`1.5px solid ${C.border}`, padding:"12px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6 }}>日付未設定</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {undatedMs.map(m => (
                <div key={m.id} style={{ fontSize:12, color:C.muted, display:"flex", alignItems:"center", gap:6, cursor:"pointer" }} onClick={() => setForm({ ...m })}>
                  <span style={{ opacity:m.achieved?0.4:1 }}>🚩</span>
                  <span style={{ textDecoration:m.achieved?"line-through":"none" }}>{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: viewMode === "timeline" ? "none" : 860 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap:"wrap", gap:8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.text }}>🚩 マイルストーン</h2>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:`1.5px solid ${C.border}` }}>
            {[["list","リスト"],["timeline","タイムライン"]].map(([mode, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={btn({ padding:"6px 14px", fontSize:12, fontWeight:700, background:viewMode===mode?C.text:"transparent", color:viewMode===mode?"#fff":C.muted, borderRadius:0 })}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setForm({ id: uid(), name: "", date: "", achieved: false })} style={btn({ padding:"6px 14px", fontSize:12, fontWeight:700, background:"#4A9B8E", color:"#fff", borderRadius:8 })}>+ 追加</button>
        </div>
      </div>
      {sorted.length === 0 && !form && (
        <div style={{ textAlign: "center", padding: "48px 0", color: C.muted, fontSize: 13 }}>マイルストーンがありません</div>
      )}
      {form && (
        <div style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 }}>マイルストーン名</div>
              <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setForm(null); }}
                placeholder="例：基本設計完了"
                style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box", outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 }}>日付</div>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={{ border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setForm(null)} style={BTN.ghost}>キャンセル</button>
              <button onClick={save} style={BTN.primary}>保存</button>
            </div>
          </div>
        </div>
      )}
      {viewMode === "timeline" ? renderTimeline() : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map(m => (
            <div key={m.id} style={{ background: C.surface, border: `1.5px solid ${m.achieved ? C.sage : C.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, opacity: m.achieved ? 0.7 : 1, transition: "opacity 0.2s" }}>
              <button onClick={() => toggleAchieved(m.id)}
                style={btn({ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${m.achieved ? C.sage : C.border}`, background: m.achieved ? C.sage : "transparent", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 })}>
                {m.achieved ? "✓" : ""}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, textDecoration: m.achieved ? "line-through" : "none" }}>🚩 {m.name}</div>
                {m.date && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>📅 {m.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1/$2/$3")}</div>}
              </div>
              <button onClick={() => setForm({ ...m })} style={btn({ padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12, fontWeight: 600 })}>編集</button>
              <button onClick={() => setConfirmDeleteId(m.id)} style={BTN.danger}>削除</button>
            </div>
          ))}
        </div>
      )}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: 340, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 8 }}>マイルストーンを削除しますか？</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>「{milestones.find(m => m.id === confirmDeleteId)?.name}」を削除します。</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDeleteId(null)} style={BTN.ghost}>キャンセル</button>
              <button onClick={() => del(confirmDeleteId)} style={{ ...BTN.danger, background: "#E53935", color: "#fff", border: "none" }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export { MilestonePage };
