import React, { useState, useRef, useEffect } from "react";
import { BTN, C, btn } from "../constants";
import { uid } from "../lib/text";

function CalendarPage({ projects, onUpdate }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedProjects, setSelectedProjects] = useState(() => { try { return JSON.parse(localStorage.getItem('taskflow-calendar-projects') || '[]'); } catch { return []; } });
  const [selectedMembers, setSelectedMembers] = useState(() => { try { return JSON.parse(localStorage.getItem('taskflow-calendar-members') || '[]'); } catch { return []; } });
  const [selectedTask, setSelectedTask] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [dragTask, setDragTask] = useState(null);
  const [dragEvent, setDragEvent] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const [expandedDates, setExpandedDates] = useState({});
  const [addEventModal, setAddEventModal] = useState(null); // { date }
  const [addEventForm, setAddEventForm] = useState({ title: "", date: "", projectId: "" });
  const [hoveredCell, setHoveredCell] = useState(null);
  const [cellMenu, setCellMenu] = useState(null); // { date, x, y }
  const [addTaskModal, setAddTaskModal] = useState(null);
  const [addTaskForm, setAddTaskForm] = useState({ title: "", dueDate: "", projectId: "", priority: "medium" });
  const [selectedEvent, setSelectedEvent] = useState(null); // { event, projectId }
  const [editEventMode, setEditEventMode] = useState(false);
  const [editEventForm, setEditEventForm] = useState({ title: "", date: "", projectId: "" });
  const [addMilestoneModal, setAddMilestoneModal] = useState(null);
  const [addMilestoneForm, setAddMilestoneForm] = useState({ name: "", date: "", projectId: "" });

  useEffect(() => { localStorage.setItem('taskflow-calendar-members', JSON.stringify(selectedMembers)); }, [selectedMembers]);
  useEffect(() => { localStorage.setItem('taskflow-calendar-projects', JSON.stringify(selectedProjects)); }, [selectedProjects]);
  useEffect(() => {
    if (!cellMenu) return;
    const close = () => setCellMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [cellMenu]);

  // andtoメンバーを全プロジェクトから収集（id・name両方で重複排除）
  const allAndtoMembers = projects.flatMap(p => (p.members || []).filter(m => m.isAndto));
  const andtoMembers = allAndtoMembers.filter(
    (m, idx, self) => idx === self.findIndex(x => x.id === m.id || x.name === m.name)
  );
  const andtoIdSet = new Set(andtoMembers.map(m => m.id));

  const allTasks = projects.flatMap(p => p.tasks.map(t => ({ ...t, pColor: p.color, pName: p.name, pId: p.id })));

  const projFiltered = selectedProjects.length === 0 ? allTasks : allTasks.filter(t => selectedProjects.includes(t.pId));

  const filteredTasks = selectedMembers.length === 0
    ? projFiltered
    : projFiltered.filter(t => (t.assigneeIds || []).some(id => selectedMembers.includes(id)));

  // イベント収集（プロジェクトフィルター連動）
  const allEvents = projects.flatMap(p => (p.events || []).map(e => ({ ...e, pId: p.id, pColor: p.color, pName: p.name })));
  const filteredEvents = selectedProjects.length === 0 ? allEvents : allEvents.filter(e => selectedProjects.includes(e.pId));
  const eventsByDate = {};
  filteredEvents.forEach(e => { if (e.date) { if (!eventsByDate[e.date]) eventsByDate[e.date] = []; eventsByDate[e.date].push(e); } });

  const allMilestones = projects.flatMap(p => (p.milestones || []).map(m => ({ ...m, pId: p.id, pColor: p.color, pName: p.name })));
  const filteredMilestones = selectedProjects.length === 0 ? allMilestones : allMilestones.filter(m => selectedProjects.includes(m.pId));
  const milestonesByDate = {};
  filteredMilestones.forEach(m => { if (m.date) { if (!milestonesByDate[m.date]) milestonesByDate[m.date] = []; milestonesByDate[m.date].push(m); } });

  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const byDate = {};
  filteredTasks.forEach(t => { if (t.dueDate) { if (!byDate[t.dueDate]) byDate[t.dueDate] = []; byDate[t.dueDate].push(t); } });

  const mn = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const dn = ["月","火","水","木","金","土","日"];
  const prev = () => month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1);
  const next = () => month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1);

  const priorityLabel = p => p === "high" ? "高" : p === "medium" ? "中" : "低";
  const priorityColor = p => p === "high" ? C.accent : p === "medium" ? C.doing : C.done;
  const statusLabel = s => s === "todo" ? "未着手" : s === "doing" ? "進行中" : "完了";

  const handleDragStart = (e, t) => {
    setDragTask({ taskId: t.id, pId: t.pId });
    e.dataTransfer.effectAllowed = "move";
  };
  const handleEventDragStart = (e, ev) => {
    setDragEvent({ eventId: ev.id, pId: ev.pId });
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, ds) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setHoverDate(ds); };
  const handleDrop = (e, ds) => {
    e.preventDefault(); setHoverDate(null);
    if (dragEvent && ds && onUpdate) {
      const proj = projects.find(p => p.id === dragEvent.pId);
      if (proj) onUpdate({ ...proj, events: (proj.events || []).map(ev => ev.id === dragEvent.eventId ? { ...ev, date: ds } : ev) });
      setDragEvent(null);
      return;
    }
    if (!dragTask || !ds || !onUpdate) return;
    const proj = projects.find(p => p.id === dragTask.pId);
    if (!proj) return;
    onUpdate({ ...proj, tasks: proj.tasks.map(t => t.id === dragTask.taskId ? { ...t, dueDate: ds } : t) });
    setDragTask(null);
  };
  const handleDragEnd = () => { setDragTask(null); setDragEvent(null); setHoverDate(null); };

  const filterBtn = (active, color, label, onClick) => (
    <button onClick={onClick} style={btn({ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: active ? color : "transparent", color: active ? "#fff" : C.muted, border: `1.5px solid ${active ? color : C.border}` })}>{label}</button>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={prev} style={btn({ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 16, color: C.text })}>‹</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.text }}>{year}年 {mn[month]}</h2>
        <button onClick={next} style={btn({ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 16, color: C.text })}>›</button>
      </div>

      {/* フィルター */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>担当者:</span>
          {filterBtn(selectedMembers.length === 0, C.text, "全員", () => setSelectedMembers([]))}
          {andtoMembers.map(m => filterBtn(selectedMembers.includes(m.id), C.sage, m.name, () => setSelectedMembers(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>プロジェクト:</span>
          {filterBtn(selectedProjects.length === 0, C.text, "全プロジェクト", () => setSelectedProjects([]))}
          {projects.map(p => (
            <button key={p.id} onClick={() => setSelectedProjects(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])} style={btn({ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: selectedProjects.includes(p.id) ? p.color : "transparent", color: selectedProjects.includes(p.id) ? "#fff" : C.muted, border: `1.5px solid ${selectedProjects.includes(p.id) ? p.color : C.border}`, display: "flex", alignItems: "center", gap: 5 })}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />{p.name}
            </button>
          ))}
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden" }}>
        {dn.map((d, i) => (
          <div key={d} style={{ background: C.surface, padding: "10px 0", textAlign: "center", fontSize: 12, fontWeight: 800, color: i === 5 ? C.done : i === 6 ? C.accent : C.muted }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          const ds = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
          const tasks = ds ? (byDate[ds] || []) : [];
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const col = i % 7;
          const isHover = !!ds && hoverDate === ds && !!(dragTask || dragEvent);
          const LIMIT = 5;
          const isExpanded = !!expandedDates[ds];
          const shown = tasks.length > LIMIT && !isExpanded ? tasks.slice(0, LIMIT) : tasks;
          const rest = tasks.length - LIMIT;
          return (
            <div key={i}
              onDragOver={ds ? e => handleDragOver(e, ds) : undefined}
              onDrop={ds ? e => handleDrop(e, ds) : undefined}
              onDragLeave={() => setHoverDate(null)}
              onMouseEnter={ds ? () => setHoveredCell(ds) : undefined}
              onMouseLeave={ds ? () => { setHoveredCell(null); } : undefined}
              style={{ background: isHover ? C.sageLight : C.surface, minHeight: 90, padding: "7px 5px", boxSizing: "border-box", outline: isHover ? `2px solid ${C.sage}` : "none", outlineOffset: "-2px" }}>
              {day && <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? C.accent : "transparent", color: isToday ? "#fff" : col === 5 ? C.done : col === 6 ? C.accent : C.text, fontSize: 13, fontWeight: isToday ? 800 : 400 }}>{day}</div>
                  {hoveredCell === ds && !dragTask && !dragEvent && (
                    <button onClick={e => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setCellMenu(c => c?.date === ds ? null : { date: ds, x: Math.max(0, rect.right - 130), y: rect.bottom + 4 }); }}
                      style={btn({ width: 18, height: 18, borderRadius: "50%", background: C.sage, color: "#fff", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 })}>+</button>
                  )}
                </div>
                {(milestonesByDate[ds] || []).map(m => (
                  <div key={m.id}
                    style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, marginBottom: 2, background: m.achieved ? C.sageLight : m.pColor + "22", border: `1px solid ${m.pColor}`, color: m.pColor, fontWeight: 700, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: m.achieved ? "line-through" : "none", opacity: m.achieved ? 0.6 : 1 }}>
                    🚩 {m.name}
                  </div>
                ))}
                {(eventsByDate[ds] || []).map(ev => (
                  <div key={ev.id}
                    draggable
                    onDragStart={e => { e.stopPropagation(); handleEventDragStart(e, ev); }}
                    onDragEnd={handleDragEnd}
                    onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                    style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, marginBottom: 2, background: C.surface, border: `1px solid ${ev.pColor}`, color: C.text, fontWeight: 600, lineHeight: 1.4, cursor: "grab", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: dragEvent?.eventId === ev.id ? 0.35 : 1, userSelect: "none" }}>
                    📅 {ev.title}
                  </div>
                ))}
                {shown.map(t => (
                  <div key={t.id}
                    draggable
                    onDragStart={e => handleDragStart(e, t)}
                    onDragEnd={handleDragEnd}
                    onClick={e => { e.stopPropagation(); setSelectedTask(t); setEditMode(false); setEditForm({}); }}
                    style={{ fontSize: 12, padding: "3px 6px", borderRadius: 4, marginBottom: 2, background: t.pColor + "22", color: t.pColor, fontWeight: 700, lineHeight: 1.4, cursor: "grab", opacity: dragTask?.taskId === t.id ? 0.35 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", userSelect: "none" }}>
                    {t.status === "done" ? "✅ " : ""}{t.title}
                  </div>
                ))}
                {tasks.length > LIMIT && !isExpanded && (
                  <div onClick={() => setExpandedDates(prev => ({ ...prev, [ds]: true }))}
                    style={{ fontSize: 10, color: C.sage, fontWeight: 700, paddingLeft: 5, cursor: "pointer" }}>+{rest}件</div>
                )}
                {isExpanded && (
                  <div onClick={() => setExpandedDates(prev => ({ ...prev, [ds]: false }))}
                    style={{ fontSize: 10, color: C.muted, fontWeight: 700, paddingLeft: 5, cursor: "pointer", marginTop: 2 }}>閉じる</div>
                )}
              </>}
            </div>
          );
        })}
      </div>

      {cellMenu && (
        <div style={{ position: "fixed", top: cellMenu.y, left: cellMenu.x, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 200, overflow: "hidden", minWidth: 130 }}>
          <button onClick={e => { e.stopPropagation(); setAddTaskModal({ date: cellMenu.date }); setAddTaskForm({ title: "", dueDate: cellMenu.date, projectId: projects[0]?.id || "", priority: "medium" }); setCellMenu(null); }}
            style={btn({ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 12, fontWeight: 700, background: "transparent", color: C.text, borderBottom: `1px solid ${C.border}` })}>📋 タスク作成</button>
          <button onClick={e => { e.stopPropagation(); setAddEventModal({ date: cellMenu.date }); setAddEventForm({ title: "", date: cellMenu.date, projectId: projects[0]?.id || "" }); setCellMenu(null); }}
            style={btn({ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 12, fontWeight: 700, background: "transparent", color: C.text, borderBottom: `1px solid ${C.border}` })}>📅 予定作成</button>
          <button onClick={e => { e.stopPropagation(); setAddMilestoneModal({ date: cellMenu.date }); setAddMilestoneForm({ name: "", date: cellMenu.date, projectId: projects[0]?.id || "" }); setCellMenu(null); }}
            style={btn({ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 12, fontWeight: 700, background: "transparent", color: C.text })}>🚩 マイルストーン作成</button>
        </div>
      )}

      {addTaskModal && (
        <div onClick={() => setAddTaskModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 16, padding: "24px 28px", maxWidth: 360, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.text, marginBottom: 18 }}>📋 タスクを作成</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>タイトル *</label>
                <input autoFocus value={addTaskForm.title} onChange={e => setAddTaskForm(f => ({ ...f, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter" && addTaskForm.title.trim() && addTaskForm.projectId) { const proj = projects.find(p => p.id === addTaskForm.projectId); if (proj) { onUpdate({ ...proj, tasks: [...proj.tasks, { id: uid(), title: addTaskForm.title.trim(), status: "todo", dueDate: addTaskForm.dueDate, priority: addTaskForm.priority, desc: "", assigneeIds: [], subtasks: [], relatedDecisionIds: [], createdAt: new Date().toISOString() }] }); setAddTaskModal(null); } } }}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", background: C.bg, color: C.text }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>期日</label>
                <input type="date" value={addTaskForm.dueDate} onChange={e => setAddTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", background: C.bg, color: C.text }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>プロジェクト</label>
                <select value={addTaskForm.projectId} onChange={e => setAddTaskForm(f => ({ ...f, projectId: e.target.value }))}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", background: C.bg, color: C.text }}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>優先度</label>
                <select value={addTaskForm.priority} onChange={e => setAddTaskForm(f => ({ ...f, priority: e.target.value }))}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", background: C.bg, color: C.text }}>
                  <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setAddTaskModal(null)} style={BTN.ghost}>キャンセル</button>
                <button onClick={() => {
                  if (!addTaskForm.title.trim() || !addTaskForm.projectId) return;
                  const proj = projects.find(p => p.id === addTaskForm.projectId);
                  if (!proj) return;
                  onUpdate({ ...proj, tasks: [...proj.tasks, { id: uid(), title: addTaskForm.title.trim(), status: "todo", dueDate: addTaskForm.dueDate, priority: addTaskForm.priority, desc: "", assigneeIds: [], subtasks: [], relatedDecisionIds: [], createdAt: new Date().toISOString() }] });
                  setAddTaskModal(null);
                }} style={BTN.primary}>作成</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addMilestoneModal && (
        <div onClick={() => setAddMilestoneModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 16, padding: "24px 28px", maxWidth: 360, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.text, marginBottom: 18 }}>🚩 マイルストーンを作成</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>マイルストーン名 *</label>
                <input autoFocus value={addMilestoneForm.name} onChange={e => setAddMilestoneForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例：基本設計完了"
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", background: C.bg, color: C.text }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>日付</label>
                <input type="date" value={addMilestoneForm.date} onChange={e => setAddMilestoneForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", background: C.bg, color: C.text }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>プロジェクト</label>
                <select value={addMilestoneForm.projectId} onChange={e => setAddMilestoneForm(f => ({ ...f, projectId: e.target.value }))}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", background: C.bg, color: C.text }}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setAddMilestoneModal(null)} style={BTN.ghost}>キャンセル</button>
                <button onClick={() => {
                  if (!addMilestoneForm.name.trim() || !addMilestoneForm.projectId) return;
                  const proj = projects.find(p => p.id === addMilestoneForm.projectId);
                  if (!proj) return;
                  onUpdate({ ...proj, milestones: [...(proj.milestones || []), { id: uid(), name: addMilestoneForm.name.trim(), date: addMilestoneForm.date, achieved: false }] });
                  setAddMilestoneModal(null);
                }} style={BTN.primary}>作成</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* タスク詳細/編集モーダル */}
      {selectedTask && (() => {
        const proj = projects.find(p => p.id === selectedTask.pId);
        const saveEdit = () => {
          if (!proj) return;
          onUpdate({ ...proj, tasks: proj.tasks.map(t => t.id === selectedTask.id ? { ...t, ...editForm } : t) });
          setSelectedTask(t => ({ ...t, ...editForm }));
          setEditMode(false);
        };
        return (
          <div onClick={() => setSelectedTask(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", maxWidth: 420, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: C.text, flex: 1, paddingRight: 12 }}>{selectedTask.title}</div>
                <button onClick={() => setSelectedTask(null)} style={btn({ background: "transparent", color: C.muted, fontSize: 18, padding: "0 4px" })}>✕</button>
              </div>
              {editMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>タイトル</label>
                    <input value={editForm.title || ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>期日</label>
                    <input type="date" value={editForm.dueDate || ""} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>ステータス</label>
                    <select value={editForm.status || "todo"} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                      <option value="todo">未着手</option><option value="doing">進行中</option><option value="done">完了</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>優先度</label>
                    <select value={editForm.priority || "medium"} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                      <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>担当者</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(proj?.members || []).map(m => {
                        const sel = (editForm.assigneeIds || []).includes(m.id);
                        return <button key={m.id} type="button" onClick={() => setEditForm(f => ({ ...f, assigneeIds: sel ? (f.assigneeIds||[]).filter(id=>id!==m.id) : [...(f.assigneeIds||[]), m.id] }))} style={btn({ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: sel ? C.sage : "transparent", color: sel ? "#fff" : C.muted, border: `1.5px solid ${sel ? C.sage : C.border}` })}>{sel ? "✓ " : ""}{m.name}</button>;
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={() => setEditMode(false)} style={BTN.ghost}>キャンセル</button>
                    <button onClick={saveEdit} style={BTN.primary}>保存</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    {[
                      ["📁 プロジェクト", <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: selectedTask.pColor, flexShrink: 0 }} />{selectedTask.pName}</span>],
                      ["📅 期日", selectedTask.dueDate || "—"],
                      ["👤 担当者", (() => { const names = (selectedTask.assigneeIds || []).map(id => (proj?.members || []).find(m => m.id === id)?.name).filter(Boolean); return names.length ? names.join("・") : "（未割当）"; })()],
                      ["📊 ステータス", statusLabel(selectedTask.status)],
                      ["🔺 優先度", <span style={{ color: priorityColor(selectedTask.priority), fontWeight: 700 }}>{priorityLabel(selectedTask.priority)}</span>],
                    ].map(([label, val]) => (
                      <div key={label} style={{ display: "flex", gap: 12, fontSize: 13 }}>
                        <span style={{ color: C.muted, fontWeight: 700, whiteSpace: "nowrap", minWidth: 90 }}>{label}</span>
                        <span style={{ color: C.text }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => { setEditMode(true); setEditForm({ title: selectedTask.title, dueDate: selectedTask.dueDate, status: selectedTask.status, priority: selectedTask.priority, assigneeIds: selectedTask.assigneeIds || [] }); }} style={BTN.ghost}>✏️ 編集</button>
                    <button onClick={() => { if (!proj) return; onUpdate({ ...proj, tasks: proj.tasks.filter(t => t.id !== selectedTask.id) }); setSelectedTask(null); }} style={BTN.danger}>🗑 削除</button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* 予定追加モーダル */}
      {addEventModal && (
        <div onClick={() => setAddEventModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", maxWidth: 360, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.text, marginBottom: 18 }}>📅 予定を追加</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>タイトル *</label>
                <input autoFocus value={addEventForm.title} onChange={e => setAddEventForm(f => ({ ...f, title: e.target.value }))} style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>日付</label>
                <input type="date" value={addEventForm.date} onChange={e => setAddEventForm(f => ({ ...f, date: e.target.value }))} style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>プロジェクト</label>
                <select value={addEventForm.projectId} onChange={e => setAddEventForm(f => ({ ...f, projectId: e.target.value }))} style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setAddEventModal(null)} style={BTN.ghost}>キャンセル</button>
                <button onClick={() => {
                  if (!addEventForm.title.trim() || !addEventForm.projectId) return;
                  const proj = projects.find(p => p.id === addEventForm.projectId);
                  if (!proj) return;
                  const newEvent = { id: uid(), title: addEventForm.title.trim(), date: addEventForm.date };
                  onUpdate({ ...proj, events: [...(proj.events || []), newEvent] });
                  setAddEventModal(null);
                }} style={BTN.primary}>追加</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 予定詳細/編集/削除モーダル */}
      {selectedEvent && (
        <div onClick={() => { setSelectedEvent(null); setEditEventMode(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", maxWidth: 360, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.text }}>📅 {editEventMode ? "予定を編集" : selectedEvent.title}</div>
              <button onClick={() => { setSelectedEvent(null); setEditEventMode(false); }} style={btn({ background: "transparent", color: C.muted, fontSize: 18, padding: "0 4px" })}>✕</button>
            </div>
            {editEventMode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>タイトル</label>
                  <input value={editEventForm.title} onChange={e => setEditEventForm(f => ({ ...f, title: e.target.value }))} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 14, outline: "none" }} autoFocus />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>日付</label>
                  <input type="date" value={editEventForm.date} onChange={e => setEditEventForm(f => ({ ...f, date: e.target.value }))} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 14, outline: "none" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>プロジェクト</label>
                  <select value={editEventForm.projectId} onChange={e => setEditEventForm(f => ({ ...f, projectId: e.target.value }))} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 14, outline: "none" }}>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button onClick={() => setEditEventMode(false)} style={BTN.ghost}>キャンセル</button>
                  <button onClick={() => {
                    if (!editEventForm.title.trim() || !editEventForm.projectId) return;
                    const oldProj = projects.find(p => p.id === selectedEvent.pId);
                    const newProj = projects.find(p => p.id === editEventForm.projectId);
                    if (!oldProj || !newProj) return;
                    const updatedEvent = { id: selectedEvent.id, title: editEventForm.title.trim(), date: editEventForm.date };
                    if (oldProj.id === newProj.id) {
                      onUpdate({ ...oldProj, events: (oldProj.events || []).map(e => e.id === selectedEvent.id ? updatedEvent : e) });
                    } else {
                      onUpdate({ ...oldProj, events: (oldProj.events || []).filter(e => e.id !== selectedEvent.id) });
                      onUpdate({ ...newProj, events: [...(newProj.events || []), updatedEvent] });
                    }
                    setSelectedEvent(null); setEditEventMode(false);
                  }} style={BTN.primary}>保存</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
                    <span style={{ color: C.muted, fontWeight: 700, minWidth: 80 }}>📁 プロジェクト</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: selectedEvent.pColor, flexShrink: 0 }} />{selectedEvent.pName}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
                    <span style={{ color: C.muted, fontWeight: 700, minWidth: 80 }}>📅 日付</span>
                    <span>{selectedEvent.date}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => { setEditEventMode(true); setEditEventForm({ title: selectedEvent.title, date: selectedEvent.date, projectId: selectedEvent.pId }); }} style={BTN.ghost}>編集</button>
                  <button onClick={() => {
                    const proj = projects.find(p => p.id === selectedEvent.pId);
                    if (!proj) return;
                    onUpdate({ ...proj, events: (proj.events || []).filter(e => e.id !== selectedEvent.id) });
                    setSelectedEvent(null);
                  }} style={BTN.danger}>🗑 削除</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export { CalendarPage };
