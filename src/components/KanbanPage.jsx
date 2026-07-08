import React, { useState, useRef, useEffect } from "react";
import { dueDateInfo } from "../lib/date";
import { PriorityDot } from "./common";
import { BTN, C, btn } from "../constants";
import { uid } from "../lib/text";

function TaskCard({ t, project, onUpdate, onEdit }) {
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");

  const saveSubtaskEdit = () => {
    if (editingSubtaskId === null) return;
    const updated = { ...t, subtasks: t.subtasks.map(x => x.id === editingSubtaskId ? { ...x, title: editingSubtaskTitle } : x) };
    onUpdate({ ...project, tasks: project.tasks.map(x => x.id === t.id ? updated : x) });
    setEditingSubtaskId(null);
  };

  return (
    <div draggable={editingSubtaskId === null}
      onDragStart={e => { e.dataTransfer.setData("id", t.id); e.currentTarget.style.opacity = "0.4"; }}
      onDragEnd={e => { e.currentTarget.style.opacity = "1"; }}
      onClick={() => onEdit(t)}
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 13px", cursor: "grab", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 5 }}>
        <div style={{ marginTop: 4 }}><PriorityDot p={t.priority} /></div>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{t.title}</span>
      </div>
      {t.dueDate && (() => {
        const info = dueDateInfo(t.dueDate, t.status);
        return (
          <div style={{ fontSize: 11, color: C.muted, marginLeft: 15, display: "flex", alignItems: "center", gap: 6 }}>
            📅 {t.dueDate}
            {info && <span style={{ background: info.bg, color: info.color, fontWeight: 700, fontSize: 10, padding: "1px 7px", borderRadius: 10 }}>{info.label}</span>}
          </div>
        );
      })()}
      {(t.assigneeIds || []).length > 0 && (
        <div style={{ fontSize: 11, color: C.sage, marginLeft: 15, fontWeight: 600 }}>
          👤 {(t.assigneeIds || []).map(id => project.members.find(m => m.id === id)?.name).filter(Boolean).join("・")}
        </div>
      )}
      {(t.relatedDecisionIds || []).length > 0 && (
        <div style={{ fontSize: 10, color: C.decision, marginLeft: 15, marginTop: 2, fontWeight: 600 }}>📋 決定事項 {t.relatedDecisionIds.length}件紐付き</div>
      )}
      {(t.subtasks || []).length > 0 && (() => {
        const done = (t.subtasks || []).filter(s => s.done).length;
        const total = t.subtasks.length;
        const pct = Math.round(done / total * 100);
        return (
          <div style={{ marginLeft: 15, marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <div style={{ flex: 1, height: 3, background: C.border, borderRadius: 4 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: C.sage, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 10, color: C.muted }}>{done}/{total}</span>
            </div>
            {t.subtasks.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                <div onClick={e => {
                  e.stopPropagation();
                  const updated = { ...t, subtasks: t.subtasks.map(x => x.id === s.id ? { ...x, done: !x.done } : x) };
                  onUpdate({ ...project, tasks: project.tasks.map(x => x.id === t.id ? updated : x) });
                }} style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${s.done ? C.sage : C.border}`, background: s.done ? C.sage : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {s.done && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
                </div>
                {editingSubtaskId === s.id ? (
                  <input
                    autoFocus
                    value={editingSubtaskTitle}
                    onChange={e => setEditingSubtaskTitle(e.target.value)}
                    onBlur={saveSubtaskEdit}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveSubtaskEdit(); } if (e.key === "Escape") { setEditingSubtaskId(null); } }}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    draggable={false}
                    style={{ flex: 1, border: "none", borderBottom: `1px solid ${C.sage}`, background: "transparent", fontSize: 11, color: C.text, outline: "none", padding: "0 2px" }}
                  />
                ) : (
                  <span onClick={e => { e.stopPropagation(); setEditingSubtaskId(s.id); setEditingSubtaskTitle(s.title); }} style={{ fontSize: 11, color: s.done ? C.muted : C.text, textDecoration: s.done ? "line-through" : "none", cursor: "text" }}>{s.title}</span>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

function KanbanColumn({ status, label, bg, col, project, viewTasks, onUpdate, onEdit, onOpenNew }) {
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const folderKey = status + "folders";
  const folders = project[folderKey] || [];
  const colTasks = (viewTasks ?? project.tasks).filter(t => t.status === status).sort((a, b) => {
    const pd = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    if (pd !== 0) return pd;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
  const [openFolders, setOpenFolders] = useState(() => Object.fromEntries(folders.map(f => [f.id, status !== "done"])));
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [over, setOver] = useState(null);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [dragFolderId, setDragFolderId] = useState(null);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState(null);
  const hoverBg = status === "todo" ? "#EDEBE4" : status === "doing" ? "#FFF8E1" : "#E8F5E9";

  const addFolder = () => {
    if (!newFolderName.trim()) return;
    const nf = { id: uid(), name: newFolderName.trim() };
    onUpdate({ ...project, [folderKey]: [...folders, nf] });
    setOpenFolders(s => ({ ...s, [nf.id]: true }));
    setNewFolderName(""); setAddingFolder(false);
  };

  const dropTask = (e, folderId) => {
    e.preventDefault(); setOver(null);
    // フォルダ並び替えの場合はタスクドロップしない
    const draggingFolder = e.dataTransfer.getData("folderId");
    if (draggingFolder) {
      if (draggingFolder === folderId) return;
      const from = folders.findIndex(f => f.id === draggingFolder);
      const to = folders.findIndex(f => f.id === folderId);
      if (from === -1 || to === -1) return;
      const next = [...folders];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onUpdate({ ...project, [folderKey]: next });
      setDragFolderId(null);
      return;
    }
    const taskId = e.dataTransfer.getData("id");
    if (!project.tasks.find(t => t.id === taskId)) return;
    if (folderId) setOpenFolders(s => ({ ...s, [folderId]: true })); // ドロップ先フォルダを自動展開
    onUpdate({ ...project, tasks: project.tasks.map(t => t.id === taskId ? {
      ...t, status, folderId: folderId || null,
      completedAt: status === "done" ? (t.completedAt || new Date().toISOString()) : t.completedAt
    } : t) });
  };

  const unfoldered = colTasks.filter(t => !t.folderId || !folders.find(f => f.id === t.folderId));

  return (
    <div style={{ flex: 1, minWidth: 240, background: bg, borderRadius: 16, padding: 16, border: `1.5px solid ${C.border}` }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => dropTask(e, null)}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 800, color: col, fontSize: 12, letterSpacing: 1 }}>{label}</span>
          <span style={{ background: col, color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "2px 8px", lineHeight: 1.4 }}>{colTasks.length}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => onOpenNew(status)} style={btn({ color: col, fontSize: 18, fontWeight: 700, background: "transparent", padding: 0, lineHeight: 1 })}>+</button>
          <button onClick={() => setAddingFolder(true)} style={btn({ fontSize: 14, color: col, background: "transparent" })}>📁+</button>
        </div>
      </div>
      {addingFolder && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addFolder(); if (e.key === "Escape") setAddingFolder(false); }}
            placeholder="フォルダ名" style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "5px 9px", fontSize: 12, background: "#fff", outline: "none" }} />
          <button onClick={addFolder} style={btn({ padding: "5px 10px", borderRadius: 8, background: col, color: "#fff", fontSize: 12 })}>追加</button>
          <button aria-label="キャンセル" onClick={() => setAddingFolder(false)} style={btn({ padding: "5px 8px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12 })}>✕</button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {folders.map(folder => {
          const folderTasks = colTasks.filter(t => t.folderId === folder.id);
          const isOpen = openFolders[folder.id] !== false;
          return (
            <div key={folder.id}
              onDragOver={e => { e.preventDefault(); setOver(folder.id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
              onDrop={e => { e.stopPropagation(); dropTask(e, folder.id); }}
              style={{ background: dragFolderId === folder.id ? "transparent" : over === folder.id ? hoverBg : "#fff", borderRadius: 10, border: `1.5px solid ${dragFolderId && over === folder.id ? col : over === folder.id && !dragFolderId ? col : C.border}`, overflow: "hidden", opacity: dragFolderId === folder.id ? 0.4 : 1, transition: "opacity 0.15s" }}>
              <div draggable={editingFolderId !== folder.id}
                onDragStart={e => { e.dataTransfer.setData("folderId", folder.id); e.dataTransfer.effectAllowed = "move"; setDragFolderId(folder.id); }}
                onDragEnd={() => setDragFolderId(null)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: editingFolderId === folder.id ? "default" : "grab" }}>
                <span onClick={() => setOpenFolders(s => ({ ...s, [folder.id]: !s[folder.id] }))} style={{ fontSize: 13, cursor: "pointer" }}>{isOpen ? "📂" : "📁"}</span>
                {editingFolderId === folder.id ? (
                  <>
                    <input autoFocus value={editFolderName}
                      onChange={e => setEditFolderName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") { if (editFolderName.trim()) onUpdate({ ...project, [folderKey]: folders.map(f => f.id === folder.id ? { ...f, name: editFolderName.trim() } : f) }); setEditingFolderId(null); }
                        if (e.key === "Escape") setEditingFolderId(null);
                      }}
                      onBlur={() => { if (editFolderName.trim()) onUpdate({ ...project, [folderKey]: folders.map(f => f.id === folder.id ? { ...f, name: editFolderName.trim() } : f) }); setEditingFolderId(null); }}
                      style={{ flex: 1, border: `1.5px solid ${C.sage}`, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 700, color: C.text, outline: "none" }} />
                    <button aria-label="フォルダを削除" onMouseDown={e => { e.preventDefault(); setConfirmDeleteFolderId(folder.id); setEditingFolderId(null); }}
                      style={btn({ color: C.muted, background: "transparent", fontSize: 13, padding: "2px 4px" })}>✕</button>
                  </>
                ) : (
                  <span onDoubleClick={() => { setEditingFolderId(folder.id); setEditFolderName(folder.name); }}
                    onClick={() => setOpenFolders(s => ({ ...s, [folder.id]: !s[folder.id] }))}
                    style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text, cursor: "pointer" }}>{folder.name}</span>
                )}
                <span style={{ fontSize: 11, color: C.muted }}>{folderTasks.length}件</span>
                <span onClick={() => setOpenFolders(s => ({ ...s, [folder.id]: !s[folder.id] }))} style={{ fontSize: 11, color: C.muted, cursor: "pointer" }}>{isOpen ? "▲" : "▼"}</span>
              </div>
              {isOpen && (
                <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 6 }} onDragOver={e => e.preventDefault()}>
                  {folderTasks.length === 0 && <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "10px 0" }}>タスクをここにドロップ</div>}
                  {folderTasks.map(t => <TaskCard key={t.id} t={t} project={project} onUpdate={onUpdate} onEdit={onEdit} />)}
                </div>
              )}
            </div>
          );
        })}
        <div
          onDragOver={e => { e.preventDefault(); setOver("__unfoldered__"); }}
          onDragLeave={() => setOver(null)}
          onDrop={e => { e.stopPropagation(); dropTask(e, null); }}
          style={{ display:"flex", flexDirection:"column", gap:6, padding:"6px 8px", borderRadius:10, border:`1.5px dashed ${over==="__unfoldered__" ? col : folders.length > 0 ? C.border : "transparent"}`, background: over==="__unfoldered__" ? hoverBg : "transparent", minHeight: folders.length > 0 ? 80 : 36, transition:"background 0.15s, border 0.15s" }}>
          {folders.length > 0 && <div style={{ fontSize:11, color:C.muted, fontWeight:600 }}>📂 未分類</div>}
          {unfoldered.length === 0 && folders.length > 0 && (
            <div style={{ fontSize:11, color: over==="__unfoldered__" ? col : C.muted, textAlign:"center", padding:"8px 0" }}>タスクをここにドロップ</div>
          )}
          {colTasks.length === 0 && folders.length === 0 && (
            <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"20px 0", lineHeight:1.8 }}>
              タスクがありません<br /><span style={{ fontSize:11 }}>＋ で追加</span>
            </div>
          )}
          {unfoldered.map(t => <TaskCard key={t.id} t={t} project={project} onUpdate={onUpdate} onEdit={onEdit} />)}
        </div>
      </div>
      {confirmDeleteFolderId && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }} onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmDeleteFolderId(null);}}>
          <div style={{ background:C.surface, borderRadius:16, padding:24, width:340, boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:8 }}>フォルダを削除しますか？</div>
            <div style={{ fontSize:13, color:C.muted, marginBottom:20, lineHeight:1.6 }}>「{folders.find(f=>f.id===confirmDeleteFolderId)?.name}」を削除します。フォルダ内のタスクは未分類に移動します。</div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>setConfirmDeleteFolderId(null)} style={btn({padding:"7px 16px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:12,fontWeight:700})}>キャンセル</button>
              <button onClick={()=>{ onUpdate({ ...project, [folderKey]: folders.filter(f=>f.id!==confirmDeleteFolderId), tasks: project.tasks.map(t=>t.folderId===confirmDeleteFolderId?{...t,folderId:null}:t) }); setConfirmDeleteFolderId(null); }} style={btn({padding:"7px 16px",borderRadius:8,background:"#E53935",color:"#fff",fontSize:12,fontWeight:700})}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanPage({ project, onUpdate }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [assigneeFilter, setAssigneeFilter] = useState("all"); // all | andto | other
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState(null);

  const openNew = (status) => { setForm({ id: uid(), title: "", status, dueDate: "", priority: "medium", desc: "", assigneeIds: [], subtasks: [], relatedDecisionIds: [], createdAt: new Date().toISOString() }); setModal({ isNew: true }); };
  const openEdit = (t) => { setForm({ ...t }); setModal({ isNew: false }); };
  const openReviewEdit = (t) => { setForm({ ...t, needsReview: false }); setModal({ isNew: false }); };
  const closeModal = () => { setModal(null); };
  const save = () => {
    if (!form.title.trim()) return;
    const tasks = modal.isNew ? [...project.tasks, form] : project.tasks.map(t => t.id === form.id ? form : t);
    onUpdate({ ...project, tasks }); closeModal();
  };
  const closeWithSave = () => {
    if (!form.title || !form.title.trim()) { closeModal(); return; }
    const tasks = modal.isNew ? [...project.tasks, form] : project.tasks.map(t => t.id === form.id ? form : t);
    onUpdate({ ...project, tasks }); closeModal();
  };
  const confirmTask = (taskId) => {
    onUpdate({ ...project, tasks: project.tasks.map(t => t.id === taskId ? { ...t, needsReview: false } : t) });
  };
  const del = () => { onUpdate({ ...project, tasks: project.tasks.filter(t => t.id !== form.id) }); closeModal(); };

  const memberAndtoIds = new Set((project.members || []).filter(m => m.isAndto).map(m => m.id));
  const memberOtherIds = new Set((project.members || []).filter(m => !m.isAndto).map(m => m.id));
  const viewTasks = (project.tasks || []).filter(t => {
    if (assigneeFilter === "all") return true;
    const ids = t.assigneeIds || [];
    if (assigneeFilter === "andto") return ids.some(id => memberAndtoIds.has(id));
    if (assigneeFilter === "other") return ids.some(id => memberOtherIds.has(id));
    return true;
  });

  const reviewTasks = (project.tasks || []).filter(t => t.needsReview);

  return (
    <div style={{ padding: 24 }}>
      {reviewTasks.length > 0 && (
        <div style={{ background:"#FFFDE7", border:"1.5px solid #FF9800", borderLeft:"5px solid #FF9800", borderRadius:10, padding:"14px 18px", marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:800, color:"#E65100", marginBottom:10 }}>⚠️ Slackから自動登録されたタスク（確認してください）</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {reviewTasks.map(t => {
              const assigneeNames = (t.assigneeIds||[]).map(id => (project.members||[]).find(m=>m.id===id)?.name).filter(Boolean).join("、");
              return (
                <div key={t.id} style={{ background:"#fff", borderRadius:8, border:"1px solid #FFE082", padding:"10px 14px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                  <span style={{ fontSize:16 }}>🔔</span>
                  <div style={{ flex:1, minWidth:120 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#333" }}>{t.title}</div>
                    <div style={{ fontSize:11, color:"#888", marginTop:2, display:"flex", gap:10, flexWrap:"wrap" }}>
                      {assigneeNames && <span>👤 {assigneeNames}</span>}
                      {t.dueDate && <span>📅 {t.dueDate}</span>}
                      {t.priority && <span style={{ color:t.priority==="high"?"#E53935":t.priority==="low"?"#78909C":"#FB8C00" }}>{t.priority==="high"?"🔴 高":t.priority==="low"?"🟢 低":"🟡 中"}</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <button onClick={()=>openReviewEdit(t)} style={btn({padding:"5px 12px",borderRadius:6,background:"#FB8C00",color:"#fff",fontSize:12,fontWeight:700})}>✏️ 編集して確認</button>
                    <button onClick={()=>confirmTask(t.id)} style={btn({padding:"5px 12px",borderRadius:6,background:"#4A9B8E",color:"#fff",fontSize:12,fontWeight:700})}>✅ このまま確認済みに</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { key: "all", label: "全て" },
          { key: "andto", label: "andto" },
          { key: "other", label: "その他" },
        ].map(x => {
          const active = assigneeFilter === x.key;
          return (
            <button
              key={x.key}
              type="button"
              onClick={() => setAssigneeFilter(x.key)}
              style={btn({
                padding: "7px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                border: `1.5px solid ${active ? C.sage : C.border}`,
                background: active ? C.sageLight : C.surface,
                color: active ? C.sage : C.muted,
              })}
            >
              {x.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
        <KanbanColumn status="todo" label="未着手" bg={C.todoLight} col={C.todo} project={project} viewTasks={viewTasks} onUpdate={onUpdate} onEdit={openEdit} onOpenNew={openNew} />
        <KanbanColumn status="doing" label="進行中" bg={C.doingLight} col={C.doing} project={project} viewTasks={viewTasks} onUpdate={onUpdate} onEdit={openEdit} onOpenNew={openNew} />
        <KanbanColumn status="done" label="完了" bg={C.doneLight} col={C.done} project={project} viewTasks={viewTasks} onUpdate={onUpdate} onEdit={openEdit} onOpenNew={openNew} />
      </div>
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onMouseDown={e=>{if(e.target===e.currentTarget)closeWithSave();}}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 800, color: C.text }}>{modal.isNew ? "タスク追加" : "タスク編集"}</h3>
            {[["タイトル", "title", "text"], ["期日", "dueDate", "date"]].map(([lbl, key, type]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>{lbl}</label>
                <input type={type} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "8px 11px", fontSize: 13, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            {[["ステータス", "status", [["todo","未着手"],["doing","進行中"],["done","完了"]]], ["優先度", "priority", [["high","高"],["medium","中"],["low","低"]]]].map(([lbl, key, opts]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>{lbl}</label>
                <select value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value, ...(key === "status" ? { folderId: null } : {}) }))}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "8px 11px", fontSize: 13, background: C.bg, color: C.text, outline: "none" }}>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
            {(() => {
              const folderKey = (form.status || "todo") + "folders";
              const folders = project[folderKey] || [];
              if (folders.length === 0) return null;
              return (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>フォルダ</label>
                  <select value={form.folderId || ""} onChange={e => setForm(f => ({ ...f, folderId: e.target.value || null }))}
                    style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "8px 11px", fontSize: 13, background: C.bg, color: C.text, outline: "none" }}>
                    <option value="">未分類</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              );
            })()}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>担当者</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {project.members.length === 0 ? <span style={{ fontSize: 12, color: C.muted }}>メンバー未登録</span>
                  : project.members.map(m => {
                    const selected = (form.assigneeIds || []).includes(m.id);
                    return (
                      <button key={m.id} type="button" onClick={() => setForm(f => ({ ...f, assigneeIds: selected ? (f.assigneeIds||[]).filter(id => id !== m.id) : [...(f.assigneeIds||[]), m.id] }))}
                        style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${selected ? C.sage : C.border}`, background: selected ? C.sageLight : C.bg, color: selected ? C.sage : C.muted }}>
                        {selected ? "✓ " : ""}{m.name}
                      </button>
                    );
                  })}
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>メモ</label>
              <textarea value={form.desc || ""} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} rows={10}
                style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "8px 11px", fontSize: 12, background: C.bg, color: C.text, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>
                サブタスク {(form.subtasks||[]).length > 0 && <span style={{ color: C.sage }}>({(form.subtasks||[]).filter(s=>s.done).length}/{(form.subtasks||[]).length})</span>}
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                {(form.subtasks||[]).map((s,i) => (
                  <div key={s.id}
                    draggable={false}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const from = parseInt(e.dataTransfer.getData("subtaskIdx"));
                      if (from === i || isNaN(from)) return;
                      setForm(f => { const subs = [...f.subtasks]; const [moved] = subs.splice(from, 1); subs.splice(i, 0, moved); return { ...f, subtasks: subs }; });
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    {/* ドラッグハンドルのみドラッグ可能 */}
                    <span
                      draggable
                      onDragStart={e => { e.dataTransfer.setData("subtaskIdx", String(i)); e.dataTransfer.effectAllowed = "move"; e.currentTarget.closest('[data-subtask-row]') && (e.currentTarget.closest('[data-subtask-row]').style.opacity = "0.4"); e.currentTarget.parentElement.style.opacity = "0.4"; }}
                      onDragEnd={e => { e.currentTarget.parentElement.style.opacity = "1"; }}
                      style={{ color: C.border, fontSize: 15, userSelect: "none", cursor: "grab", flexShrink: 0, padding: "0 2px", lineHeight: 1, display: "flex", alignItems: "center" }}>⠿</span>
                    <input type="checkbox" checked={s.done} onChange={() => setForm(f => ({ ...f, subtasks: f.subtasks.map((x,j) => j===i ? {...x,done:!x.done} : x) }))} style={{ width: 14, height: 14, cursor: "pointer", accentColor: C.sage, flexShrink: 0, margin: 0, display: "block" }} />
                    {/* テキスト入力（ドラッグ不可・選択可） */}
                    <div draggable={false} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }} onMouseDown={e => e.stopPropagation()}>
                      <input value={s.title} onChange={e => setForm(f => ({ ...f, subtasks: f.subtasks.map((x,j) => j===i ? {...x,title:e.target.value} : x) }))}
                        data-subtask-id={s.id}
                        draggable={false}
                        onDragStart={e => e.preventDefault()}
                        onMouseDown={e => e.stopPropagation()}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const next = (form.subtasks||[])[i+1];
                            if (next) {
                              setTimeout(() => { document.querySelector(`[data-subtask-id="${next.id}"]`)?.focus(); }, 0);
                            } else {
                              const nid = uid();
                              setForm(f => ({ ...f, subtasks: [...(f.subtasks||[]), { id: nid, title: '', done: false }] }));
                              setTimeout(() => { document.querySelector(`[data-subtask-id="${nid}"]`)?.focus(); }, 50);
                            }
                          }
                        }}
                        style={{ width: "100%", border: "none", background: "transparent", fontSize: 12, color: s.done ? C.muted : C.text, outline: "none", textDecoration: s.done ? "line-through" : "none", userSelect: "text", WebkitUserSelect: "text", cursor: "text", boxSizing: "border-box", padding: 0, lineHeight: "normal" }} />
                    </div>
                    <button aria-label="サブタスクを削除" onClick={() => setForm(f => ({ ...f, subtasks: f.subtasks.filter((_,j) => j!==i) }))} style={btn({ color: C.muted, fontSize: 14, background: "transparent" })}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setForm(f => ({ ...f, subtasks: [...(f.subtasks||[]), { id: uid(), title: "", done: false }] }))}
                style={btn({ fontSize: 12, color: C.muted, border: `1.5px dashed ${C.border}`, borderRadius: 8, padding: "5px 12px", background: "transparent", width: "100%" })}>
                + サブタスクを追加
              </button>
            </div>
            {form.createdAt && (
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>
                🕐 作成日時：{new Date(form.createdAt).toLocaleString("ja-JP", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" })}
              </div>
            )}
            {(project.decisions || []).length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>📋 関連する決定事項</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 150, overflowY: "auto" }}>
                  {(project.decisions || []).map(d => {
                    const sel = (form.relatedDecisionIds || []).includes(d.id);
                    return (
                      <button key={d.id} type="button"
                        onClick={() => setForm(f => ({ ...f, relatedDecisionIds: sel ? (f.relatedDecisionIds||[]).filter(id=>id!==d.id) : [...(f.relatedDecisionIds||[]), d.id] }))}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:8, border:`1.5px solid ${sel?C.decision:C.border}`, background:sel?C.decisionLight:C.bg, cursor:"pointer", textAlign:"left" }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:sel?C.decision:C.muted, flexShrink:0 }} />
                        <span style={{ fontSize:12, color:sel?C.decision:C.text, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {!modal.isNew && <button onClick={() => setConfirmDeleteTaskId(form.id)} style={BTN.danger}>削除</button>}
              <button onClick={closeModal} style={BTN.ghost}>キャンセル</button>
              <button onClick={save} style={BTN.primary}>保存</button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteTaskId && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }} onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmDeleteTaskId(null);}}>
          <div style={{ background:C.surface, borderRadius:16, padding:24, width:340, boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:8 }}>タスクを削除しますか？</div>
            <div style={{ fontSize:13, color:C.muted, marginBottom:20, lineHeight:1.6 }}>「{(project.tasks||[]).find(t=>t.id===confirmDeleteTaskId)?.title}」を削除します。この操作は取り消せません。</div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>setConfirmDeleteTaskId(null)} style={BTN.ghost}>キャンセル</button>
              <button onClick={()=>{ del(); setConfirmDeleteTaskId(null); }} style={BTN.danger}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export { TaskCard, KanbanColumn, KanbanPage };
