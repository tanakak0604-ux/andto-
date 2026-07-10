import React, { useState, useRef, useEffect } from "react";
import logo from "./logo.png";
import { Toast } from "./components/common";
import { GlobalSearch } from "./components/GlobalSearch";
import { C, INIT_PROJECTS, btn } from "./constants";
import { ensureDailyBackup, listBackups, loadBackup, loadProjects, loadSlackSettings, loadUpdatedAt, saveProjects, saveSlackSettings, supabase } from "./lib/supabase";
import { uid } from "./lib/text";
import { onUndoToast } from "./lib/undoBus";

// ページは初回表示時に読み込む（初回ロードを軽くするためのコード分割）
const ProjectsPage = React.lazy(() => import("./components/ProjectsPage").then(m => ({ default: m.ProjectsPage })));
const CalendarPage = React.lazy(() => import("./components/CalendarPage").then(m => ({ default: m.CalendarPage })));
const MinutesPage = React.lazy(() => import("./components/MinutesPage").then(m => ({ default: m.MinutesPage })));
const MemberTasksPage = React.lazy(() => import("./components/MiscPages").then(m => ({ default: m.MemberTasksPage })));
const SlackSettingsPage = React.lazy(() => import("./components/MiscPages").then(m => ({ default: m.SlackSettingsPage })));
const ProjectDetailPage = React.lazy(() => import("./components/MiscPages").then(m => ({ default: m.ProjectDetailPage })));

export default function App() {
  const [projects, setProjects] = useState([]);
  const [projectOrder, setProjectOrder] = useState(() => { try { return JSON.parse(localStorage.getItem('taskflow-project-order') || '[]'); } catch { return []; } });
  const [tab, setTab] = useState("projects");
  const [showAdd, setShowAdd] = useState(false);
  const [dragTabId, setDragTabId] = useState(null);
  const [newName, setNewName] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [slackSettings, setSlackSettings] = useState({ summaryChannel: "", notifyChannel: "", sourceChannels: [] });
  const [toast, setToast] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved"
  const [importModal, setImportModal] = useState(null); // { projects: [...], selected: Set }
  const isRemoteUpdate = useRef(false);
  const channelRef = useRef(null);
  const saveTimer = useRef(null);
  const lastSavedAt = useRef(null);
  const lastBroadcastAt = useRef(null);
  const isSaving = useRef(false);
  const localUserId = useRef(
    sessionStorage.getItem('taskflow-uid') ||
    (() => { const id = Math.random().toString(36).slice(2); sessionStorage.setItem('taskflow-uid', id); return id; })()
  );
  const projectsRef = useRef(projects);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  const showToast = (msg) => setToast(msg);
  useEffect(() => onUndoToast((message, undo) => setToast({ text: message, actionLabel: "元に戻す", onAction: undo })), []);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 一度表示したタブはマウントしたままにする（display:none切替で状態を保持する従来挙動の維持）
  const visitedTabs = useRef(new Set(["projects"]));
  visitedTabs.current.add(tab);

  const navigate = (newTab) => {
    setTab(newTab);
    window.history.pushState({ tab: newTab }, '');
  };

  useEffect(() => {
    const onPopState = (e) => setTab(e.state?.tab || 'projects');
    window.history.replaceState({ tab: 'projects' }, '');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []); // eslint-disable-line

  const toastWithProject = (projectId, msg) => {
    const name = projectsRef.current.find(p => p.id === projectId)?.name || "";
    showToast(name ? `【${name}】${msg}` : msg);
  };

  useEffect(() => {
    Promise.all([loadProjects(), loadUpdatedAt()]).then(([saved, ua]) => {
      if (ua) lastSavedAt.current = ua;
      if (saved && Array.isArray(saved) && saved.length > 0) {
        isRemoteUpdate.current = true;
        setProjects(saved);
        // その日最初の起動時にスナップショットを保存（失敗しても本体動作には影響させない）
        ensureDailyBackup(saved).then(r => { if (!r.ok && !r.skipped) console.warn("[backup] 日次バックアップに失敗:", r.error); });
      } else {
        isRemoteUpdate.current = true; // データが取れなかった場合もINIT_PROJECTSを保存しない
        setShowWelcome(true);
      }
      setStorageReady(true);
    }).catch(e => {
      setSaveError("データの読み込みに失敗しました：" + e.message);
      isRemoteUpdate.current = true; // 読み込み失敗時にINIT_PROJECTSを上書き保存しない
      setStorageReady(true);
    });
    loadSlackSettings().then(s => { if (s) setSlackSettings(s); });

    const ch = supabase
      .channel('taskflow-broadcast', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'task-added' }, ({ payload }) => {
        if (payload.senderId === localUserId.current) return;
        isRemoteUpdate.current = true;
        lastBroadcastAt.current = new Date().toISOString();
        setProjects(prev => prev.map(p => p.id === payload.projectId ? { ...p, tasks: [...(p.tasks || []), payload.newTask] } : p));
        toastWithProject(payload.projectId, 'タスクが追加されました');
      })
      .on('broadcast', { event: 'task-updated' }, ({ payload }) => {
        if (payload.senderId === localUserId.current) return;
        isRemoteUpdate.current = true;
        lastBroadcastAt.current = new Date().toISOString();
        setProjects(prev => prev.map(p => p.id === payload.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === payload.taskId ? payload.updatedTask : t) } : p));
        toastWithProject(payload.projectId, 'タスクが更新されました');
      })
      .on('broadcast', { event: 'task-deleted' }, ({ payload }) => {
        if (payload.senderId === localUserId.current) return;
        isRemoteUpdate.current = true;
        lastBroadcastAt.current = new Date().toISOString();
        setProjects(prev => prev.map(p => p.id === payload.projectId ? { ...p, tasks: (p.tasks || []).filter(t => t.id !== payload.taskId) } : p));
        toastWithProject(payload.projectId, 'タスクが削除されました');
      })
      .on('broadcast', { event: 'decision-added' }, ({ payload }) => {
        if (payload.senderId === localUserId.current) return;
        isRemoteUpdate.current = true;
        lastBroadcastAt.current = new Date().toISOString();
        setProjects(prev => prev.map(p => p.id === payload.projectId ? { ...p, decisions: [...(p.decisions || []), payload.newDecision] } : p));
        toastWithProject(payload.projectId, '決定事項が追加されました');
      })
      .on('broadcast', { event: 'decision-updated' }, ({ payload }) => {
        if (payload.senderId === localUserId.current) return;
        isRemoteUpdate.current = true;
        lastBroadcastAt.current = new Date().toISOString();
        setProjects(prev => prev.map(p => p.id === payload.projectId ? { ...p, decisions: (p.decisions || []).map(d => d.id === payload.decisionId ? payload.updatedDecision : d) } : p));
        toastWithProject(payload.projectId, '決定事項が更新されました');
      })
      .on('broadcast', { event: 'decision-deleted' }, ({ payload }) => {
        if (payload.senderId === localUserId.current) return;
        isRemoteUpdate.current = true;
        lastBroadcastAt.current = new Date().toISOString();
        setProjects(prev => prev.map(p => p.id === payload.projectId ? { ...p, decisions: (p.decisions || []).filter(d => d.id !== payload.decisionId) } : p));
        toastWithProject(payload.projectId, '決定事項が削除されました');
      })
      .on('broadcast', { event: 'minutes-added' }, ({ payload }) => {
        if (payload.senderId === localUserId.current) return;
        isRemoteUpdate.current = true;
        lastBroadcastAt.current = new Date().toISOString();
        setProjects(prev => prev.map(p => p.id === payload.projectId ? { ...p, minutes: [...(p.minutes || []), payload.newMinutes] } : p));
        toastWithProject(payload.projectId, '議事録が追加されました');
      })
      .on('broadcast', { event: 'minutes-updated' }, ({ payload }) => {
        if (payload.senderId === localUserId.current) return;
        isRemoteUpdate.current = true;
        lastBroadcastAt.current = new Date().toISOString();
        setProjects(prev => prev.map(p => p.id === payload.projectId ? { ...p, minutes: (p.minutes || []).map(m => m.id === payload.minutesId ? payload.updatedMinutes : m) } : p));
        toastWithProject(payload.projectId, '議事録が更新されました');
      })
      .on('broadcast', { event: 'minutes-deleted' }, ({ payload }) => {
        if (payload.senderId === localUserId.current) return;
        isRemoteUpdate.current = true;
        lastBroadcastAt.current = new Date().toISOString();
        setProjects(prev => prev.map(p => p.id === payload.projectId ? { ...p, minutes: (p.minutes || []).filter(m => m.id !== payload.minutesId) } : p));
        toastWithProject(payload.projectId, '議事録が削除されました');
      })
      .subscribe((status, err) => {
        console.log('[Realtime] status:', status, err || '');
      });

    channelRef.current = ch;

    // タブにフォーカスが戻った時にSupabaseから最新データを再取得（フォルダ変更の同期）
    const handleFocus = () => {
      if (saveTimer.current || isSaving.current) return; // 保存中・未保存の変更がある場合はスキップ
      loadUpdatedAt().then(remoteUpdatedAt => {
        if (!remoteUpdatedAt) return;
        // 保存時刻またはbroadcast受信時刻のうち新しい方と比較（未保存のbroadcast変更を上書きしない）
        const localLatest = [lastSavedAt.current, lastBroadcastAt.current].filter(Boolean).sort().pop();
        if (localLatest && remoteUpdatedAt <= localLatest) return;
        loadProjects().then(saved => {
          if (saved && Array.isArray(saved) && saved.length > 0) {
            isRemoteUpdate.current = true;
            setProjects(saved);
          }
        }).catch(() => {});
      }).catch(() => {});
    };
    window.addEventListener('focus', handleFocus);

    return () => { supabase.removeChannel(ch); window.removeEventListener('focus', handleFocus); };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!storageReady) return;
    const doSave = () => {
      saveTimer.current = null;
      isSaving.current = true;
      saveProjects(projects)
        .then(savedAt => { lastSavedAt.current = savedAt; setSaveStatus("saved"); })
        .catch(e => { setSaveError("データの保存に失敗しました：" + e.message); setSaveStatus(null); })
        .finally(() => { isSaving.current = false; });
    };
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      if (saveTimer.current) {
        // ローカルに未保存の変更があった → マージ済みの最新stateで保存
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(doSave, 500);
      }
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(doSave, 500);
  }, [projects, storageReady]);

  const updateSlackSettings = s => { setSlackSettings(s); saveSlackSettings(s); };

  const updateProject = (newProj) => {
    setProjects(ps => {
      const oldProj = ps.find(p => p.id === newProj.id);
      if (oldProj && channelRef.current) {
        const projectId = newProj.id;
        const send = (event, payload) => channelRef.current.send({ type: 'broadcast', event, payload: { ...payload, senderId: localUserId.current, projectId } });
        const oldTasks = oldProj.tasks || []; const newTasks = newProj.tasks || [];
        if (newTasks.length > oldTasks.length) { const added = newTasks.find(t => !oldTasks.some(ot => ot.id === t.id)); if (added) send('task-added', { newTask: added }); }
        else if (newTasks.length < oldTasks.length) { const deleted = oldTasks.find(t => !newTasks.some(nt => nt.id === t.id)); if (deleted) send('task-deleted', { taskId: deleted.id }); }
        else { const updated = newTasks.find(t => { const old = oldTasks.find(ot => ot.id === t.id); return old && JSON.stringify(t) !== JSON.stringify(old); }); if (updated) send('task-updated', { taskId: updated.id, updatedTask: updated }); }
        const oldDecs = oldProj.decisions || []; const newDecs = newProj.decisions || [];
        if (newDecs.length > oldDecs.length) { const added = newDecs.find(d => !oldDecs.some(od => od.id === d.id)); if (added) send('decision-added', { newDecision: added }); }
        else if (newDecs.length < oldDecs.length) { const deleted = oldDecs.find(d => !newDecs.some(nd => nd.id === d.id)); if (deleted) send('decision-deleted', { decisionId: deleted.id }); }
        else { const updated = newDecs.find(d => { const old = oldDecs.find(od => od.id === d.id); return old && JSON.stringify(d) !== JSON.stringify(old); }); if (updated) send('decision-updated', { decisionId: updated.id, updatedDecision: updated }); }
        const oldMins = oldProj.minutes || []; const newMins = newProj.minutes || [];
        if (newMins.length > oldMins.length) { const added = newMins.find(m => !oldMins.some(om => om.id === m.id)); if (added) send('minutes-added', { newMinutes: added }); }
        else if (newMins.length < oldMins.length) { const deleted = oldMins.find(m => !newMins.some(nm => nm.id === m.id)); if (deleted) send('minutes-deleted', { minutesId: deleted.id }); }
        else { const updated = newMins.find(m => { const old = oldMins.find(om => om.id === m.id); return old && JSON.stringify(m) !== JSON.stringify(old); }); if (updated) send('minutes-updated', { minutesId: updated.id, updatedMinutes: updated }); }
      }
      return ps.map(x => x.id === newProj.id ? newProj : x);
    });
  };
  const deleteProject = id => {
    const target = projectsRef.current.find(p => p.id === id);
    setProjects(ps => ps.filter(p => p.id!==id));
    navigate("projects");
    if (target) setToast({ text: `プロジェクト「${target.name}」を削除しました`, actionLabel: "元に戻す", onAction: () => setProjects(ps => [...ps, target]) });
  };
  const addProject = () => {
    if (!newName.trim()) return;
    const colors = [C.sage,C.doing,C.done,C.accent,"#9B8EC0"];
    const p = { id:uid(), name:newName, desc:"", color:colors[projects.length%colors.length], minutes:[], members:[], tasks:[] };
    setProjects(ps=>[...ps,p]); navigate(p.id); setNewName(""); setShowAdd(false);
  };
  const addTasks = (pid, tasks) => { setProjects(ps=>ps.map(p=>p.id===pid?{...p,tasks:[...p.tasks,...tasks]}:p)); };
  const active = projects.find(p => p.id===tab);

  const reorderProjects = (newOrder) => {
    setProjectOrder(newOrder);
    localStorage.setItem('taskflow-project-order', JSON.stringify(newOrder));
  };
  const sortedProjects = projectOrder.length > 0
    ? [...projects].sort((a, b) => { const ai = projectOrder.indexOf(a.id); const bi = projectOrder.indexOf(b.id); if (ai === -1 && bi === -1) return 0; if (ai === -1) return 1; if (bi === -1) return -1; return ai - bi; })
    : projects;

  const [backupModal, setBackupModal] = useState(null); // null | { list, loading, restoringId }
  const openBackups = async () => {
    setBackupModal({ list: [], loading: true });
    const list = await listBackups().catch(() => []);
    setBackupModal({ list, loading: false });
  };
  const restoreBackup = async (id) => {
    setBackupModal(m => m && { ...m, restoringId: id });
    const snapshot = await loadBackup(id).catch(() => null);
    if (!snapshot || !Array.isArray(snapshot) || snapshot.length === 0) {
      showToast("⚠️ バックアップの読み込みに失敗しました");
      setBackupModal(m => m && { ...m, restoringId: null });
      return;
    }
    const prev = projectsRef.current;
    setProjects(snapshot);
    setBackupModal(null);
    setToast({ text: `${fmtBackupId(id)}のバックアップを復元しました`, actionLabel: "元に戻す", onAction: () => setProjects(prev) });
  };
  const fmtBackupId = (id) => {
    const m = id.match(/^backup_(\d{4})(\d{2})(\d{2})$/);
    return m ? `${m[1]}/${m[2]}/${m[3]}` : id;
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({projects,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`taskflow-backup-${new Date().toLocaleDateString("ja-JP").replace(/\//g,"-")}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file=e.target.files[0]; if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{
      try {
        const data=JSON.parse(ev.target.result);
        if(data.projects&&Array.isArray(data.projects)){
          setImportModal({ projects: data.projects, selected: new Set(data.projects.map(p=>p.id)) });
        } else showToast("⚠️ 正しいバックアップファイルではありません");
      } catch { showToast("⚠️ ファイルの読み込みに失敗しました"); }
    };
    r.readAsText(file); e.target.value="";
  };

  const execImport = () => {
    if(!importModal) return;
    const toImport = importModal.projects.filter(p => importModal.selected.has(p.id));
    const existingIds = new Set(projects.map(p=>p.id));
    const merged = [
      ...projects.map(p => {
        const found = toImport.find(x=>x.id===p.id);
        return found || p;
      }),
      ...toImport.filter(p => !existingIds.has(p.id))
    ];
    setProjects(merged);
    setImportModal(null);
    navigate("projects");
  };

  const importRef = useRef(null);

  if (!storageReady) return (
    <div style={{ minHeight:"100dvh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Sans JP Variable','Hiragino Sans','Noto Sans JP',sans-serif" }}>
      <img src={logo} alt="andto" style={{ height:36, objectFit:"contain", animation:"pulse 1.6s ease-in-out infinite" }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:"'Noto Sans JP Variable','Hiragino Sans','Noto Sans JP',sans-serif", color:C.text }}>
      <style>{`
        .nav-scroll::-webkit-scrollbar { display: none; }
        .nav-tab:hover { background: rgba(0,0,0,0.04) !important; }
        @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .nav-tab-anim { animation: fadeInLeft 0.4s ease both; }
        .card-anim { animation: fadeIn 0.4s ease both; }
        .date-muted::-webkit-datetime-edit { color: #8C8880; }
        .date-muted::-webkit-datetime-edit-year-field,
        .date-muted::-webkit-datetime-edit-month-field,
        .date-muted::-webkit-datetime-edit-day-field { color: #8C8880; }
        .date-muted.has-value::-webkit-datetime-edit,
        .date-muted.has-value::-webkit-datetime-edit-year-field,
        .date-muted.has-value::-webkit-datetime-edit-month-field,
        .date-muted.has-value::-webkit-datetime-edit-day-field { color: #2D2A24; }
      `}</style>
      {saveError && (
        <div style={{ background:"#DC2626", color:"#fff", padding:"10px 20px", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"space-between", zIndex:9999 }}>
          <span>⚠️ {saveError}</span>
          <button aria-label="エラーを閉じる" onClick={()=>setSaveError(null)} style={{ background:"transparent", border:"none", color:"#fff", cursor:"pointer", fontSize:16, fontWeight:700, padding:"0 4px" }}>✕</button>
        </div>
      )}
      {importModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:C.surface, borderRadius:12, padding:28, width:460, maxWidth:"90vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>インポートするプロジェクトを選択</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:18 }}>選択したプロジェクトのみをインポートします。</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:320, overflowY:"auto", marginBottom:20 }}>
              {importModal.projects.map(p => {
                const exists = projects.some(x=>x.id===p.id);
                const checked = importModal.selected.has(p.id);
                return (
                  <label key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.bg, cursor:"pointer" }}>
                    <input type="checkbox" checked={checked} onChange={() => setImportModal(m => {
                      const next = new Set(m.selected);
                      checked ? next.delete(p.id) : next.add(p.id);
                      return { ...m, selected: next };
                    })} style={{ width:15, height:15, margin:0, accentColor:C.sage }} />
                    <span style={{ width:8, height:8, borderRadius:"50%", background:p.color, flexShrink:0 }} />
                    <span style={{ flex:1, fontWeight:600, fontSize:13 }}>{p.name}</span>
                    {exists
                      ? <span style={{ fontSize:11, color:"#D97706", background:"#FEF3C7", padding:"2px 7px", borderRadius:10 }}>⚠️ 上書きされます</span>
                      : <span style={{ fontSize:11, color:"#059669", background:"#D1FAE5", padding:"2px 7px", borderRadius:10 }}>✅ 新規追加されます</span>
                    }
                  </label>
                );
              })}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button onClick={()=>setImportModal(null)} style={btn({ background:"transparent", border:`1.5px solid ${C.border}`, color:C.muted, borderRadius:8, padding:"7px 18px", fontSize:13 })}>キャンセル</button>
              <button onClick={execImport} disabled={importModal.selected.size===0} style={btn({ background:importModal.selected.size===0?C.border:C.accent, color:"#fff", borderRadius:8, padding:"7px 18px", fontSize:13, fontWeight:700, cursor:importModal.selected.size===0?"not-allowed":"pointer" })}>インポート実行 ({importModal.selected.size}件)</button>
            </div>
          </div>
        </div>
      )}
      <div className="nav-scroll" style={{ background:C.surface, borderBottom:`1.5px solid ${C.border}`, display:"flex", alignItems:"stretch", overflowX:"auto", paddingLeft:20, scrollbarWidth:"none", msOverflowStyle:"none" }}>
        <div style={{ paddingRight:20, display:"flex", alignItems:"center", borderRight:`1px solid ${C.border}`, marginRight:4, flexShrink:0 }}>
  <img src={logo} alt="logo" style={{ height:20, objectFit:"contain" }} />
</div>
        {[["projects","📁 Projects"],["calendar","📅 カレンダー"],["minutes","✨ 議事録作成"],["members","👥 メンバー"]].map(([id,lbl],i)=>(
          <button key={id} onClick={()=>navigate(id)} className="nav-tab nav-tab-anim" style={{...btn({padding:"0 16px",height:52,background:"transparent",fontSize:13,fontWeight:700,color:tab===id?C.accent:C.muted,borderBottom:tab===id?`2.5px solid ${C.accent}`:"2.5px solid transparent",flexShrink:0,whiteSpace:"nowrap"}), animationDelay:`${i*40}ms`}}>{lbl}</button>
        ))}
        <div style={{ width:1, background:C.border, margin:"10px 8px", flexShrink:0 }} />
        {sortedProjects.map((p,i)=>(
          <button key={p.id} draggable onClick={()=>navigate(p.id)} className="nav-tab nav-tab-anim"
            onDragStart={()=>setDragTabId(p.id)}
            onDragOver={e=>e.preventDefault()}
            onDrop={()=>{ if(!dragTabId||dragTabId===p.id)return; const ids=sortedProjects.map(x=>x.id); const from=ids.indexOf(dragTabId); const to=ids.indexOf(p.id); const next=[...ids]; next.splice(from,1); next.splice(to,0,dragTabId); reorderProjects(next); setDragTabId(null); }}
            onDragEnd={()=>setDragTabId(null)}
            style={{...btn({padding:"0 14px",height:52,background:"transparent",fontSize:13,fontWeight:700,color:tab===p.id?p.color:C.muted,borderBottom:tab===p.id?`2.5px solid ${p.color}`:"2.5px solid transparent",flexShrink:0,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,opacity:dragTabId===p.id?0.5:1,cursor:"grab"}), animationDelay:`${(4+i)*40}ms`}}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:p.color }} />{p.name}
          </button>
        ))}
        {showAdd ? (
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"0 12px", flexShrink:0 }}>
            <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProject()} placeholder="プロジェクト名"
              style={{ border:`1.5px solid ${C.border}`, borderRadius:8, padding:"5px 10px", fontSize:13, background:C.bg, color:C.text, outline:"none", width:130 }} />
            <button onClick={addProject} style={btn({background:C.accent,color:"#fff",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700})}>追加</button>
            <button aria-label="閉じる" onClick={()=>setShowAdd(false)} style={btn({background:"transparent",color:C.muted,fontSize:16})}>✕</button>
          </div>
        ) : (
          <button onClick={()=>setShowAdd(true)} style={btn({padding:"0 14px",height:52,background:"transparent",fontSize:16,fontWeight:700,color:C.muted,flexShrink:0,lineHeight:1})}>+</button>
        )}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4, padding:"0 12px", flexShrink:0 }}>
          {saveStatus && (
            <span style={{ fontSize:11, fontWeight:700, whiteSpace:"nowrap", marginRight:6, color: saveStatus==="saved" ? C.sage : C.muted, transition:"color 0.3s" }}>
              {saveStatus==="saved" ? "✓ 保存済み" : "保存中..."}
            </span>
          )}
          <button onClick={()=>setSearchOpen(true)} aria-label="全体検索（Ctrl+K）" title="全体検索（Ctrl+K）"
            style={btn({padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontWeight:700,whiteSpace:"nowrap"})}>🔍 検索</button>
          <button onClick={()=>navigate("slack-settings")} style={btn({padding:"5px 10px",borderRadius:8,border:`1.5px solid ${tab==="slack-settings"?C.sage:C.border}`,background:tab==="slack-settings"?C.sageLight:"transparent",color:tab==="slack-settings"?C.sage:C.muted,fontSize:11,fontWeight:700,whiteSpace:"nowrap"})}>💬 Slack設定</button>
          <button onClick={openBackups} style={btn({padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontWeight:700,whiteSpace:"nowrap"})}>🕘 バックアップ</button>
          <button onClick={exportData} style={btn({padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontWeight:700,whiteSpace:"nowrap"})}>⬆ エクスポート</button>
          <button onClick={()=>importRef.current?.click()} style={btn({padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontWeight:700,whiteSpace:"nowrap"})}>⬇ インポート</button>
          <input ref={importRef} type="file" accept=".json" onChange={importData} style={{ display:"none" }} />
        </div>
      </div>

      <React.Suspense fallback={<div style={{ padding:40, textAlign:"center", color:C.muted, fontSize:13 }}>読み込み中...</div>}>
        <div style={{ display:tab==="projects"?"block":"none" }}><ProjectsPage projects={sortedProjects} onUpdate={updateProject} onDelete={deleteProject} onNavigate={id=>navigate(id)} onReorder={reorderProjects} /></div>
        {visitedTabs.current.has("calendar") && <div style={{ display:tab==="calendar"?"block":"none" }}><CalendarPage projects={projects} onUpdate={updateProject} /></div>}
        {visitedTabs.current.has("minutes") && <div style={{ display:tab==="minutes"?"block":"none" }}><MinutesPage projects={projects} onAddTasks={addTasks} onUpdateProject={updateProject} /></div>}
        {visitedTabs.current.has("members") && <div style={{ display:tab==="members"?"block":"none" }}><MemberTasksPage projects={projects} /></div>}
        {visitedTabs.current.has("slack-settings") && <div style={{ display:tab==="slack-settings"?"block":"none" }}><SlackSettingsPage slackSettings={slackSettings} onChange={updateSlackSettings} /></div>}
        {active&&tab===active.id&&<ProjectDetailPage key={active.id} project={active} onUpdate={updateProject} onMinutesUpdate={p => { lastBroadcastAt.current = new Date().toISOString(); updateProject(p); }} />}
      </React.Suspense>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <GlobalSearch projects={projects} open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={id => navigate(id)} />
      {backupModal && (
        <div onClick={() => setBackupModal(null)} style={{ position:"fixed", inset:0, background:"rgba(45,42,36,0.45)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div role="dialog" aria-modal="true" aria-label="バックアップ" onClick={e => e.stopPropagation()}
            style={{ background:C.surface, borderRadius:14, padding:"22px 24px", width:420, maxWidth:"90vw", boxShadow:"0 12px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:4 }}>🕘 日次バックアップ</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:14, lineHeight:1.6 }}>毎日最初にアプリを開いた時点のデータを自動保存しています（直近14日分）。復元すると全プロジェクトがその時点の内容に置き換わります。</div>
            <div style={{ maxHeight:300, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
              {backupModal.loading && <div style={{ padding:"20px 0", textAlign:"center", color:C.muted, fontSize:13 }}>読み込み中...</div>}
              {!backupModal.loading && backupModal.list.length === 0 && (
                <div style={{ padding:"20px 0", textAlign:"center", color:C.muted, fontSize:13 }}>バックアップはまだありません。<br /><span style={{ fontSize:11 }}>明日以降、アプリを開くと自動で作成されます。</span></div>
              )}
              {backupModal.list.map(b => (
                <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", border:`1.5px solid ${C.border}`, borderRadius:10, background:C.bg }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C.text, flex:1 }}>{fmtBackupId(b.id)}</span>
                  <button onClick={() => restoreBackup(b.id)} disabled={backupModal.restoringId === b.id}
                    style={btn({ padding:"4px 12px", borderRadius:8, background:C.sage, color:"#fff", fontSize:12, fontWeight:700, opacity: backupModal.restoringId === b.id ? 0.6 : 1 })}>
                    {backupModal.restoringId === b.id ? "復元中..." : "復元"}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
              <button onClick={() => setBackupModal(null)} style={btn({ background:"transparent", border:`1.5px solid ${C.border}`, color:C.muted, borderRadius:8, padding:"7px 18px", fontSize:13 })}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {showWelcome&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:"48px 40px", maxWidth:480, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.2)", textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>✦</div>
            <div style={{ fontSize:22, fontWeight:900, color:C.text, marginBottom:10 }}>andtoへようこそ</div>
            <div style={{ fontSize:13, color:C.muted, lineHeight:2, marginBottom:28 }}>
              プロジェクト・タスク・議事録を一元管理できるチームツールです。<br />
              データは自動保存され、チーム全員とリアルタイムで共有されます。
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:28 }}>
              {[["📁 Projects","プロジェクト・タスク管理",C.sageLight,C.sage],["✨ 議事録","AI議事録作成・タスク自動抽出",C.accentLight,C.accent],["📅 カレンダー","期日・スケジュール確認",C.decisionLight,C.decision]].map(([label,desc,bg,color])=>(
                <div key={label} style={{ display:"flex", alignItems:"center", gap:12, background:bg, borderRadius:8, padding:"8px 14px" }}>
                  <span style={{ color, fontWeight:700, fontSize:12, whiteSpace:"nowrap" }}>{label}</span>
                  <span style={{ color:C.muted, fontSize:12 }}>{desc}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowWelcome(false)} style={{ background:C.accent, color:"#fff", border:"none", borderRadius:10, padding:"13px 40px", fontSize:14, fontWeight:700, cursor:"pointer" }}>はじめる →</button>
          </div>
        </div>
      )}
    </div>
  );
}

