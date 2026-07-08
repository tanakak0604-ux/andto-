import React, { useState, useRef, useEffect } from "react";
import { StatusBadge } from "./common";
import { BTN, C, btn } from "../constants";
import { uid } from "../lib/text";

function DecisionsPage({ project, onUpdate }) {
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [confirmDeleteDecisionFolderId, setConfirmDeleteDecisionFolderId] = useState(null);
  const [editingDecisionId, setEditingDecisionId] = useState(null);
  const [editingDecisionText, setEditingDecisionText] = useState("");
  const [editingDecisionSource, setEditingDecisionSource] = useState("");
  const [editingDecisionDate, setEditingDecisionDate] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showAddDecision, setShowAddDecision] = useState(false);
  const [newDecisionText, setNewDecisionText] = useState("");
  const [newDecisionSource, setNewDecisionSource] = useState("");
  const [newDecisionDate, setNewDecisionDate] = useState("");
  const [movingDecisionId, setMovingDecisionId] = useState(null);
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [renamingFolderText, setRenamingFolderText] = useState("");
  const [dragItem, setDragItem] = useState(null); // { type:'decision'|'folder', id }
  const [dragOverId, setDragOverId] = useState(null);
  const [dropSide, setDropSide] = useState('after'); // 'before'|'after'|'into'
  const [confirmDeleteDecisionId, setConfirmDeleteDecisionId] = useState(null);
  const [breadcrumbHoverId, setBreadcrumbHoverId] = useState(undefined);

  const folders = project.decisionFolders || [];
  const allDecisions = (project.decisions || []).map(d => ({ ...d, folderId: d.folderId ?? null }));

  const currentFolders = folders.filter(f => f.parentId === currentFolderId);
  const currentDecisions = allDecisions.filter(d => d.folderId === currentFolderId);

  const getBreadcrumb = (folderId) => {
    if (!folderId) return [];
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    return [...getBreadcrumb(folder.parentId), folder];
  };
  const breadcrumb = getBreadcrumb(currentFolderId);

  const countDecisions = (folderId) => {
    const direct = allDecisions.filter(d => d.folderId === folderId).length;
    const subs = folders.filter(f => f.parentId === folderId);
    return direct + subs.reduce((sum, f) => sum + countDecisions(f.id), 0);
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    const folder = { id: uid(), name: newFolderName.trim(), parentId: currentFolderId, createdAt: new Date().toISOString() };
    onUpdate({ ...project, decisionFolders: [...folders, folder] });
    setNewFolderName(""); setShowCreateFolder(false);
  };

  const addDecision = () => {
    if (!newDecisionText.trim()) return;
    const d = { id: uid(), text: newDecisionText.trim(), folderId: currentFolderId, createdAt: new Date().toISOString(), source: newDecisionSource.trim() || undefined, date: newDecisionDate || undefined };
    onUpdate({ ...project, decisions: [...allDecisions, d] });
    setNewDecisionText(""); setShowAddDecision(false);
  };

  const deleteFolder = (folderId) => {
    const newDecisions = allDecisions.map(d => d.folderId === folderId ? { ...d, folderId: currentFolderId } : d);
    onUpdate({ ...project, decisionFolders: folders.filter(f => f.id !== folderId), decisions: newDecisions });
  };

  const renameFolder = () => {
    if (!renamingFolderText.trim()) return;
    onUpdate({ ...project, decisionFolders: folders.map(f => f.id === renamingFolderId ? { ...f, name: renamingFolderText.trim() } : f) });
    setRenamingFolderId(null);
  };

  const moveDecision = (decisionId, targetFolderId) => {
    onUpdate({ ...project, decisions: allDecisions.map(d => d.id === decisionId ? { ...d, folderId: targetFolderId } : d) });
    setMovingDecisionId(null);
  };

  const saveEditDecision = () => {
    onUpdate({ ...project, decisions: allDecisions.map(d => d.id === editingDecisionId ? { ...d, text: editingDecisionText, source: editingDecisionSource.trim() || d.source, date: editingDecisionDate || d.date } : d) });
    setEditingDecisionId(null);
  };

  const deleteDecision = (id) => {
    const updatedTasks = (project.tasks || []).map(t => ({
      ...t,
      relatedDecisionIds: (t.relatedDecisionIds || []).filter(rid => rid !== id)
    }));
    onUpdate({ ...project, decisions: allDecisions.filter(d => d.id !== id), tasks: updatedTasks });
  };

  // ── Drag & Drop ──────────────────────────────────────────────
  const handleDragStart = (e, type, id) => {
    setDragItem({ type, id });
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, overId, overType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(overId);
    if (overType === 'folder') {
      setDropSide('into');
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setDropSide(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    }
  };
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null);
  };
  const handleDragEnd = () => { setDragItem(null); setDragOverId(null); };
  const handleDrop = (e, targetId, targetType) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragItem || dragItem.id === targetId) { setDragItem(null); return; }
    if (dragItem.type === 'decision') {
      if (targetType === 'folder') {
        onUpdate({ ...project, decisions: allDecisions.map(d => d.id === dragItem.id ? { ...d, folderId: targetId } : d) });
      } else {
        // reorder within current folder
        const cur = allDecisions.filter(d => d.folderId === currentFolderId);
        const rest = allDecisions.filter(d => d.folderId !== currentFolderId);
        const fromIdx = cur.findIndex(d => d.id === dragItem.id);
        const toIdx = cur.findIndex(d => d.id === targetId);
        if (fromIdx === -1 || toIdx === -1) { setDragItem(null); return; }
        const reordered = [...cur];
        const [moved] = reordered.splice(fromIdx, 1);
        const insertAt = dropSide === 'before' ? toIdx : toIdx + 1;
        reordered.splice(insertAt > fromIdx ? insertAt - 1 : insertAt, 0, moved);
        onUpdate({ ...project, decisions: [...rest, ...reordered] });
      }
    } else if (dragItem.type === 'folder') {
      if (targetType === 'folder') {
        // prevent circular: cannot drop into own descendant
        const isDesc = (fid, anc) => { if (!fid) return false; if (fid === anc) return true; const f = folders.find(x=>x.id===fid); return f ? isDesc(f.parentId, anc) : false; };
        if (isDesc(targetId, dragItem.id)) { setDragItem(null); return; }
        onUpdate({ ...project, decisionFolders: folders.map(f => f.id === dragItem.id ? { ...f, parentId: targetId } : f) });
      } else if (targetType === 'decision') {
        // reorder folders by inserting dragged folder before/after target folder is N/A here; skip
      }
    }
    setDragItem(null);
  };
  const handleBreadcrumbDrop = (targetFolderId) => {
    if (!dragItem) { setBreadcrumbHoverId(undefined); return; }
    if (dragItem.type === 'decision') {
      onUpdate({ ...project, decisions: allDecisions.map(d => d.id === dragItem.id ? { ...d, folderId: targetFolderId } : d) });
    } else if (dragItem.type === 'folder') {
      const isDesc = (fid, anc) => { if (!fid) return false; if (fid === anc) return true; const f = folders.find(x => x.id === fid); return f ? isDesc(f.parentId, anc) : false; };
      if (dragItem.id === targetFolderId || isDesc(targetFolderId, dragItem.id)) { setBreadcrumbHoverId(undefined); setDragItem(null); return; }
      onUpdate({ ...project, decisionFolders: folders.map(f => f.id === dragItem.id ? { ...f, parentId: targetFolderId } : f) });
    }
    setBreadcrumbHoverId(undefined); setDragItem(null); setDragOverId(null);
  };

  // drop onto grid container (move item to current folder)
  const handleDropOnContainer = (e) => {
    e.preventDefault();
    if (!dragItem) return;
    if (dragItem.type === 'decision') {
      onUpdate({ ...project, decisions: allDecisions.map(d => d.id === dragItem.id ? { ...d, folderId: currentFolderId } : d) });
    } else if (dragItem.type === 'folder') {
      onUpdate({ ...project, decisionFolders: folders.map(f => f.id === dragItem.id ? { ...f, parentId: currentFolderId } : f) });
    }
    setDragItem(null); setDragOverId(null);
  };

  return (
    <>
    <div style={{ overflowY:"auto", height:"calc(100dvh - 52px)", background:C.bg }}>
      {/* 移動モーダル */}
      {movingDecisionId && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }} onClick={()=>setMovingDecisionId(null)}>
          <div style={{ background:C.surface, borderRadius:16, padding:24, width:380, maxWidth:"90vw", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:14, fontWeight:800, color:C.text, marginBottom:14 }}>📁 フォルダへ移動</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:300, overflowY:"auto", marginBottom:14 }}>
              <button onClick={()=>moveDecision(movingDecisionId, null)}
                style={btn({ padding:"9px 14px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12, fontWeight:700, textAlign:"left" })}>
                📁 ルート（未分類）
              </button>
              {folders.map(f => (
                <button key={f.id} onClick={()=>moveDecision(movingDecisionId, f.id)}
                  style={btn({ padding:"9px 14px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.bg, color:C.text, fontSize:12, textAlign:"left" })}>
                  📁 {getBreadcrumb(f.parentId).map(b=>b.name).concat(f.name).join(" › ")}
                </button>
              ))}
            </div>
            <button onClick={()=>setMovingDecisionId(null)} style={btn({ padding:"8px 18px", borderRadius:8, border:`1.5px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:12, fontWeight:700 })}>キャンセル</button>
          </div>
        </div>
      )}

      <div style={{ padding:24, maxWidth:1000, margin:"0 auto" }}>
        {/* ヘッダー */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:C.text, margin:0 }}>決定事項</h2>
          <span style={{ fontSize:12, color:C.muted, background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:"2px 10px", fontWeight:700 }}>{allDecisions.length}件</span>
          <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
            <button onClick={()=>{ setShowAddDecision(v=>!v); setNewDecisionText(""); setNewDecisionSource(""); setNewDecisionDate(""); setShowCreateFolder(false); }}
              style={btn({ padding:"7px 14px", borderRadius:10, border:`1.5px solid ${showAddDecision?project.color:C.border}`, background:showAddDecision?project.color:"transparent", color:showAddDecision?"#fff":C.muted, fontSize:12, fontWeight:700 })}>
              ✏️ 決定事項を追加
            </button>
            <button onClick={()=>{ setShowCreateFolder(v=>!v); setNewFolderName(""); setShowAddDecision(false); }}
              style={btn({ padding:"7px 14px", borderRadius:10, border:`1.5px solid ${showCreateFolder?C.sage:C.border}`, background:showCreateFolder?C.sage:"transparent", color:showCreateFolder?"#fff":C.muted, fontSize:12, fontWeight:700 })}>
              📁 フォルダを作成
            </button>
          </div>
        </div>

        {/* 決定事項追加フォーム */}
        {showAddDecision && (
          <div style={{ background:C.surface, borderRadius:12, padding:14, border:`1.5px solid ${project.color}`, marginBottom:14, display:"flex", flexDirection:"column", gap:8 }}>
            <textarea autoFocus value={newDecisionText} onChange={e=>setNewDecisionText(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); addDecision(); } if(e.key==="Escape"){ setShowAddDecision(false); setNewDecisionText(""); setNewDecisionSource(""); setNewDecisionDate(""); }}}
              placeholder="決定事項を入力（Enterで保存、Shift+Enterで改行）"
              rows={3}
              style={{ border:`1.5px solid ${C.border}`, borderRadius:8, padding:"7px 12px", fontSize:13, background:C.bg, color:C.text, outline:"none", resize:"vertical" }} />
            <div style={{ display:"flex", gap:8 }}>
              <input value={newDecisionSource} onChange={e=>setNewDecisionSource(e.target.value)}
                placeholder="ソース（例：議事録、会議名）"
                style={{ flex:1, border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 10px", fontSize:12, background:C.bg, color:C.text, outline:"none" }} />
              <input type="date" value={newDecisionDate} onChange={e=>setNewDecisionDate(e.target.value)} title="決定日"
                style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 10px", fontSize:12, background:C.bg, color:C.text, outline:"none" }} />
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>{ setShowAddDecision(false); setNewDecisionText(""); setNewDecisionSource(""); setNewDecisionDate(""); }} style={btn({ padding:"6px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:12 })}>取消</button>
              <button onClick={addDecision} style={btn({ padding:"6px 18px", borderRadius:8, background:newDecisionText.trim()?project.color:C.border, color:"#fff", fontSize:12, fontWeight:700 })}>追加</button>
            </div>
          </div>
        )}

        {/* フォルダ作成フォーム */}
        {showCreateFolder && (
          <div style={{ background:C.surface, borderRadius:12, padding:12, border:`1.5px solid ${C.sage}`, marginBottom:14, display:"flex", gap:8, alignItems:"center" }}>
            <input autoFocus value={newFolderName} onChange={e=>setNewFolderName(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") createFolder(); if(e.key==="Escape"){ setShowCreateFolder(false); setNewFolderName(""); }}}
              placeholder={currentFolderId ? `「${breadcrumb[breadcrumb.length-1]?.name}」内のフォルダ名` : "フォルダ名を入力"}
              style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"7px 12px", fontSize:13, background:C.bg, color:C.text, outline:"none" }} />
            <button onClick={createFolder} style={btn({ padding:"7px 18px", borderRadius:8, background:newFolderName.trim()?C.sage:C.border, color:"#fff", fontSize:12, fontWeight:700 })}>作成</button>
            <button onClick={()=>{ setShowCreateFolder(false); setNewFolderName(""); }} style={btn({ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:12 })}>取消</button>
          </div>
        )}

        {/* パンくずリスト */}
        <div
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setBreadcrumbHoverId(undefined); }}
          style={{ display:"flex", alignItems:"center", gap:4, marginBottom:18, flexWrap:"wrap", background:C.surface, borderRadius:10, padding:"8px 14px", border:`1px solid ${C.border}` }}>
          <button onClick={()=>setCurrentFolderId(null)}
            onDragOver={e=>{ if(!dragItem) return; e.preventDefault(); setBreadcrumbHoverId(null); }}
            onDragLeave={()=>setBreadcrumbHoverId(undefined)}
            onDrop={e=>{ e.preventDefault(); e.stopPropagation(); handleBreadcrumbDrop(null); }}
            style={btn({ fontSize:12, fontWeight:700, color:currentFolderId===null?project.color:C.muted, background:breadcrumbHoverId===null?C.sageLight:"transparent", padding:"4px 8px", borderRadius:6, border:breadcrumbHoverId===null?`1.5px solid ${C.sage}`:"1.5px solid transparent", textDecoration:currentFolderId===null?"none":"underline", transition:"all 0.15s" })}>
            ルート
          </button>
          {breadcrumb.map((f, i) => (
            <React.Fragment key={f.id}>
              <span style={{ color:C.muted, fontSize:13, fontWeight:300 }}>›</span>
              <button onClick={()=>setCurrentFolderId(f.id)}
                onDragOver={e=>{ if(!dragItem) return; e.preventDefault(); setBreadcrumbHoverId(f.id); }}
                onDragLeave={()=>setBreadcrumbHoverId(undefined)}
                onDrop={e=>{ e.preventDefault(); e.stopPropagation(); handleBreadcrumbDrop(f.id); }}
                style={btn({ fontSize:12, fontWeight:700, color:i===breadcrumb.length-1?project.color:C.muted, background:breadcrumbHoverId===f.id?C.sageLight:"transparent", padding:"4px 8px", borderRadius:6, border:breadcrumbHoverId===f.id?`1.5px solid ${C.sage}`:"1.5px solid transparent", textDecoration:i===breadcrumb.length-1?"none":"underline", transition:"all 0.15s" })}>
                {f.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* コンテンツ */}
        {currentFolders.length === 0 && currentDecisions.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}>
            <div style={{ fontSize:36, marginBottom:12 }}>{currentFolderId ? "📁" : "📋"}</div>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>{currentFolderId ? "このフォルダは空です" : "決定事項がまだありません"}</div>
            {!currentFolderId && <div style={{ fontSize:12 }}>「✨ 議事録作成」タブから議事録を生成し、決定事項を抽出・保存できます。</div>}
          </div>
        ) : (
          <div onDragOver={e=>{ if(dragItem) e.preventDefault(); }} onDrop={handleDropOnContainer}
            style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:12 }}>
            {/* フォルダ */}
            {currentFolders.map(f => {
              const count = countDecisions(f.id);
              const isOver = dragOverId === f.id && dropSide === 'into';
              return (
                <div key={f.id}
                  draggable
                  onDragStart={e=>handleDragStart(e,'folder',f.id)}
                  onDragOver={e=>handleDragOver(e,f.id,'folder')}
                  onDragLeave={handleDragLeave}
                  onDrop={e=>{ e.stopPropagation(); handleDrop(e,f.id,'folder'); }}
                  onDragEnd={handleDragEnd}
                  onClick={()=>setCurrentFolderId(f.id)}
                  style={{ background:isOver?`${project.color}15`:C.surface, border:`1.5px solid ${isOver?project.color:C.border}`, borderRadius:14, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.05)", cursor:"pointer", opacity:dragItem?.id===f.id?0.4:1, transition:"border-color 0.15s, background 0.15s" }}>
                  {renamingFolderId === f.id ? (
                    <div onClick={e=>e.stopPropagation()} style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <input autoFocus value={renamingFolderText} onChange={e=>setRenamingFolderText(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter") renameFolder(); if(e.key==="Escape") setRenamingFolderId(null); }}
                        style={{ flex:1, border:`1.5px solid ${C.sage}`, borderRadius:7, padding:"5px 9px", fontSize:13, background:C.bg, color:C.text, outline:"none" }} />
                      <button onClick={renameFolder} style={btn({ padding:"4px 10px", borderRadius:7, background:C.sage, color:"#fff", fontSize:11, fontWeight:700 })}>保存</button>
                      <button onClick={()=>setRenamingFolderId(null)} style={btn({ padding:"4px 8px", borderRadius:7, background:"transparent", color:C.muted, fontSize:11, border:`1px solid ${C.border}` })}>取消</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, minWidth:0 }}>
                        <span style={{ fontSize:20 }}>📁</span>
                        <span style={{ fontSize:13, fontWeight:800, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                      </div>
                      <div onClick={e=>e.stopPropagation()} style={{ display:"flex", gap:2, flexShrink:0, marginLeft:4 }}>
                        <button onClick={()=>{ setRenamingFolderId(f.id); setRenamingFolderText(f.name); }}
                          style={btn({ padding:"3px 6px", borderRadius:6, background:"transparent", color:C.muted, fontSize:11 })}>✏️</button>
                        <button onClick={()=>setConfirmDeleteDecisionFolderId(f.id)}
                          style={btn({ padding:"3px 6px", borderRadius:6, background:"transparent", color:C.muted, fontSize:13 })}>✕</button>
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, color:C.decision, background:C.decisionLight, borderRadius:20, padding:"2px 10px", fontWeight:700 }}>{count}件</span>
                    <span style={{ fontSize:11, color:C.muted }}>クリックして開く →</span>
                  </div>
                </div>
              );
            })}
            {/* 決定事項カード */}
            {currentDecisions.map(d => {
              const isOver = dragOverId === d.id;
              const shadow = isOver && dropSide==='before' ? `inset 0 4px 0 ${project.color}` : isOver && dropSide==='after' ? `inset 0 -4px 0 ${project.color}` : "0 2px 8px rgba(0,0,0,0.05)";
              return (
              <div key={d.id}
                draggable={editingDecisionId !== d.id}
                onDragStart={e=>handleDragStart(e,'decision',d.id)}
                onDragOver={e=>handleDragOver(e,d.id,'decision')}
                onDragLeave={handleDragLeave}
                onDrop={e=>{ e.stopPropagation(); handleDrop(e,d.id,'decision'); }}
                onDragEnd={handleDragEnd}
                style={{ background:C.surface, border:`1.5px solid ${editingDecisionId===d.id?project.color:C.border}`, borderRadius:14, padding:16, boxShadow:shadow, opacity:dragItem?.id===d.id?0.4:1, transition:"box-shadow 0.1s", display:"flex", flexDirection:"column" }}>
                {editingDecisionId === d.id ? (
                  <>
                    <textarea value={editingDecisionText} onChange={e=>setEditingDecisionText(e.target.value)} rows={4} autoFocus
                      style={{ width:"100%", border:`1.5px solid ${project.color}`, borderRadius:8, padding:"8px 10px", fontSize:13, background:C.bg, color:C.text, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"inherit", lineHeight:1.7, marginBottom:8 }} />
                    <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                      <input value={editingDecisionSource} onChange={e=>setEditingDecisionSource(e.target.value)}
                        placeholder="ソース（例：議事録、会議名）"
                        style={{ flex:1, border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 10px", fontSize:12, background:C.bg, color:C.text, outline:"none" }} />
                      <input type="date" value={editingDecisionDate} onChange={e=>setEditingDecisionDate(e.target.value)}
                        style={{ border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 10px", fontSize:12, background:C.bg, color:C.text, outline:"none" }} />
                    </div>
                    <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                      <button onClick={()=>setEditingDecisionId(null)} style={btn({ padding:"5px 12px", borderRadius:7, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:12 })}>取消</button>
                      <button onClick={saveEditDecision} style={btn({ padding:"5px 14px", borderRadius:7, background:project.color, color:"#fff", fontSize:12, fontWeight:700 })}>保存</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:project.color, marginTop:5, flexShrink:0 }} />
                      <div style={{ display:"flex", gap:3 }}>
                        <button onClick={()=>setMovingDecisionId(d.id)} title="フォルダへ移動"
                          style={btn({ color:C.muted, background:"transparent", fontSize:12, padding:"2px 5px" })}>📁</button>
                        <button onClick={()=>{ setEditingDecisionId(d.id); setEditingDecisionText(d.text); setEditingDecisionSource(d.source||""); setEditingDecisionDate(d.date||""); }}
                          style={btn({ color:C.muted, background:"transparent", fontSize:12, padding:"2px 5px" })}>✏️</button>
                        <button onClick={()=>setConfirmDeleteDecisionId(d.id)}
                          style={btn({ color:C.muted, background:"transparent", fontSize:14, padding:"2px 5px" })}>✕</button>
                      </div>
                    </div>
                    <p onClick={()=>{ setEditingDecisionId(d.id); setEditingDecisionText(d.text); setEditingDecisionSource(d.source||""); setEditingDecisionDate(d.date||""); }}
                      style={{ fontSize:13, color:C.text, lineHeight:1.75, margin:"0 0 10px", fontWeight:500, cursor:"pointer", whiteSpace:"pre-wrap" }}>{d.text}</p>
                    {(() => {
                      const linked = (project.tasks || []).filter(t => (t.relatedDecisionIds || []).includes(d.id));
                      return linked.length > 0 && (
                        <div style={{ background:C.decisionLight, borderRadius:8, padding:"6px 10px", marginBottom:10 }}>
                          <div style={{ fontSize:10, color:C.decision, fontWeight:700, marginBottom:4 }}>🔗 関連タスク {linked.length}件</div>
                          {linked.map(t => (
                            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"2px 0" }}>
                              <StatusBadge s={t.status} />
                              <span style={{ fontSize:11, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{t.title}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"auto" }}>
                      <span style={{ fontSize:10, color:C.muted, fontWeight:600 }}>📝 {d.source}</span>
                      <span style={{ fontSize:10, color:C.muted }}>{new Date(d.date||d.createdAt).toLocaleDateString("ja-JP")}</span>
                    </div>
                  </>
                )}
              </div>
            ); })}
          </div>
        )}
      </div>
    </div>

      {confirmDeleteDecisionId && (() => {
        const target = allDecisions.find(d => d.id === confirmDeleteDecisionId);
        const hasLinkedTasks = (project.tasks || []).some(t => (t.relatedDecisionIds || []).includes(confirmDeleteDecisionId));
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#fff", borderRadius:16, padding:24, maxWidth:420, width:"90%", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
              <div style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:12 }}>決定事項を削除しますか？</div>
              {target && <div style={{ fontSize:13, color:C.muted, marginBottom:12, padding:"8px 12px", background:C.bg, borderRadius:8, lineHeight:1.6 }}>{target.text}</div>}
              {hasLinkedTasks && (
                <div style={{ fontSize:12, color:"#C0392B", background:"#FFF0F0", border:"1.5px solid #E07070", borderRadius:8, padding:"8px 12px", marginBottom:12, fontWeight:600 }}>
                  ⚠️ この決定事項に関連するタスクとのリンクが外れます。
                </div>
              )}
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <button onClick={()=>setConfirmDeleteDecisionId(null)} style={BTN.ghost}>キャンセル</button>
                <button onClick={()=>{ deleteDecision(confirmDeleteDecisionId); setConfirmDeleteDecisionId(null); }} style={BTN.danger}>削除する</button>
              </div>
            </div>
          </div>
        );
      })()}
      {confirmDeleteDecisionFolderId && (() => {
        const folder = (project.decisionFolders||[]).find(f=>f.id===confirmDeleteDecisionFolderId);
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }} onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmDeleteDecisionFolderId(null);}}>
            <div style={{ background:"#fff", borderRadius:16, padding:24, maxWidth:380, width:"90%", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }} onClick={e=>e.stopPropagation()}>
              <div style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:8 }}>フォルダを削除しますか？</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:20, lineHeight:1.6 }}>「{folder?.name}」を削除します。フォルダ内の決定事項は上位フォルダに移動します。</div>
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <button onClick={()=>setConfirmDeleteDecisionFolderId(null)} style={BTN.ghost}>キャンセル</button>
                <button onClick={()=>{ deleteFolder(confirmDeleteDecisionFolderId); setConfirmDeleteDecisionFolderId(null); }} style={BTN.danger}>削除する</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}


export { DecisionsPage };
