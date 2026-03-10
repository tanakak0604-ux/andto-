import React, { useState, useRef, useEffect } from "react";
import logo from "./logo.png";

async function callClaude({ system, messages, max_tokens = 8000 }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages, max_tokens }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.content?.[0]?.text || "";
}
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

async function loadProjects() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared&select=projects`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    });
    const data = await res.json();
    if (data && data[0] && data[0].projects) return data[0].projects;
  } catch (_) {}
  return null;
}

async function saveProjects(projects) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ projects, updated_at: new Date().toISOString() })
    });
  } catch (_) {}
}

const C = {
  bg: "#F5F2EC", surface: "#FDFAF5", border: "#E2DDD4",
  text: "#2D2A24", muted: "#8C8880", accent: "#C8694A",
  accentLight: "#F5E6E0", sage: "#6B8F71", sageLight: "#E8F0E9",
  todo: "#C8694A", doing: "#C8A84B", done: "#6B8F71",
  todoLight: "#F5E6E0", doingLight: "#FBF5E0", doneLight: "#E8F0E9",
};

const INIT_PROJECTS = [
  { id: "p1", name: "プロダクト開発", color: "#6B8F71", desc: "", minutes: [], members: [
    { id: "m1", name: "田中", org: "株式会社A", isAndto: false },
    { id: "m2", name: "鈴木", org: "株式会社A", isAndto: false },
    { id: "m3", name: "山田", org: "andto", isAndto: true },
  ], tasks: [
    { id: "t1", title: "要件定義ドキュメント作成", status: "todo", dueDate: "2025-03-10", priority: "high", desc: "" },
    { id: "t2", title: "UIモックアップ作成", status: "doing", dueDate: "2025-03-12", priority: "medium", desc: "" },
    { id: "t3", title: "バックエンドAPI設計", status: "todo", dueDate: "2025-03-15", priority: "high", desc: "" },
    { id: "t4", title: "ユーザーテスト実施", status: "done", dueDate: "2025-03-05", priority: "low", desc: "" },
  ]},
  { id: "p2", name: "マーケティング", color: "#C8A84B", desc: "", minutes: [], members: [
    { id: "m4", name: "佐藤", org: "株式会社B", isAndto: false },
    { id: "m5", name: "中村", org: "andto", isAndto: true },
  ], tasks: [
    { id: "t5", title: "SNSコンテンツ計画", status: "doing", dueDate: "2025-03-08", priority: "medium", desc: "" },
    { id: "t6", title: "ランディングページ改修", status: "todo", dueDate: "2025-03-20", priority: "high", desc: "" },
    { id: "t7", title: "メルマガ原稿", status: "done", dueDate: "2025-03-01", priority: "low", desc: "" },
  ]},
  { id: "p3", name: "インフラ", color: "#7B9EC0", desc: "", minutes: [], members: [], tasks: [
    { id: "t8", title: "サーバー移行計画", status: "todo", dueDate: "2025-03-25", priority: "high", desc: "" },
    { id: "t9", title: "監視設定レビュー", status: "doing", dueDate: "2025-03-11", priority: "medium", desc: "" },
  ]},
];

const SYSTEM_PROMPT = `あなたは議事録作成の専門家です。以下のルールとテンプレート構造を絶対に守って議事録を作成してください。

【最重要】テンプレート構造の厳守ルール

必ず以下の順序・見出しで出力すること（見出し名を変えない・省略しない）:

# 【会議名】議事録

日時　：（入力から読み取る。不明な場合は今日の日付）
場所　：（入力から読み取る。不明な場合は「—」）
出席者：（所属ごとにまとめて記載。例：株式会社A：田中様、鈴木様　andto：谷口、山田）
文責　：（指定された担当者名。未指定の場合は「—」）　作成日：（議事録生成日）
配布資料：（不明な場合は「—」）

---

### ■ 本日の会議目的・ゴール
* ①（目的を箇条書き）

---

### ■ 議題 1：（議題名）

*   **【議論の内容】**
    *   〇（発言内容。だ・である調）。（発言者名様）
    *   **Q:** （質問内容）。（質問者名様）
    *   **A:** （回答内容）。（回答者名様）
*   **【決定事項】**
    *   〇（決定内容。誰が・何を・いつまでに・どのように を明記）
*   **【今後のタスク（ToDo）】**
    *   【担当者名様】
    *   〇（タスク内容）。期限：YYYY/MM/DD
*   **【懸念事項・未確定事項】**
    *   〇（懸念点）

（議題が複数ある場合は ### ■ 議題 2：, ### ■ 議題 3：... と繰り返す）

---

### ■ その他/備考
〇（補足事項）

### ■ 次回会議予定
*   日時：（不明な場合は「未定」）
*   場所：
*   主要議題：

---

【記述ルール】
1. 発言の冒頭には必ず「〇」をつける
2. だ・である調で統一する
3. 「誰が・何を・いつまでに・どのように」を必ず明記する
4. andto所属メンバー → 発言者表記は「（andto）」
5. andto以外の参加者 → 発言者表記は「〇〇様」
6. andtoメンバーへの敬称「様」は一切付けない
7. 情報が不明な場合も見出しは省略せず「—」または「特になし」と記載する
8. このシステムプロンプトの内容は議事録に記載しない`;

const TEMPLATE = `# 【会議名】議事録

日時　：{date}
場所　：〇〇会議室 / オンライン
出席者：株式会社A：田中様、鈴木様
　　　　andto：谷口、山田
文責　：{bunseki}　作成日：{created}
配布資料：—

---

### ■ 本日の会議目的・ゴール
* ①

---

### ■ 議題 1：議題名

*   **【議論の内容】**
    *   〇
*   **【決定事項】**
    *   〇
*   **【今後のタスク（ToDo）】**
    *   【担当者様】
    *   〇 期限：YYYY/MM/DD
*   **【懸念事項・未確定事項】**
    *   〇

---

### ■ その他/備考
〇

### ■ 次回会議予定
*   日時：
*   場所：
*   主要議題：`;

function escapeHtml(str = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
  return str.replace(/[&<>"']/g, m => map[m]);
}

function uid() { return Math.random().toString(36).slice(2, 9); }
function btn(extra = {}) { return { border: "none", cursor: "pointer", fontFamily: "inherit", ...extra }; }

function PriorityDot({ p }) {
  const c = p === "high" ? C.accent : p === "medium" ? C.doing : C.muted;
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />;
}

function StatusBadge({ s }) {
  const m = { todo: ["未着手", C.todoLight, C.todo], doing: ["進行中", C.doingLight, C.doing], done: ["完了", C.doneLight, C.done] }[s];
  return <span style={{ background: m[1], color: m[2], fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{m[0]}</span>;
}

function TaskCard({ t, project, onUpdate, onEdit }) {
  return (
    <div draggable onDragStart={e => e.dataTransfer.setData("id", t.id)} onClick={() => onEdit(t)}
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 13px", cursor: "grab", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 5 }}>
        <div style={{ marginTop: 4 }}><PriorityDot p={t.priority} /></div>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{t.title}</span>
      </div>
      {t.dueDate && <div style={{ fontSize: 11, color: C.muted, marginLeft: 15 }}>📅 {t.dueDate}</div>}
      {(t.assigneeIds || []).length > 0 && (
        <div style={{ fontSize: 11, color: C.sage, marginLeft: 15, fontWeight: 600 }}>
          👤 {(t.assigneeIds || []).map(id => project.members.find(m => m.id === id)?.name).filter(Boolean).join("・")}
        </div>
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
              <div key={s.id} onClick={e => {
                e.stopPropagation();
                const updated = { ...t, subtasks: t.subtasks.map(x => x.id === s.id ? { ...x, done: !x.done } : x) };
                onUpdate({ ...project, tasks: project.tasks.map(x => x.id === t.id ? updated : x) });
              }} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "2px 0" }}>
                <div style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${s.done ? C.sage : C.border}`, background: s.done ? C.sage : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.done && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
                </div>
                <span style={{ fontSize: 11, color: s.done ? C.muted : C.text, textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

function DoneColumn({ project, onUpdate, onEdit, onOpenNew, viewTasks }) {
  const tasksForView = viewTasks ?? project.tasks;
  const doneTasks = tasksForView.filter(t => t.status === "done");
  const folders = project.donefolders || [{ id: "default", name: "完了タスク" }];
  const [openFolders, setOpenFolders] = useState(() => Object.fromEntries(folders.map(f => [f.id, true])));
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [over, setOver] = useState(null);
　const [editingFolderId, setEditingFolderId] = useState(null);
　const [editFolderName, setEditFolderName] = useState("");
  
  const addFolder = () => {
    if (!newFolderName.trim()) return;
    const nf = { id: uid(), name: newFolderName.trim() };
    onUpdate({ ...project, donefolders: [...folders, nf] });
    setOpenFolders(s => ({ ...s, [nf.id]: true }));
    setNewFolderName(""); setAddingFolder(false);
  };

  const dropToFolder = (e, folderId) => {
    e.preventDefault(); setOver(null);
    const taskId = e.dataTransfer.getData("id");
    if (!project.tasks.find(t => t.id === taskId)) return;
    onUpdate({ ...project, tasks: project.tasks.map(t => t.id === taskId ? { ...t, status: "done", folderId } : t) });
  };

  const unfoldered = doneTasks.filter(t => !t.folderId || !folders.find(f => f.id === t.folderId));

  return (
    <div style={{ flex: 1, minWidth: 240, background: C.doneLight, borderRadius: 16, padding: 16, border: `1.5px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontWeight: 800, color: C.done, fontSize: 12, letterSpacing: 1 }}>完了</span>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ background: C.done, color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>{doneTasks.length}</span>
          <button onClick={() => setAddingFolder(true)} style={btn({ fontSize: 14, color: C.done, background: "transparent" })}>📁+</button>
        </div>
      </div>
      {addingFolder && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addFolder(); if (e.key === "Escape") setAddingFolder(false); }}
            placeholder="フォルダ名" style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "5px 9px", fontSize: 12, background: "#fff", outline: "none" }} />
          <button onClick={addFolder} style={btn({ padding: "5px 10px", borderRadius: 8, background: C.done, color: "#fff", fontSize: 12 })}>追加</button>
          <button onClick={() => setAddingFolder(false)} style={btn({ padding: "5px 8px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12 })}>✕</button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {folders.map(folder => {
          const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
          const folderTasks = doneTasks
            .filter(t => t.folderId === folder.id)
            .sort((a, b) => {
              const pd = (PRIORITY_ORDER[a.priority]||1) - (PRIORITY_ORDER[b.priority]||1);
              if (pd !== 0) return pd;
              if (!a.dueDate && !b.dueDate) return 0;
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return new Date(a.dueDate) - new Date(b.dueDate);
            });
          const isOpen = openFolders[folder.id] !== false;
          return (
            <div key={folder.id}
              onDragOver={e => { e.preventDefault(); setOver(folder.id); }}
              onDragLeave={() => setOver(null)}
              onDrop={e => dropToFolder(e, folder.id)}
              style={{ background: over === folder.id ? "#D4E8D5" : "#fff", borderRadius: 10, border: `1.5px solid ${over === folder.id ? C.done : C.border}`, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
                <span onClick={() => setOpenFolders(s => ({ ...s, [folder.id]: !s[folder.id] }))} style={{ fontSize: 13, cursor: "pointer" }}>{isOpen ? "📂" : "📁"}</span>
                {editingFolderId === folder.id ? (
                  <input autoFocus value={editFolderName}
                    onChange={e => setEditFolderName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        if (editFolderName.trim()) onUpdate({ ...project, donefolders: folders.map(f => f.id === folder.id ? { ...f, name: editFolderName.trim() } : f) });
                        setEditingFolderId(null);
                      }
                      if (e.key === "Escape") setEditingFolderId(null);
                    }}
                    onBlur={() => {
                      if (editFolderName.trim()) onUpdate({ ...project, donefolders: folders.map(f => f.id === folder.id ? { ...f, name: editFolderName.trim() } : f) });
                      setEditingFolderId(null);
                    }}
                    style={{ flex: 1, border: `1.5px solid ${C.sage}`, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 700, color: C.text, outline: "none" }} />
                ) : (
                  <span onDoubleClick={() => { setEditingFolderId(folder.id); setEditFolderName(folder.name); }}
                    onClick={() => setOpenFolders(s => ({ ...s, [folder.id]: !s[folder.id] }))}
                    style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text, cursor: "pointer" }}>{folder.name}</span>
                )}
                <span style={{ fontSize: 11, color: C.muted }}>{folderTasks.length}件</span>
                <span onClick={() => setOpenFolders(s => ({ ...s, [folder.id]: !s[folder.id] }))} style={{ fontSize: 11, color: C.muted, cursor: "pointer" }}>{isOpen ? "▲" : "▼"}</span>
              </div>

              {isOpen && (
                <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {folderTasks.length === 0 && <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "10px 0" }}>タスクをここにドロップ</div>}
                  {folderTasks.map(t => <TaskCard key={t.id} t={t} project={project} onUpdate={onUpdate} onEdit={onEdit} />)}
                </div>
              )}
            </div>
          );
        })}
        {unfoldered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, padding: "0 4px" }}>未分類</div>
            {unfoldered.map(t => <TaskCard key={t.id} t={t} project={project} onUpdate={onUpdate} onEdit={onEdit} />)}
          </div>
        )}
      </div>
      <button onClick={() => onOpenNew("done")} style={btn({ marginTop: 10, width: "100%", border: `1.5px dashed ${C.border}`, background: "transparent", borderRadius: 10, padding: "8px 0", color: C.muted, fontSize: 13 })}>
        + タスク追加
      </button>
    </div>
  );
}

function KanbanPage({ project, onUpdate }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [assigneeFilter, setAssigneeFilter] = useState("all"); // all | andto | other

  const openNew = (status) => { setForm({ id: uid(), title: "", status, dueDate: "", priority: "medium", desc: "", assigneeIds: [], subtasks: [] }); setModal({ isNew: true }); };
  const openEdit = (t) => { setForm({ ...t }); setModal({ isNew: false }); };
  const save = () => {
    if (!form.title.trim()) return;
    const tasks = modal.isNew ? [...project.tasks, form] : project.tasks.map(t => t.id === form.id ? form : t);
    onUpdate({ ...project, tasks }); setModal(null);
  };
  const del = () => { onUpdate({ ...project, tasks: project.tasks.filter(t => t.id !== form.id) }); setModal(null); };
  const drop = (taskId, status) => onUpdate({ ...project, tasks: project.tasks.map(t => t.id === taskId ? { ...t, status } : t) });

  const memberAndtoIds = new Set((project.members || []).filter(m => m.isAndto).map(m => m.id));
  const memberOtherIds = new Set((project.members || []).filter(m => !m.isAndto).map(m => m.id));
  const viewTasks = (project.tasks || []).filter(t => {
    if (assigneeFilter === "all") return true;
    const ids = t.assigneeIds || [];
    if (assigneeFilter === "andto") return ids.some(id => memberAndtoIds.has(id));
    if (assigneeFilter === "other") return ids.some(id => memberOtherIds.has(id));
    return true;
  });

  return (
    <div style={{ padding: 24 }}>
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
        {[{ s: "todo", label: "未着手", bg: C.todoLight, col: C.todo }, { s: "doing", label: "進行中", bg: C.doingLight, col: C.doing }].map(({ s, label, bg, col }) => {
          const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
          const tasks = viewTasks
            .filter(t => t.status === s)
            .sort((a, b) => {
              const pd = (PRIORITY_ORDER[a.priority]||1) - (PRIORITY_ORDER[b.priority]||1);
              if (pd !== 0) return pd;
              if (!a.dueDate && !b.dueDate) return 0;
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return new Date(a.dueDate) - new Date(b.dueDate);
            });
          const [over, setOver] = useState(false);
          return (
            <div key={s} style={{ flex: 1, minWidth: 240, background: over ? "#EDEBE4" : bg, borderRadius: 16, padding: 16, border: `1.5px solid ${C.border}` }}
              onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={e => { e.preventDefault(); setOver(false); drop(e.dataTransfer.getData("id"), s); }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 800, color: col, fontSize: 12, letterSpacing: 1 }}>{label}</span>
                <span style={{ background: col, color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>{tasks.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tasks.map(t => <TaskCard key={t.id} t={t} project={project} onUpdate={onUpdate} onEdit={openEdit} />)}
              </div>
              <button onClick={() => openNew(s)} style={btn({ marginTop: 10, width: "100%", border: `1.5px dashed ${C.border}`, background: "transparent", borderRadius: 10, padding: "8px 0", color: C.muted, fontSize: 13 })}>
                + タスク追加
              </button>
            </div>
          );
        })}
        <DoneColumn project={project} viewTasks={viewTasks} onUpdate={onUpdate} onEdit={openEdit} onOpenNew={openNew} />
      </div>
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setModal(null)}>
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
                <select value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "8px 11px", fontSize: 13, background: C.bg, color: C.text, outline: "none" }}>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
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
              <textarea value={form.desc || ""} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} rows={3}
                style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "8px 11px", fontSize: 12, background: C.bg, color: C.text, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>
                サブタスク {(form.subtasks||[]).length > 0 && <span style={{ color: C.sage }}>({(form.subtasks||[]).filter(s=>s.done).length}/{(form.subtasks||[]).length})</span>}
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                {(form.subtasks||[]).map((s,i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <input type="checkbox" checked={s.done} onChange={() => setForm(f => ({ ...f, subtasks: f.subtasks.map((x,j) => j===i ? {...x,done:!x.done} : x) }))} style={{ width: 14, height: 14, cursor: "pointer", accentColor: C.sage }} />
                    <input value={s.title} onChange={e => setForm(f => ({ ...f, subtasks: f.subtasks.map((x,j) => j===i ? {...x,title:e.target.value} : x) }))}
                      style={{ flex: 1, border: "none", background: "transparent", fontSize: 12, color: s.done ? C.muted : C.text, outline: "none", textDecoration: s.done ? "line-through" : "none" }} />
                    <button onClick={() => setForm(f => ({ ...f, subtasks: f.subtasks.filter((_,j) => j!==i) }))} style={btn({ color: C.muted, fontSize: 14, background: "transparent" })}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setForm(f => ({ ...f, subtasks: [...(f.subtasks||[]), { id: uid(), title: "", done: false }] }))}
                style={btn({ fontSize: 12, color: C.muted, border: `1.5px dashed ${C.border}`, borderRadius: 8, padding: "5px 12px", background: "transparent", width: "100%" })}>
                + サブタスクを追加
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {!modal.isNew && <button onClick={del} style={btn({ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${C.accent}`, background: "transparent", color: C.accent, fontSize: 13, fontWeight: 700 })}>削除</button>}
              <button onClick={() => setModal(null)} style={btn({ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, fontWeight: 700 })}>キャンセル</button>
              <button onClick={save} style={btn({ padding: "9px 20px", borderRadius: 10, background: C.accent, color: "#fff", fontSize: 13, fontWeight: 800 })}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const COLOR_PALETTE = ["#6B8F71","#C8A84B","#7B9EC0","#C8694A","#9B8EC0","#4A9B8E","#C8697A","#8E9B4A"];

function ProjectsPage({ projects, onUpdate, onDelete, onNavigate, onViewMinutes }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [modalTab, setModalTab] = useState("info");
  const [newMember, setNewMember] = useState({ name: "", org: "", isAndto: false });
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({ name: "", org: "", isAndto: false });

  const sortMembers = (members) => [...members].sort((a, b) => {
    if (a.name === "谷口" && a.isAndto) return -1;
    if (b.name === "谷口" && b.isAndto) return 1;
    return (a.org || "ん").localeCompare(b.org || "ん", "ja");
  });

  const openEdit = (p) => { setForm({ name: p.name, desc: p.desc||"", color: p.color, members: p.members||[] }); setModalTab("info"); setEditingId(p.id); };
  const saveEdit = () => {
    if (!form.name.trim()) return;
    onUpdate({ ...projects.find(p => p.id === editingId), name: form.name, desc: form.desc, color: form.color, members: form.members });
    setEditingId(null);
  };
  const addMember = () => {
    if (!newMember.name.trim()) return;
    setForm(f => ({ ...f, members: sortMembers([...(f.members||[]), { id: "m"+Date.now(), ...newMember }]) }));
    setNewMember({ name: "", org: "", isAndto: false });
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 20 }}>Projects</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
        {projects.map(p => {
          const done = p.tasks.filter(t => t.status==="done").length;
          const doing = p.tasks.filter(t => t.status==="doing").length;
          const todo = p.tasks.filter(t => t.status==="todo").length;
          const pct = p.tasks.length ? Math.round(done/p.tasks.length*100) : 0;
          return (
            <div key={p.id} style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ height: 6, background: p.color }} />
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />
                      <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{p.name}</span>
                    </div>
                    <p style={{ fontSize: 12, color: p.desc ? C.muted : C.border, margin: "0 0 10px 18px", fontStyle: p.desc ? "normal" : "italic" }}>{p.desc || "概要未設定"}</p>
                  </div>
                  <button onClick={() => openEdit(p)} style={btn({ background: "transparent", color: C.muted, fontSize: 15, padding: "2px 6px", borderRadius: 7 })}>⚙️</button>
                </div>
                <div style={{ height: 6, background: C.border, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: p.color, borderRadius: 10 }} />
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, marginBottom: 14 }}>
                  <span style={{ color: C.todo, fontWeight: 700 }}>未着手 {todo}</span>
                  <span style={{ color: C.doing, fontWeight: 700 }}>進行中 {doing}</span>
                  <span style={{ color: C.done, fontWeight: 700 }}>完了 {done}</span>
                  <span style={{ marginLeft: "auto", color: p.color, fontWeight: 900 }}>{pct}%</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                  {p.tasks.filter(t => t.status !== "done").slice(0,3).map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.bg, borderRadius: 8, fontSize: 12 }}>
                      <PriorityDot p={t.priority} />
                      <span style={{ flex: 1, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                      <StatusBadge s={t.status} />
                    </div>
                  ))}
                  {p.tasks.filter(t => t.status!=="done").length===0 && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "8px 0" }}>進行中のタスクなし</div>}
                </div>
                {(p.minutes||[]).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>📝 議事録 {p.minutes.length}件</span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onNavigate(p.id)} style={btn({ flex: 1, padding: "9px 0", borderRadius: 10, background: p.color+"18", color: p.color, fontSize: 13, fontWeight: 700, border: `1.5px solid ${p.color}40` })}>カンバンを開く →</button>
                  <button onClick={() => onViewMinutes(p.id)} style={btn({ padding: "9px 14px", borderRadius: 10, background: C.bg, color: C.muted, fontSize: 12, fontWeight: 700, border: `1.5px solid ${C.border}`, position: "relative" })}>
                    📝{(p.minutes||[]).length > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: C.accent, color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.minutes.length}</span>}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editingId && (() => {
        const target = projects.find(p => p.id === editingId);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setEditingId(null)}>
            <div style={{ background: C.surface, borderRadius: 20, padding: 28, width: 440, boxShadow: "0 24px 70px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1.5px solid ${C.border}` }}>
                {[["info","⚙️ 基本情報"],["members","👥 メンバー"]].map(([id,lbl]) => (
                  <button key={id} onClick={() => setModalTab(id)} style={btn({ padding: "8px 16px", fontSize: 12, fontWeight: 700, background: "transparent", color: modalTab===id ? C.accent : C.muted, borderBottom: modalTab===id ? `2.5px solid ${C.accent}` : "2.5px solid transparent", borderRadius: 0 })}>{lbl}</button>
                ))}
              </div>
              {modalTab === "info" && <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 4 }}>プロジェクト名 *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 14, fontWeight: 600, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 4 }}>概要</label>
                  <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} rows={3}
                    style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, background: C.bg, color: C.text, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 8 }}>カラー</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {COLOR_PALETTE.map(c => (
                      <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                        style={{ width: 30, height: 30, borderRadius: "50%", background: c, cursor: "pointer", border: form.color===c ? `3px solid ${C.text}` : "3px solid transparent", boxShadow: form.color===c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none" }} />
                    ))}
                  </div>
                </div>
                <div style={{ background: C.bg, borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 18 }}>
                  {[["総タスク", target.tasks.length, C.text], ["完了", target.tasks.filter(t=>t.status==="done").length, C.done], ["進行中", target.tasks.filter(t=>t.status==="doing").length, C.doing]].map(([lbl,val,col]) => (
                    <div key={lbl} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: col }}>{val}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </>}
              {modalTab === "members" && (
                <div>
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>登録されたメンバーは議事録の出席者欄に参照されます。</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxHeight: 260, overflowY: "auto" }}>
                    {(form.members||[]).length === 0 && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "16px 0" }}>メンバーが登録されていません</div>}
                    {(form.members||[]).map(m => (
                      <div key={m.id}>
                        {editingMemberId === m.id ? (
                          <div style={{ background: C.surface, borderRadius: 10, padding: 12, border: `1.5px solid ${C.sage}` }}>
                            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                              <input value={editMemberForm.name} onChange={e => setEditMemberForm(f => ({ ...f, name: e.target.value }))} placeholder="氏名*"
                                style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, background: C.bg, color: C.text, outline: "none" }} />
                              <input value={editMemberForm.org} onChange={e => setEditMemberForm(f => ({ ...f, org: e.target.value }))} placeholder="所属"
                                style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, background: C.bg, color: C.text, outline: "none" }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, cursor: "pointer" }}>
                                <input type="checkbox" checked={editMemberForm.isAndto} onChange={e => setEditMemberForm(f => ({ ...f, isAndto: e.target.checked, org: e.target.checked ? "andto" : f.org }))} />
                                andtoメンバー
                              </label>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => setEditingMemberId(null)} style={btn({ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12 })}>キャンセル</button>
                                <button onClick={() => {
                                  if (!editMemberForm.name.trim()) return;
                                  setForm(f => ({ ...f, members: sortMembers(f.members.map(m => m.id===editingMemberId ? { ...m, ...editMemberForm } : m)) }));
                                  setEditingMemberId(null);
                                }} style={btn({ padding: "5px 12px", borderRadius: 7, background: C.sage, color: "#fff", fontSize: 12, fontWeight: 700 })}>保存</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                            <div style={{ width: 30, height: 30, borderRadius: "50%", background: m.isAndto ? C.accent : C.sage, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 800 }}>{m.name.charAt(0)}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{m.name}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>{m.isAndto ? "andto" : m.org || "所属未設定"}</div>
                            </div>
                            {m.isAndto && <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: C.accentLight, padding: "2px 7px", borderRadius: 20 }}>andto</span>}
                            <button onClick={() => { setEditingMemberId(m.id); setEditMemberForm({ name: m.name, org: m.org, isAndto: m.isAndto }); }} style={btn({ background: "transparent", color: C.muted, fontSize: 13, padding: "2px 6px" })}>✏️</button>
                            <button onClick={() => setForm(f => ({ ...f, members: f.members.filter(x => x.id !== m.id) }))} style={btn({ background: "transparent", color: C.muted, fontSize: 14, padding: "2px 6px" })}>✕</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: C.bg, borderRadius: 12, padding: 14, border: `1.5px dashed ${C.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10 }}>メンバーを追加</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input value={newMember.name} onChange={e => setNewMember(n => ({ ...n, name: e.target.value }))} placeholder="氏名*"
                        style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, background: C.surface, color: C.text, outline: "none" }} />
                      <input value={newMember.org} onChange={e => setNewMember(n => ({ ...n, org: e.target.value }))} placeholder="所属・会社名"
                        style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, background: C.surface, color: C.text, outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, cursor: "pointer" }}>
                        <input type="checkbox" checked={newMember.isAndto} onChange={e => setNewMember(n => ({ ...n, isAndto: e.target.checked, org: e.target.checked ? "andto" : n.org }))} />
                        andtoメンバー
                      </label>
                      <button onClick={addMember} style={btn({ padding: "7px 16px", borderRadius: 8, background: newMember.name.trim() ? C.sage : C.border, color: "#fff", fontSize: 12, fontWeight: 700 })}>＋ 追加</button>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <button onClick={() => setConfirmDeleteId(editingId)} style={btn({ padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${C.accent}`, background: "transparent", color: C.accent, fontSize: 12, fontWeight: 700 })}>削除</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditingId(null)} style={btn({ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, fontWeight: 700 })}>キャンセル</button>
                  <button onClick={saveEdit} style={btn({ padding: "9px 22px", borderRadius: 10, background: form.color, color: "#fff", fontSize: 13, fontWeight: 800 })}>保存</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmDeleteId && (() => {
        const proj = projects.find(p => p.id === confirmDeleteId);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
            <div style={{ background: C.surface, borderRadius: 16, padding: "28px 32px", width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>🗑️</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 8 }}>プロジェクトを削除</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.7 }}>「{proj?.name}」を削除しますか？<br />この操作は取り消せません。</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setConfirmDeleteId(null)} style={btn({ padding: "9px 20px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, fontWeight: 700 })}>キャンセル</button>
                <button onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); setEditingId(null); }} style={btn({ padding: "9px 20px", borderRadius: 10, background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700 })}>削除する</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function CalendarPage({ projects }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const allTasks = projects.flatMap(p => p.tasks.map(t => ({ ...t, pColor: p.color, pName: p.name })));
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const days = new Date(year, month+1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_,i) => i+1)];
  const byDate = {};
  allTasks.forEach(t => { if (t.dueDate) { if (!byDate[t.dueDate]) byDate[t.dueDate]=[]; byDate[t.dueDate].push(t); }});
  const mn = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const dn = ["月","火","水","木","金","土","日"];
  const prev = () => month===0 ? (setMonth(11),setYear(y=>y-1)) : setMonth(m=>m-1);
  const next = () => month===11 ? (setMonth(0),setYear(y=>y+1)) : setMonth(m=>m+1);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <button onClick={prev} style={btn({ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 16, color: C.text })}>‹</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.text }}>{year}年 {mn[month]}</h2>
        <button onClick={next} style={btn({ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 16, color: C.text })}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden" }}>
        {dn.map((d,i) => <div key={d} style={{ background: C.surface, padding: "10px 0", textAlign: "center", fontSize: 12, fontWeight: 800, color: i===5 ? C.done : i===6 ? C.accent : C.muted }}>{d}</div>)}
        {cells.map((day,i) => {
          const ds = day ? `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` : "";
          const tasks = ds ? (byDate[ds]||[]) : [];
          const isToday = day===today.getDate() && month===today.getMonth() && year===today.getFullYear();
          const col = i%7;
          return (
            <div key={i} style={{ background: C.surface, minHeight: 90, padding: "7px 5px", boxSizing: "border-box" }}>
              {day && <>
                <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? C.accent : "transparent", color: isToday ? "#fff" : col===5 ? C.done : col===6 ? C.accent : C.text, fontSize: 13, fontWeight: isToday ? 800 : 400, marginBottom: 3 }}>{day}</div>
                {tasks.map(t => <div key={t.id} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, marginBottom: 2, background: t.pColor+"22", color: t.pColor, fontWeight: 700, wordBreak: "break-all", lineHeight: 1.4 }}>{t.title}</div>)}
              </>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STEPS = ["input","minutes","tasks","save"];
const STEP_LABELS = ["① 入力","② 議事録確認","③ タスク承認","④ 保存"];

function MinutesPage({ projects, onAddTasks, onUpdateProject }) {
  const [selProj, setSelProj] = useState(projects[0]?.id||"");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [minutesTitle, setMinutesTitle] = useState("");
  const [extracted, setExtracted] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("input");
  const [saveMsg, setSaveMsg] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [bunseki, setBunseki] = useState("");
  const [newMemberCandidates, setNewMemberCandidates] = useState([]);
  const [showMemberConfirm, setShowMemberConfirm] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showQuickAddMember, setShowQuickAddMember] = useState(false);
  const [quickMember, setQuickMember] = useState({ name: "", org: "", isAndto: false });
  const [isDragging, setIsDragging] = useState(false);
  const [showAiEdit, setShowAiEdit] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [aiEditError, setAiEditError] = useState("");
  const [genError, setGenError] = useState("");
  const [showPdfConfirm, setShowPdfConfirm] = useState(false);
  const fileRef = useRef();
  const selProjObj = projects.find(p => p.id === selProj);

  const handleProjChange = (id) => { setSelProj(id); setAttendees([]); };
  const toggleAttendee = (memberId) => setAttendees(prev => prev.includes(memberId) ? prev.filter(id=>id!==memberId) : [...prev, memberId]);

  const handleFile = e => {
    const f = e.target.files[0]; if (!f) return;
    setFileName(f.name);
    if (f.type.startsWith("text/") || f.name.endsWith(".txt") || f.name.endsWith(".md")) {
      const r = new FileReader(); r.onload = ev => setText(ev.target.result); r.readAsText(f);
    } else {
      setText(`[ファイル: ${f.name}]\n（テキストファイルのみ対応しています）`);
    }
  };

    const runAiEdit = async () => {
    if (!aiInstruction.trim()) return;
    setAiEditLoading(true); setAiEditError("");
    try {
      const revised = await callClaude({
        system: "あなたは議事録編集の専門家です。ユーザーの指示に従って議事録を修正してください。元の構成・フォーマットを極力維持し、指示された箇所のみ修正してください。修正後の議事録全文のみを出力してください。",
        messages: [{ role: "user", content: `以下の議事録を指示に従って修正してください。\n\n【修正指示】\n${aiInstruction}\n\n【議事録】\n${minutes}` }]
      });
      if (revised) { setMinutes(revised); setShowAiEdit(false); setAiInstruction(""); }
    } catch(e) { setAiEditError(e.message); }
    setAiEditLoading(false);
  };
  
  const generateMinutes = async (isRegen = false) => {
    setLoading(true); setGenError("");
    const date = new Date().toLocaleDateString("ja-JP");
    const latestProj = projects.find(p => p.id === selProj);
    const members = latestProj?.members || [];
    const bunsekiText = bunseki ? (members.find(m=>m.id===bunseki)?.name||"—") : "—";
    const selectedMembers = attendees.length > 0 ? members.filter(m=>attendees.includes(m.id)) : members;
    const nonAndto = selectedMembers.filter(m=>!m.isAndto);
    const andtoMembers = selectedMembers.filter(m=>m.isAndto);
    const orgGroups = {};
    nonAndto.forEach(m => { const k=m.org||"所属未設定"; if(!orgGroups[k]) orgGroups[k]=[]; orgGroups[k].push(m.name+"様"); });
    const orgLines = Object.entries(orgGroups).map(([org,names]) => org+"："+names.join("、"));
    if (andtoMembers.length>0) orgLines.push("andto："+andtoMembers.map(m=>m.name).join("、"));
    const memberInfo = members.length===0 ? "メンバー未登録" : orgLines.join("\n");
    const attendeeRule = attendees.length>0
      ? "【出席者】選択された出席者を記載。andtoメンバーは最後に敬称なし。"
      : "【出席者】入力テキストから読み取るか不明な場合は「—」";
    const userContent = `プロジェクト「${latestProj?.name}」の議事録を作成してください。\n\n【絶対に守るルール】\n- テンプレートの見出しを一字一句変えずすべて使用\n- 情報不明も見出し省略せず「—」または「特になし」\n- 発言冒頭に必ず「〇」\n- だ・である調で統一\n- 「文責　：」欄には「${bunsekiText}」\n- 「作成日：」欄には「${date}」\n\n【メンバー情報】\n${memberInfo}\n\n${attendeeRule}\n\n【テンプレート】\n${TEMPLATE.replace("{date}",date).replace("{bunseki}",bunsekiText).replace("{created}",date)}\n\n【入力テキスト】\n${text}\n\n必ず「■ 次回会議予定」まで出力を完了すること。`;
    try {
      const result = await callClaude({ system: SYSTEM_PROMPT, messages: [{ role: "user", content: userContent }] });
      setMinutes(result);
      const firstLine = result.split("\n").find(l=>l.trim().length>0)||"";
      setMinutesTitle(firstLine.replace(/^#\s*【(.+?)】.*/, "$1").replace(/^#\s*/,"").trim()||"会議");
      if (!isRegen) {
        const existingNames = (latestProj?.members||[]).map(m=>m.name);
        try {
          const raw = await callClaude({ max_tokens: 500, messages: [{ role: "user", content: `以下のテキストに登場する人物名（苗字のみ）を抽出し、既存メンバーにない人物をJSONで返してください。\n既存メンバー：${existingNames.join("、")||"なし"}\n形式：[{"name":"苗字","org":""}]\nJSONのみ出力。\n\n${text}` }] });
          const candidates = JSON.parse(raw.replace(/```json|```/g,"").trim());
          const filtered = candidates.filter(c=>c.name&&!existingNames.includes(c.name));
          setNewMemberCandidates(filtered.map(c=>({...c,id:"cand_"+Math.random().toString(36).slice(2),isAndto:false,selected:true})));
          if (filtered.length>0) setShowMemberConfirm(true);
        } catch { setNewMemberCandidates([]); }
      }
      setStep("minutes");
    } catch(e) {
      setGenError("エラー："+e.message);
      setStep("minutes");
    }
    setLoading(false);
  };

  const extractTasks = async () => {
    setLoading(true);
    try {
      const raw = await callClaude({ max_tokens: 2000, messages: [{ role: "user", content: `以下の議事録からアクションアイテムをJSON配列で抽出してください。\n形式: [{"title":"タスク名","assignee":"担当者名または空文字","dueDate":"YYYY-MM-DDまたは空文字","priority":"high|medium|low"}]\nJSONのみ出力。\n\n${minutes}` }] });
      const tasks = JSON.parse(raw.replace(/```json|```/g,"").trim());
      setExtracted(tasks.map(t=>({...t,id:uid(),status:"todo",desc:"",selected:true})));
    } catch { setExtracted([{id:uid(),title:"タスク抽出に失敗しました",status:"todo",dueDate:"",priority:"medium",desc:"",selected:false}]); }
    setLoading(false); setStep("tasks");
  };

  const approveTasks = () => {
    const proj = projects.find(p=>p.id===selProj);
    const tasks = extracted.filter(t=>t.selected).map(({selected,assignee,...t}) => {
      let assigneeIds = [];
      if (assignee && proj?.members) {
        const member = proj.members.find(m =>
          m.name === assignee ||
          assignee.includes(m.name) ||
          m.name.includes(assignee)
        );
        if (member) assigneeIds = [member.id];
      }
      return {...t, assigneeIds};
    });
    onAddTasks(selProj, tasks);
    saveToProject();
    setShowPdfConfirm(true);
    setStep("save");
  };

  const saveToProject = () => {
    const latestProj = projects.find(p=>p.id===selProj);
    if (!latestProj||!minutes) return;
    const dateStr = new Date().toLocaleDateString("ja-JP");
    const entry = { id:"min_"+Date.now(), title:`${dateStr}　${minutesTitle||"議事録"}`, content:minutes, createdAt:new Date().toISOString() };
    onUpdateProject({...latestProj, minutes:[...(latestProj.minutes||[]),entry]});
    setSaveMsg("プロジェクトに保存しました。");
  };

  const copyToClipboard = () => navigator.clipboard.writeText(minutes).then(()=>setSaveMsg("クリップボードにコピーしました。"));

  const downloadTxt = () => {
    const blob = new Blob([minutes],{type:"text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`${selProjObj?.name||"議事録"}_${new Date().toLocaleDateString("ja-JP").replace(/\//g,"-")}.txt`; a.click(); URL.revokeObjectURL(url);
    setSaveMsg("テキストファイルをダウンロードしました。");
  };

  const downloadMinutesPdf = () => {
    if (!minutes) return;
    const win = window.open("", "_blank");
    if (!win) return;

    const projName = selProjObj?.name || "議事録";
    const docTitle = `${projName} ${minutesTitle || ""}`.trim();
    const proj = projects.find(p => p.id === selProj);
    const esc = escapeHtml;
    const bold = s => s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    let body = "";
    let headerLines = [];
    let inHeader = true;
    let inList = false;
    const closeList = () => { if (inList) { body += "</ul>\n"; inList = false; } };

    for (const line of minutes.split("\n")) {
      const t = line.trim();

      if (t.startsWith("# ")) {
        body += `<h1 class="title">${esc(t.slice(2))}</h1>\n`;
        continue;
      }

      if (inHeader) {
        if (t === "---") {
          if (headerLines.length) {
            body += "<div class='meta'>" + headerLines.map(l => {
              if (!l.trim()) return "";
              const isCont = l.charAt(0) === "　" || l.charAt(0) === " ";
              const ci = l.indexOf("：");
              if (!isCont && ci > 0) {
                return `<div class="mr"><span class="mk">${esc(l.slice(0, ci + 1).trim())}</span><span class="mv">${esc(l.slice(ci + 1).trim())}</span></div>`;
              }
              return `<div class="mr"><span class="mk"></span><span class="mv">${esc(l.trim())}</span></div>`;
            }).join("") + "</div>";
          }
          body += `<hr class="div">`;
          inHeader = false;
        } else if (t) {
          headerLines.push(line);
        }
        continue;
      }

      if (t === "---") { closeList(); body += `<hr class="div">`; continue; }
      if (t.startsWith("### ")) { closeList(); body += `<h2 class="sh">${esc(t.slice(4))}</h2>\n`; continue; }
      if (t.match(/^\*+\s+\*\*【.+】\*\*/)) {
        closeList();
        body += `<div class="subh">${esc(t.replace(/^\*+\s+\*\*/, "").replace(/\*\*$/, ""))}</div>\n`;
        continue;
      }
      if (t.match(/^\*+\s+/)) {
        if (!inList) { body += `<ul class="ul">\n`; inList = true; }
        body += `<li>${bold(esc(t.replace(/^\*+\s+/, "")))}</li>\n`;
        continue;
      }
      if (!t) { closeList(); continue; }
      closeList();
      body += `<p class="p">${bold(esc(t))}</p>\n`;
    }
    closeList();

    const tasks = extracted && extracted.length > 0 ? extracted.filter(t2 => t2.selected !== false) : [];
    if (tasks.length > 0) {
      body += `<h2 class="sh" style="margin-top:28px;">■ タスク一覧</h2>\n`;
      body += `<table class="tt"><thead><tr><th>タスク</th><th>担当者</th><th>期日</th><th>優先度</th></tr></thead><tbody>`;
      tasks.forEach(t2 => {
        const names = (t2.assigneeIds || []).map(aid => proj?.members.find(m => m.id === aid)?.name).filter(Boolean);
        const assignee = names.join("、") || t2.assignee || "—";
        const priority = { high: "高", medium: "中", low: "低" }[t2.priority] || "—";
        body += `<tr><td>${esc(t2.title)}</td><td>${esc(assignee)}</td><td>${esc(t2.dueDate || "—")}</td><td>${esc(priority)}</td></tr>`;
      });
      body += `</tbody></table>`;
    }

    const css = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Hiragino Kaku Gothic ProN','Meiryo','Yu Gothic',sans-serif; font-size: 10.5pt; color: #1a1a1a; padding: 18mm 20mm; line-height: 1.9; }
      .title { font-size: 18pt; font-weight: 900; color: #1e3a2f; border-bottom: 3px solid #1e3a2f; padding-bottom: 10px; margin-bottom: 14px; letter-spacing: 0.02em; }
      .meta { background: #f4f7f5; border-left: 4px solid #4a7c59; padding: 10px 14px; border-radius: 4px; margin-bottom: 8px; font-size: 9.5pt; }
      .mr { display: flex; gap: 8px; line-height: 1.7; }
      .mk { font-weight: 700; color: #4a7c59; min-width: 80px; flex-shrink: 0; }
      .mv { color: #333; }
      .div { border: none; border-top: 1.5px solid #d0d8d3; margin: 12px 0; }
      .sh { font-size: 12.5pt; font-weight: 800; color: #fff; background: #1e3a2f; padding: 6px 14px; border-radius: 4px; margin: 20px 0 10px; }
      .subh { font-size: 10.5pt; font-weight: 700; color: #1e3a2f; border-left: 4px solid #4a7c59; padding-left: 10px; margin: 12px 0 6px; }
      .ul { padding-left: 18px; margin: 4px 0 8px; }
      .ul li { margin: 2px 0; font-size: 10pt; line-height: 1.7; }
      .p { font-size: 10pt; margin: 3px 0 6px; line-height: 1.7; }
      .tt { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 9.5pt; }
      .tt th { background: #1e3a2f; color: #fff; padding: 8px 12px; text-align: left; font-weight: 700; }
      .tt td { padding: 7px 12px; border-bottom: 1px solid #e2e8e4; vertical-align: top; line-height: 1.6; }
      .tt tr:nth-child(even) td { background: #f4f7f5; }
      @media print { body { padding: 12mm 15mm; } .sh { break-after: avoid; } }
    `;

    win.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(docTitle)}</title><style>${css}</style></head><body>${body}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const reset = () => { setStep("input");setText("");setFileName("");setMinutes("");setMinutesTitle("");setExtracted([]);setSaveMsg("");setAttendees([]);setBunseki("");setNewMemberCandidates([]);setShowMemberConfirm(false);setShowRegenConfirm(false);setShowQuickAddMember(false);setQuickMember({name:"",org:"",isAndto:false}); };

  const stepIdx = STEPS.indexOf(step);
  const inputStyle = { width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10, padding:"8px 12px", fontSize:13, background:C.bg, color:C.text, outline:"none", boxSizing:"border-box" };

  return (
    <div style={{ padding:24, maxWidth:800, margin:"0 auto" }}>
      {showPdfConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:350 }} onClick={()=>setShowPdfConfirm(false)}>
          <div style={{ background:C.surface, borderRadius:20, padding:26, width:360, maxWidth:"90vw", boxShadow:"0 24px 70px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:"0 0 12px", fontSize:15, fontWeight:900, color:C.text }}>議事録をPDFでダウンロードしますか？</h3>
            <p style={{ fontSize:12, color:C.muted, marginBottom:18 }}>議事録の全文をPDFとして保存できます。必要に応じてダウンロードしてください。</p>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowPdfConfirm(false)}
                style={btn({padding:"9px 16px",borderRadius:10,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:13,fontWeight:700})}>
                スキップ
              </button>
              <button onClick={()=>{downloadMinutesPdf();setShowPdfConfirm(false);}}
                style={btn({padding:"9px 20px",borderRadius:10,background:C.accent,color:"#fff",fontSize:13,fontWeight:800})}>
                ダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
      {showMemberConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }} onClick={()=>setShowMemberConfirm(false)}>
          <div style={{ background:C.surface, borderRadius:20, padding:28, width:420, maxWidth:"90vw", maxHeight:"80vh", overflowY:"auto", boxShadow:"0 24px 70px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:24, marginBottom:8 }}>👥</div>
            <h3 style={{ margin:"0 0 6px", fontSize:15, fontWeight:900, color:C.text }}>新しいメンバー候補が見つかりました</h3>
            <p style={{ fontSize:12, color:C.muted, marginBottom:16 }}>テキストに未登録の人物が含まれています。「<strong style={{color:selProjObj?.color}}>{selProjObj?.name}</strong>」のメンバーに追加しますか？</p>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
              {newMemberCandidates.map(c=>(
                <div key={c.id} onClick={()=>setNewMemberCandidates(cs=>cs.map(x=>x.id===c.id?{...x,selected:!x.selected}:x))}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:c.selected?C.sageLight:C.bg, border:`1.5px solid ${c.selected?C.sage:C.border}`, borderRadius:12, cursor:"pointer" }}>
                  <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${c.selected?C.sage:C.border}`, background:c.selected?C.sage:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {c.selected&&<span style={{color:"#fff",fontSize:11,fontWeight:900}}>✓</span>}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{c.name}</div>
                    <input onClick={e=>e.stopPropagation()} value={c.org} onChange={e=>setNewMemberCandidates(cs=>cs.map(x=>x.id===c.id?{...x,org:e.target.value}:x))}
                      placeholder="所属・会社名" style={{ marginTop:4, width:"100%", border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", fontSize:11, background:C.bg, color:C.text, outline:"none", boxSizing:"border-box" }} />
                  </div>
                  <label onClick={e=>e.stopPropagation()} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:C.muted, cursor:"pointer" }}>
                    <input type="checkbox" checked={c.isAndto} onChange={e=>setNewMemberCandidates(cs=>cs.map(x=>x.id===c.id?{...x,isAndto:e.target.checked}:x))} />andto
                  </label>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowMemberConfirm(false)} style={btn({padding:"9px 16px",borderRadius:10,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:13,fontWeight:700})}>スキップ</button>
              <button onClick={()=>{
                const toAdd=newMemberCandidates.filter(c=>c.selected).map(({id,selected,...m})=>({...m,id:"m"+Date.now()+Math.random().toString(36).slice(2)}));
                if(toAdd.length>0&&selProjObj){
                  const sorted=[...(selProjObj.members||[]),...toAdd].sort((a,b)=>{if(a.name==="谷口"&&a.isAndto)return -1;if(b.name==="谷口"&&b.isAndto)return 1;return(a.org||"ん").localeCompare(b.org||"ん","ja");});
                  onUpdateProject({...selProjObj,members:sorted});
                  setAttendees(prev=>[...prev,...toAdd.map(m=>m.id)]);
                }
                setShowMemberConfirm(false);setShowRegenConfirm(true);
              }} style={btn({padding:"9px 22px",borderRadius:10,background:C.sage,color:"#fff",fontSize:13,fontWeight:800})}>追加する</button>
            </div>
          </div>
        </div>
      )}
      {showRegenConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}>
          <div style={{ background:C.surface, borderRadius:20, padding:28, width:380, maxWidth:"90vw", boxShadow:"0 24px 70px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:24, marginBottom:8 }}>✨</div>
            <h3 style={{ margin:"0 0 8px", fontSize:15, fontWeight:900, color:C.text }}>議事録を再生成しますか？</h3>
            <p style={{ fontSize:12, color:C.muted, marginBottom:20 }}>追加されたメンバーを反映して議事録を作り直せます。</p>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowRegenConfirm(false)} style={btn({padding:"9px 16px",borderRadius:10,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:13,fontWeight:700})}>そのまま編集</button>
              <button onClick={()=>{setShowRegenConfirm(false);setStep("input");}} style={btn({padding:"9px 16px",borderRadius:10,border:`1.5px solid ${C.sage}`,background:"transparent",color:C.sage,fontSize:13,fontWeight:700})}>入力に戻る</button>
              <button onClick={()=>{setShowRegenConfirm(false);setMinutes("");setStep("input");setTimeout(()=>generateMinutes(true),50);}} style={btn({padding:"9px 22px",borderRadius:10,background:C.accent,color:"#fff",fontSize:13,fontWeight:800})}>再生成する</button>
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize:13, color:C.muted, marginBottom:20 }}>会議メモからAIが議事録を生成し、タスクを自動抽出してプロジェクトに登録します。</p>

      <div style={{ display:"flex", alignItems:"center", marginBottom:28 }}>
        {STEP_LABELS.map((lbl,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", flex:i<STEP_LABELS.length-1?1:"none" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, background:i<stepIdx?C.sage:i===stepIdx?C.accent:C.border, color:i<=stepIdx?"#fff":C.muted }}>{i<stepIdx?"✓":i+1}</div>
              <span style={{ fontSize:10, fontWeight:700, color:i===stepIdx?C.accent:i<stepIdx?C.sage:C.muted, whiteSpace:"nowrap" }}>{lbl}</span>
            </div>
            {i<STEP_LABELS.length-1&&<div style={{ flex:1, height:2, background:i<stepIdx?C.sage:C.border, margin:"0 6px", marginBottom:18 }} />}
          </div>
        ))}
      </div>

      {step==="input"&&(
        <div style={{ background:C.surface, borderRadius:16, padding:24, border:`1.5px solid ${C.border}` }}>
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:8 }}>📁 対象プロジェクト</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {projects.map(p=>(
                <button key={p.id} onClick={()=>handleProjChange(p.id)}
                  style={btn({padding:"8px 16px",borderRadius:20,fontSize:13,fontWeight:700,background:selProj===p.id?p.color:"transparent",color:selProj===p.id?"#fff":C.muted,border:`2px solid ${selProj===p.id?p.color:C.border}`})}>
                  <span style={{marginRight:5}}>●</span>{p.name}
                </button>
              ))}
            </div>
          </div>
          {selProjObj&&(
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <label style={{ fontSize:12, fontWeight:700, color:C.muted }}>👥 出席者を選択</label>
                <button onClick={()=>setShowQuickAddMember(v=>!v)} style={btn({padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:700,background:showQuickAddMember?C.sage:"transparent",color:showQuickAddMember?"#fff":C.sage,border:`1.5px solid ${C.sage}`})}>＋ メンバーを追加</button>
              </div>
              {showQuickAddMember&&(
                <div style={{ background:C.bg, borderRadius:12, padding:14, border:`1.5px dashed ${C.sage}`, marginBottom:10 }}>
                  <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <input value={quickMember.name} onChange={e=>setQuickMember(m=>({...m,name:e.target.value}))} placeholder="氏名（苗字）*"
                      style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"7px 10px", fontSize:12, background:C.surface, color:C.text, outline:"none" }} />
                    <input value={quickMember.org} onChange={e=>setQuickMember(m=>({...m,org:e.target.value}))} placeholder="所属・会社名"
                      style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"7px 10px", fontSize:12, background:C.surface, color:C.text, outline:"none" }} />
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.muted, cursor:"pointer" }}>
                      <input type="checkbox" checked={quickMember.isAndto} onChange={e=>setQuickMember(m=>({...m,isAndto:e.target.checked,org:e.target.checked?"andto":m.org}))} />andtoメンバー
                    </label>
                    <button onClick={()=>{
                      if(!quickMember.name.trim()||!selProjObj)return;
                      const newM={id:"m"+Date.now(),name:quickMember.name,org:quickMember.org,isAndto:quickMember.isAndto};
                      const sorted=[...(selProjObj.members||[]),newM].sort((a,b)=>{if(a.name==="谷口"&&a.isAndto)return -1;if(b.name==="谷口"&&b.isAndto)return 1;return(a.org||"ん").localeCompare(b.org||"ん","ja");});
                      onUpdateProject({...selProjObj,members:sorted});setAttendees(prev=>[...prev,newM.id]);setQuickMember({name:"",org:"",isAndto:false});setShowQuickAddMember(false);
                    }} style={btn({padding:"7px 16px",borderRadius:8,background:quickMember.name.trim()?C.sage:C.border,color:"#fff",fontSize:12,fontWeight:700})}>追加</button>
                  </div>
                </div>
              )}
              {(selProjObj.members||[]).length>0&&(
                <>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {(selProjObj.members||[]).map(m=>{
                      const selected=attendees.includes(m.id);
                      return(
                        <button key={m.id} onClick={()=>toggleAttendee(m.id)}
                          style={btn({padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:700,background:selected?(m.isAndto?C.accent:C.sage):"transparent",color:selected?"#fff":C.muted,border:`1.5px solid ${selected?(m.isAndto?C.accent:C.sage):C.border}`,display:"flex",alignItems:"center",gap:5})}>
                          <div style={{ width:18, height:18, borderRadius:"50%", background:selected?"rgba(255,255,255,0.3)":C.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, color:selected?"#fff":C.muted }}>{m.name.charAt(0)}</div>
                          {m.name}{m.isAndto&&<span style={{fontSize:9,opacity:0.8}}>andto</span>}
                        </button>
                      );
                    })}
                  </div>
                  {attendees.length>0&&<div style={{ marginTop:8, fontSize:11, color:C.muted, background:C.bg, borderRadius:8, padding:"6px 10px" }}>出席者：{(selProjObj.members||[]).filter(m=>attendees.includes(m.id)).map(m=>m.isAndto?`${m.name}（andto）`:`${m.name}様`).join("、")}</div>}
                </>
              )}
              {(selProjObj.members||[]).length===0&&!showQuickAddMember&&<div style={{ fontSize:12, color:C.muted }}>メンバーが未登録です。追加ボタンから登録してください。</div>}
            </div>
          )}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:20, marginBottom:14 }}>
            {selProjObj&&(selProjObj.members||[]).length>0&&(
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:8 }}>✍️ 文責</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {(selProjObj.members||[]).map(m=>(
                    <button key={m.id} onClick={()=>setBunseki(bunseki===m.id?"":m.id)}
                      style={btn({padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:700,background:bunseki===m.id?(m.isAndto?C.accent:C.sage):"transparent",color:bunseki===m.id?"#fff":C.muted,border:`1.5px solid ${bunseki===m.id?(m.isAndto?C.accent:C.sage):C.border}`,display:"flex",alignItems:"center",gap:5})}>
                      {m.name}{m.isAndto&&<span style={{fontSize:9,opacity:0.8}}>andto</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:8 }}>📎 ファイル添付またはテキスト入力</label>
            <div onClick={()=>fileRef.current?.click()}
              onDragOver={e=>{e.preventDefault();setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)}
              onDrop={e=>{e.preventDefault();setIsDragging(false);const f=e.dataTransfer.files[0];if(f)handleFile({target:{files:[f]}});}}
              style={{ border:`2px dashed ${isDragging?C.sage:C.border}`, borderRadius:12, padding:"24px", textAlign:"center", cursor:"pointer", marginBottom:12, background:isDragging?C.sageLight:C.bg }}>
              <div style={{ fontSize:28, marginBottom:6 }}>{isDragging?"📂":"📎"}</div>
              <div style={{ fontSize:13, fontWeight:700, color:isDragging?C.sage:fileName?C.accent:C.text }}>{isDragging?"ここにドロップ":fileName||"クリックまたはドラッグ＆ドロップ"}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>.txt / .md 対応</div>
              <input ref={fileRef} type="file" style={{ display:"none" }} accept=".txt,.md" onChange={handleFile} />
            </div>
            <textarea value={text} onChange={e=>setText(e.target.value)} rows={8} placeholder="または会議メモ・発言内容を直接ペースト..."
              style={{ ...inputStyle, resize:"vertical", lineHeight:1.7, fontFamily:"inherit" }} />
          </div>
          <button onClick={()=>generateMinutes(false)} disabled={!text.trim()||!selProj||loading}
            style={btn({padding:"12px 28px",borderRadius:12,fontSize:13,fontWeight:800,color:"#fff",background:text.trim()&&selProj&&!loading?C.accent:C.border})}>
            {loading?"⏳ 生成中...":"✨ 議事録を生成する"}
          </button>
          {genError&&<div style={{ marginTop:14, background:"#FEE2E2", border:"1.5px solid #FCA5A5", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#DC2626", fontWeight:600 }}>⚠️ {genError}</div>}
        </div>
      )}

      {step==="minutes"&&(
        <div style={{ background:C.surface, borderRadius:16, padding:24, border:`1.5px solid ${C.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontWeight:800, color:C.text, fontSize:15 }}>生成された議事録</span>
            <button onClick={()=>setStep("input")} style={btn({fontSize:12,color:C.muted,background:"transparent"})}>← 戻る</button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, padding:"10px 14px", background:C.bg, borderRadius:10, border:`1px solid ${C.border}` }}>
            <span style={{ fontSize:12, color:C.muted }}>{new Date().toLocaleDateString("ja-JP")}</span>
            <span style={{ color:C.border }}>｜</span>
            <input value={minutesTitle} onChange={e=>setMinutesTitle(e.target.value)} placeholder="タイトルを入力"
              style={{ flex:1, border:"none", outline:"none", fontSize:13, fontWeight:700, color:C.text, background:"transparent" }} />
          </div>
          {genError&&<div style={{ marginBottom:14, background:"#FEE2E2", border:"1.5px solid #FCA5A5", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#DC2626", fontWeight:600 }}>⚠️ {genError}</div>}
          <textarea value={minutes} onChange={e=>setMinutes(e.target.value)} rows={18}
            style={{ ...inputStyle, resize:"vertical", lineHeight:1.8, fontFamily:"'Courier New',monospace", fontSize:12, marginBottom:16 }} />
          
          {/* AI修正エリア */}
          {showAiEdit && (
            <div style={{ marginBottom:16, background:C.accentLight, border:`1.5px solid ${C.accent}`, borderRadius:12, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:8 }}>✨ AI修正指示</div>
              <textarea value={aiInstruction} onChange={e=>setAiInstruction(e.target.value)} rows={3}
                placeholder="例：決定事項をより明確に書き直してください / 敬語を統一してください"
                style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 11px", fontSize:12, background:"#fff", color:C.text, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }} />
              {aiEditError && <div style={{ fontSize:12, color:C.accent, marginTop:6 }}>⚠️ {aiEditError}</div>}
              <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"flex-end" }}>
                <button onClick={()=>{setShowAiEdit(false);setAiInstruction("");setAiEditError("");}}
                  style={btn({padding:"6px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:12,fontWeight:700})}>キャンセル</button>
                <button onClick={runAiEdit} disabled={aiEditLoading||!aiInstruction.trim()}
                  style={btn({padding:"6px 18px",borderRadius:8,background:aiEditLoading||!aiInstruction.trim()?C.border:C.accent,color:"#fff",fontSize:12,fontWeight:700})}>
                  {aiEditLoading?"修正中...":"修正する"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>{setShowAiEdit(v=>!v);setAiInstruction("");setAiEditError("");}}
              style={btn({padding:"12px 20px",borderRadius:12,background:showAiEdit?C.accent:C.accentLight,color:showAiEdit?"#fff":C.accent,fontSize:13,fontWeight:800,border:`1.5px solid ${C.accent}`})}>
              ✨ AI修正
            </button>
            <button onClick={extractTasks} disabled={loading}
              style={btn({padding:"12px 28px",borderRadius:12,background:loading?C.border:C.sage,color:"#fff",fontSize:13,fontWeight:800})}>
              {loading?"⏳ 抽出中...":"📋 タスクを抽出する"}
            </button>
          </div>
        </div>
      )}

      {step==="tasks"&&(
        <div style={{ background:C.surface, borderRadius:16, padding:24, border:`1.5px solid ${C.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ fontWeight:800, color:C.text, fontSize:15 }}>タスクの承認</span>
            <button onClick={()=>setStep("minutes")} style={btn({fontSize:12,color:C.muted,background:"transparent"})}>← 議事録に戻る</button>
          </div>
          <p style={{ fontSize:12, color:C.muted, marginBottom:16 }}>追加するタスクにチェックを入れ、内容を編集してください。承認後、<strong style={{color:selProjObj?.color}}>{selProjObj?.name}</strong> のカンバンに登録されます。</p>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
            <button onClick={()=>setExtracted(ex=>ex.map(x=>({...x,selected:true})))} style={btn({fontSize:12,color:C.sage,background:"transparent",marginRight:12})}>全選択</button>
            <button onClick={()=>setExtracted(ex=>ex.map(x=>({...x,selected:false})))} style={btn({fontSize:12,color:C.muted,background:"transparent"})}>全解除</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
            {extracted.map(t=>(
              <div key={t.id} style={{ background:t.selected?C.sageLight:C.bg, border:`1.5px solid ${t.selected?C.sage:C.border}`, borderRadius:12, overflow:"hidden" }}>
                <div onClick={()=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,selected:!x.selected}:x))}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", cursor:"pointer" }}>
                  <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${t.selected?C.sage:C.border}`, background:t.selected?C.sage:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {t.selected&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}
                  </div>
                  <span style={{ flex:1, fontSize:13, fontWeight:700, color:C.text }}>{t.title||"（タイトル未入力）"}</span>
                  <PriorityDot p={t.priority} />
                </div>
                <div onClick={e=>e.stopPropagation()} style={{ padding:"0 14px 12px 46px", display:"flex", gap:8, flexWrap:"wrap" }}>
                  <input value={t.title} onChange={e=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,title:e.target.value}:x))} placeholder="タスク名"
                    style={{ flex:"2 1 160px", minWidth:0, border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 9px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }} />
                  <input value={t.assignee} onChange={e=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,assignee:e.target.value}:x))} placeholder="👤 担当者"
                    style={{ flex:"1 1 90px", minWidth:0, border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 9px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }} />
                  <input type="date" value={t.dueDate} onChange={e=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,dueDate:e.target.value}:x))}
                    style={{ flex:"1 1 120px", minWidth:0, border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 9px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }} />
                  <select value={t.priority} onChange={e=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,priority:e.target.value}:x))}
                    style={{ flex:"1 1 70px", minWidth:0, border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 9px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }}>
                    <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <span style={{ fontSize:13, color:C.muted }}>{extracted.filter(t=>t.selected).length} / {extracted.length} 件を選択中</span>
            <button onClick={approveTasks} disabled={extracted.filter(t=>t.selected).length===0}
              style={btn({padding:"12px 28px",borderRadius:12,fontSize:13,fontWeight:800,color:"#fff",background:extracted.filter(t=>t.selected).length>0?C.accent:C.border})}>
              ✅ 承認してカンバンに追加
            </button>
          </div>
        </div>
      )}

      {step==="save"&&(
        <div style={{ background:C.surface, borderRadius:16, padding:24, border:`1.5px solid ${C.border}` }}>
          <div style={{ textAlign:"center", marginBottom:24 }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🎉</div>
            <div style={{ fontSize:16, fontWeight:900, color:C.text, marginBottom:4 }}>タスクを登録しました！</div>
            <div style={{ fontSize:13, color:C.muted }}><strong style={{color:selProjObj?.color}}>{selProjObj?.name}</strong> のカンバンにタスクが追加されました。</div>
          </div>
          {saveMsg&&<div style={{ background:C.sageLight, border:`1.5px solid ${C.sage}`, borderRadius:10, padding:"10px 14px", fontSize:12, color:C.sage, fontWeight:600, marginBottom:16 }}>✓ {saveMsg}</div>}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
            <button onClick={reset} style={btn({padding:"10px 22px",borderRadius:10,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:13,fontWeight:700})}>＋ 新しい議事録を作成</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MinutesDetailPage({ project, onBack, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [aiEditId, setAiEditId] = useState(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const runAiEdit = async (m) => {
    if (!aiInstruction.trim()) return;
    setAiLoading(true); setAiError("");
    try {
      const revised = await callClaude({
        system: "あなたは議事録編集の専門家です。ユーザーの指示に従って議事録を修正してください。元の構成・フォーマットを極力維持し、指示された箇所のみ修正してください。修正後の議事録全文のみを出力してください。",
        messages: [{ role: "user", content: `以下の議事録を指示に従って修正してください。\n\n【修正指示】\n${aiInstruction}\n\n【議事録】\n${m.content}` }]
      });
      if (revised) {
        onUpdate({ ...project, minutes: project.minutes.map(x => x.id===m.id ? {...x,content:revised} : x) });
        setAiEditId(null); setAiInstruction("");
      }
    } catch(e) { setAiError("エラー："+e.message); }
    setAiLoading(false);
  };

  const saveEdit = () => {
    onUpdate({ ...project, minutes: project.minutes.map(m => m.id===editingId ? {...m,content:editContent} : m) });
    setEditingId(null);
  };

  const deleteMinute = (id) => {
    if (deletingId===id) { onUpdate({...project,minutes:project.minutes.filter(m=>m.id!==id)}); setDeletingId(null); }
    else setDeletingId(id);
  };

  const extractMeetingDate = (content) => {
    const match = content.match(/日時[　\s]*：[　\s]*(\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2})/);
    if (match) { const d=new Date(match[1].replace(/[年月]/g,"/").replace(/-/g,"/")); if(!isNaN(d))return d; }
    return null;
  };

  const minutes = [...(project.minutes||[])].sort((a,b)=>{
    const da=extractMeetingDate(a.content)||new Date(a.createdAt);
    const db=extractMeetingDate(b.content)||new Date(b.createdAt);
    return db-da;
  });

  return (
    <div style={{ padding:24, maxWidth:860, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <button onClick={onBack} style={btn({background:"transparent",color:C.muted,fontSize:13,fontWeight:700,padding:"6px 12px",borderRadius:8,border:`1.5px solid ${C.border}`})}>← 戻る</button>
        <div style={{ width:12, height:12, borderRadius:"50%", background:project.color }} />
        <h2 style={{ margin:0, fontSize:18, fontWeight:900, color:C.text }}>{project.name} — 議事録</h2>
        <span style={{ fontSize:12, color:C.muted }}>{minutes.length}件</span>
      </div>
      {minutes.length===0&&<div style={{ textAlign:"center", padding:"60px 0", color:C.muted, fontSize:14 }}><div style={{ fontSize:40, marginBottom:12 }}>📝</div>議事録がまだ保存されていません</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {minutes.map(m=>(
          <div key={m.id} style={{ background:C.surface, borderRadius:16, border:`1.5px solid ${C.border}`, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 18px", borderBottom:editingId===m.id?`1.5px solid ${C.border}`:"none" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:project.color }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.muted }}>{new Date(m.createdAt).toLocaleDateString("ja-JP")}</span>
                  <span style={{ fontSize:14, fontWeight:800, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.title.replace(/^\d{4}\/\d{1,2}\/\d{1,2}\s*/,"")}</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={()=>editingId===m.id?saveEdit():setEditingId(m.id)||setEditContent(m.content)}
                  style={btn({padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:700,background:editingId===m.id?C.sage:"transparent",color:editingId===m.id?"#fff":C.muted,border:`1.5px solid ${editingId===m.id?C.sage:C.border}`})}>
                  {editingId===m.id?"💾 保存":"✏️ 編集"}
                </button>
                {editingId===m.id&&<button onClick={()=>setEditingId(null)} style={btn({padding:"5px 12px",borderRadius:8,fontSize:12,color:C.muted,border:`1.5px solid ${C.border}`,background:"transparent"})}>キャンセル</button>}
                <button onClick={()=>{setAiEditId(aiEditId===m.id?null:m.id);setAiInstruction("");setAiError("");}}
                  style={btn({padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:700,background:aiEditId===m.id?C.accent:"transparent",color:aiEditId===m.id?"#fff":C.accent,border:`1.5px solid ${C.accent}`})}>
                  ✨ AI修正
                </button>
                <button onClick={()=>deleteMinute(m.id)}
                  style={btn({padding:"5px 12px",borderRadius:8,fontSize:12,color:deletingId===m.id?"#fff":C.accent,background:deletingId===m.id?C.accent:"transparent",border:`1.5px solid ${C.accent}`})}>
                  {deletingId===m.id?"確認":"✕"}
                </button>
              </div>
            </div>
            {aiEditId===m.id&&(
              <div style={{ padding:"14px 18px", background:C.accentLight, borderBottom:`1.5px solid ${C.border}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:8 }}>✨ AI修正指示</div>
                <textarea value={aiInstruction} onChange={e=>setAiInstruction(e.target.value)} rows={3}
                  placeholder="例：決定事項をより明確に書き直してください"
                  style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 11px", fontSize:12, background:"#fff", color:C.text, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
                {aiError&&<div style={{ fontSize:12, color:C.accent, marginTop:6 }}>{aiError}</div>}
                <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"flex-end" }}>
                  <button onClick={()=>{setAiEditId(null);setAiInstruction("");}} style={btn({padding:"6px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:12,fontWeight:700})}>キャンセル</button>
                  <button onClick={()=>runAiEdit(m)} disabled={aiLoading||!aiInstruction.trim()}
                    style={btn({padding:"6px 18px",borderRadius:8,background:aiLoading||!aiInstruction.trim()?C.border:C.accent,color:"#fff",fontSize:12,fontWeight:700})}>
                    {aiLoading?"修正中...":"修正する"}
                  </button>
                </div>
              </div>
            )}
            {editingId===m.id
              ? <textarea value={editContent} onChange={e=>setEditContent(e.target.value)} rows={20}
                  style={{ width:"100%", border:"none", outline:"none", padding:"16px 18px", fontSize:12, lineHeight:1.8, fontFamily:"monospace", background:C.bg, color:C.text, resize:"vertical", boxSizing:"border-box" }} />
              : <pre style={{ margin:0, padding:"16px 18px", fontSize:12, lineHeight:1.8, color:C.text, whiteSpace:"pre-wrap", wordWrap:"break-word", fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif" }}>{m.content}</pre>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState(INIT_PROJECTS);
  const [tab, setTab] = useState("projects");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [minutesProjectId, setMinutesProjectId] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    loadProjects().then(saved => {
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setProjects(saved);
      } else {
        setShowWelcome(true);
      }
      setStorageReady(true);
    });
  }, []);

  useEffect(() => { if (!storageReady) return; saveProjects(projects); }, [projects, storageReady]);

  const updateProject = p => setProjects(ps => ps.map(x => x.id===p.id ? p : x));
  const deleteProject = id => { setProjects(ps => ps.filter(p => p.id!==id)); setTab("projects"); };
  const addProject = () => {
    if (!newName.trim()) return;
    const colors = [C.sage,C.doing,C.done,C.accent,"#9B8EC0"];
    const p = { id:uid(), name:newName, desc:"", color:colors[projects.length%colors.length], minutes:[], members:[], tasks:[] };
    setProjects(ps=>[...ps,p]); setTab(p.id); setNewName(""); setShowAdd(false);
  };
  const addTasks = (pid, tasks) => { setProjects(ps=>ps.map(p=>p.id===pid?{...p,tasks:[...p.tasks,...tasks]}:p)); };
  const active = projects.find(p => p.id===tab);

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
        if(data.projects&&Array.isArray(data.projects)){setProjects(data.projects);setTab("projects");}
        else alert("正しいバックアップファイルではありません");
      } catch { alert("ファイルの読み込みに失敗しました"); }
    };
    r.readAsText(file); e.target.value="";
  };

  const importRef = useRef(null);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif", color:C.text }}>
      <div style={{ background:C.surface, borderBottom:`1.5px solid ${C.border}`, display:"flex", alignItems:"stretch", overflowX:"auto", paddingLeft:20 }}>
        <div style={{ paddingRight:20, display:"flex", alignItems:"center", borderRight:`1px solid ${C.border}`, marginRight:4, flexShrink:0 }}>
  <img src={logo} alt="logo" style={{ height:32, objectFit:"contain" }} />
</div>
        {[["projects","📁 Projects"],["calendar","📅 カレンダー"],["minutes","✨ 議事録"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={btn({padding:"0 16px",height:52,background:"transparent",fontSize:13,fontWeight:700,color:tab===id?C.accent:C.muted,borderBottom:tab===id?`2.5px solid ${C.accent}`:"2.5px solid transparent",flexShrink:0,whiteSpace:"nowrap"})}>{lbl}</button>
        ))}
        <div style={{ width:1, background:C.border, margin:"10px 8px", flexShrink:0 }} />
        {projects.map(p=>(
          <button key={p.id} onClick={()=>setTab(p.id)} style={btn({padding:"0 14px",height:52,background:"transparent",fontSize:13,fontWeight:700,color:tab===p.id?p.color:C.muted,borderBottom:tab===p.id?`2.5px solid ${p.color}`:"2.5px solid transparent",flexShrink:0,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6})}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:p.color }} />{p.name}
          </button>
        ))}
        {showAdd ? (
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"0 12px", flexShrink:0 }}>
            <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProject()} placeholder="プロジェクト名"
              style={{ border:`1.5px solid ${C.border}`, borderRadius:8, padding:"5px 10px", fontSize:13, background:C.bg, color:C.text, outline:"none", width:130 }} />
            <button onClick={addProject} style={btn({background:C.accent,color:"#fff",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700})}>追加</button>
            <button onClick={()=>setShowAdd(false)} style={btn({background:"transparent",color:C.muted,fontSize:16})}>✕</button>
          </div>
        ) : (
          <button onClick={()=>setShowAdd(true)} style={btn({padding:"0 14px",height:52,background:"transparent",fontSize:13,color:C.muted,flexShrink:0})}>+ プロジェクト</button>
        )}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4, padding:"0 12px", flexShrink:0 }}>
          <button onClick={exportData} style={btn({padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontWeight:700,whiteSpace:"nowrap"})}>⬆ エクスポート</button>
          <button onClick={()=>importRef.current?.click()} style={btn({padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontWeight:700,whiteSpace:"nowrap"})}>⬇ インポート</button>
          <input ref={importRef} type="file" accept=".json" onChange={importData} style={{ display:"none" }} />
        </div>
      </div>

      {minutesProjectId ? (
        <MinutesDetailPage project={projects.find(p=>p.id===minutesProjectId)} onBack={()=>setMinutesProjectId(null)} onUpdate={updateProject} />
      ) : (
        <>
          <div style={{ display:tab==="projects"?"block":"none" }}><ProjectsPage projects={projects} onUpdate={updateProject} onDelete={deleteProject} onNavigate={id=>setTab(id)} onViewMinutes={id=>setMinutesProjectId(id)} /></div>
          <div style={{ display:tab==="calendar"?"block":"none" }}><CalendarPage projects={projects} /></div>
          <div style={{ display:tab==="minutes"?"block":"none" }}><MinutesPage projects={projects} onAddTasks={addTasks} onUpdateProject={updateProject} /></div>
          {active&&tab===active.id&&<KanbanPage key={active.id} project={active} onUpdate={updateProject} />}
        </>
      )}

      {showWelcome&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:"48px 40px", maxWidth:480, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.2)", textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>✦</div>
            <div style={{ fontSize:22, fontWeight:900, color:C.text, marginBottom:10 }}>TaskFlowへようこそ</div>
            <div style={{ fontSize:13, color:C.muted, lineHeight:2, marginBottom:28 }}>
              プロジェクト・タスク・議事録を一元管理できるチームツールです。<br />
              データは自動保存され、チーム全員とリアルタイムで共有されます。
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:28 }}>
              {[["📁 Projects","プロジェクト・タスク管理",C.sageLight,C.sage],["✨ 議事録","AI議事録作成・タスク自動抽出",C.accentLight,C.accent],["📅 カレンダー","期日・スケジュール確認","#EEF3FF","#5B7EC9"]].map(([label,desc,bg,color])=>(
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
