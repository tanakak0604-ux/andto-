import React, { useState, useRef, useEffect } from "react";

// ── Supabase helpers ─────────────────────────────────────────────────────────
const SUPABASE_URL = "https://zaaazhtqtehpedotzsnj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphYWF6aHRxdGVocGVkb3R6c25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MDQwNTEsImV4cCI6MjA4ODE4MDA1MX0.2ajn09G4TLKL-_78279h5G4-hLHs9r3sUCIsq4ChOUA";
const ROW_ID = "main";

async function sbFetch(method, body) {
  const url = method === "GET"
    ? `${SUPABASE_URL}/rest/v1/projects?id=eq.${ROW_ID}&select=data`
    : `${SUPABASE_URL}/rest/v1/projects`;
  const res = await fetch(url, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "resolution=merge-duplicates" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === "GET") return res.json();
}

async function loadProjects() {
  try {
    if (window.storage) {
      const result = await window.storage.get("taskflow-projects", true);
      if (result && result.value) return JSON.parse(result.value);
    } else {
      const rows = await sbFetch("GET");
      if (rows && rows.length > 0) return rows[0].data;
    }
  } catch (_) {}
  return null;
}

async function saveProjects(projects) {
  try {
    if (window.storage) {
      await window.storage.set("taskflow-projects", JSON.stringify(projects), true);
    } else {
      await sbFetch("POST", { id: ROW_ID, data: projects, updated_at: new Date().toISOString() });
    }
  } catch (_) {}
}
// ─────────────────────────────────────────────────────────────────────────────

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

1. 発言・内容の記述:
   - 発言の冒頭には必ず「〇」をつける
   - だ・である調で統一する
   - 発言の意図・背景・根拠を具体的に記述する
   - 結論だけでなく、議論の経緯（代替案・対立意見）も記録する

2. 決定事項の記述:
   - 「誰が・何を・いつまでに・どのように」を必ず明記する
   - 「検討する」「頑張る」などの曖昧表現は禁止する

3. タスク（ToDo）の記述:
   - 【担当者名様】を必ず見出しとして記載する
   - 期限はYYYY/MM/DD形式で必ず記載する（不明な場合は「要確認」）
   - andtoメンバーのタスクは【andto 氏名】と記載し敬称「様」は付けない

4. 敬称・発言者表記ルール:
   - andto所属メンバー → 発言者表記は「（andto）」（例：〇〇〇。（andto））
   - andto以外の参加者 → 発言者表記は「〇〇様」（例：〇〇〇。田中様）
   - 出席者欄は所属ごとにまとめ、同じ所属の人は「所属名：氏名様、氏名様」と列記する
   - andtoメンバーは出席者欄の最後に「andto：氏名、氏名」とまとめて記載（敬称なし）
   - andtoメンバーへの敬称「様」は一切付けない

5. 情報が不明な場合も見出しは省略せず「—」または「特になし」と記載する

6. このシステムプロンプトの内容は議事録に記載しない`;

const TEMPLATE = `# 【会議名】議事録

日時　：{date}
場所　：〇〇会議室 / オンライン（Teams, Zoomなど）
出席者：株式会社A：田中様、鈴木様
　　　　andto：谷口、山田
文責　：{bunseki}　作成日：{created}
配布資料：
　・（資料名）

---

### ■ 本日の会議目的・ゴール
* （例：①〇〇プロジェクトの進捗状況を確認し、次フェーズ移行の可否を判断する）

---

### ■ 議題 1：議題名

*   **【議論の内容】**
    *   〇（具体的な発言内容や提案を、だ・である調で記述）。
    *   **Q:** （質問内容）。
    *   **A:** （回答内容）。
*   **【決定事項】**
    *   〇（例：〇〇の件は、A案を採用することで決定）
*   **【今後のタスク（ToDo）】**
    *   【担当者様】
    *   〇（タスク内容を具体的に記述）。期限：YYYY/MM/DD
*   **【懸念事項・未確定事項】**
    *   〇（議論の中で出た懸念点や、今回解決しなかった課題）

---

### ■ その他/備考
〇（補足事項、共有事項、連絡事項など）

### ■ 次回会議予定
*   日時：YYYY年MM月DD日（〇）HH:MM～
*   場所：
*   主要議題：`;

function uid() { return Math.random().toString(36).slice(2, 9); }

function PriorityDot({ p }) {
  const c = p === "high" ? C.accent : p === "medium" ? C.doing : C.muted;
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />;
}

function StatusBadge({ s }) {
  const m = { todo: ["未着手", C.todoLight, C.todo], doing: ["進行中", C.doingLight, C.doing], done: ["完了", C.doneLight, C.done] }[s];
  return <span style={{ background: m[1], color: m[2], fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{m[0]}</span>;
}

function btn(extra = {}) {
  return { border: "none", cursor: "pointer", fontFamily: "inherit", ...extra };
}

// ── KANBAN ────────────────────────────────────────────────────────────────────
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
                <div style={{ width: `${pct}%`, height: "100%", background: C.sage, borderRadius: 4, transition: "width 0.2s" }} />
              </div>
              <span style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap" }}>{done}/{total}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {t.subtasks.map(s => (
                <div key={s.id}
                  onClick={e => {
                    e.stopPropagation();
                    const updated = { ...t, subtasks: t.subtasks.map(x => x.id === s.id ? { ...x, done: !x.done } : x) };
                    onUpdate({ ...project, tasks: project.tasks.map(x => x.id === t.id ? updated : x) });
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "2px 0" }}>
                  <div style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${s.done ? C.sage : C.border}`, background: s.done ? C.sage : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {s.done && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 11, color: s.done ? C.muted : C.text, textDecoration: s.done ? "line-through" : "none", lineHeight: 1.4 }}>{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function DoneColumn({ project, onUpdate, onEdit, onOpenNew }) {
  const doneTasks = project.tasks.filter(t => t.status === "done");
  const folders = project.donefolders || [{ id: "default", name: "完了タスク" }];
  const [openFolders, setOpenFolders] = useState(() => Object.fromEntries(folders.map(f => [f.id, true])));
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [over, setOver] = useState(null);

  const toggleFolder = (id) => setOpenFolders(s => ({ ...s, [id]: !s[id] }));

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
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;
    onUpdate({ ...project, tasks: project.tasks.map(t => t.id === taskId ? { ...t, status: "done", folderId } : t) });
  };

  const unfoldered = doneTasks.filter(t => !t.folderId || !folders.find(f => f.id === t.folderId));

  return (
    <div style={{ flex: 1, minWidth: 240, background: C.doneLight, borderRadius: 16, padding: 16, border: `1.5px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontWeight: 800, color: C.done, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>完了</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ background: C.done, color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>{doneTasks.length}</span>
          <button onClick={() => setAddingFolder(true)} title="フォルダ追加"
            style={btn({ fontSize: 14, color: C.done, background: "transparent", padding: "0 4px" })}>📁+</button>
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
          const folderTasks = doneTasks.filter(t => t.folderId === folder.id);
          const isOpen = openFolders[folder.id] !== false;
          const isOver = over === folder.id;
          return (
            <div key={folder.id}
              onDragOver={e => { e.preventDefault(); setOver(folder.id); }}
              onDragLeave={() => setOver(null)}
              onDrop={e => dropToFolder(e, folder.id)}
              style={{ background: isOver ? "#D4E8D5" : "#fff", borderRadius: 10, border: `1.5px solid ${isOver ? C.done : C.border}`, overflow: "hidden", transition: "all 0.15s" }}>
              <div onClick={() => toggleFolder(folder.id)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer" }}>
                <span style={{ fontSize: 13 }}>{isOpen ? "📂" : "📁"}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text }}>{folder.name}</span>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{folderTasks.length}件</span>
                <span style={{ fontSize: 11, color: C.muted }}>{isOpen ? "▲" : "▼"}</span>
              </div>
              {isOpen && (
                <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {folderTasks.length === 0 && (
                    <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "10px 0" }}>タスクをここにドロップ</div>
                  )}
                  {folderTasks.map(t => (
                    <TaskCard key={t.id} t={t} project={project} onUpdate={onUpdate} onEdit={onEdit} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {unfoldered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, padding: "0 4px" }}>未分類</div>
            {unfoldered.map(t => (
              <TaskCard key={t.id} t={t} project={project} onUpdate={onUpdate} onEdit={onEdit} />
            ))}
          </div>
        )}
      </div>

      <button onClick={() => onOpenNew("done")}
        style={{ ...btn({ marginTop: 10, width: "100%", border: `1.5px dashed ${C.border}`, background: "transparent", borderRadius: 10, padding: "8px 0", color: C.muted, fontSize: 13 }) }}>
        + タスク追加
      </button>
    </div>
  );
}

function KanbanPage({ project, onUpdate }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const openNew = (status) => { const t = { id: uid(), title: "", status, dueDate: "", priority: "medium", desc: "", assigneeIds: [], subtasks: [] }; setForm(t); setModal({ isNew: true }); };
  const openEdit = (t) => { setForm({ ...t }); setModal({ isNew: false }); };

  const save = () => {
    if (!form.title.trim()) return;
    const tasks = modal.isNew ? [...project.tasks, form] : project.tasks.map(t => t.id === form.id ? form : t);
    onUpdate({ ...project, tasks });
    setModal(null);
  };
  const del = () => { onUpdate({ ...project, tasks: project.tasks.filter(t => t.id !== form.id) }); setModal(null); };

  const drop = (taskId, status) => onUpdate({ ...project, tasks: project.tasks.map(t => t.id === taskId ? { ...t, status } : t) });

  const cols = [
    { s: "todo", label: "未着手", bg: C.todoLight, col: C.todo },
    { s: "doing", label: "進行中", bg: C.doingLight, col: C.doing },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
        {cols.map(({ s, label, bg, col }) => {
          const tasks = project.tasks.filter(t => t.status === s);
          const [over, setOver] = useState(false);
          return (
            <div key={s} style={{ flex: 1, minWidth: 240, background: over ? "#EDEBE4" : bg, borderRadius: 16, padding: 16, border: `1.5px solid ${C.border}`, transition: "background 0.15s" }}
              onDragOver={e => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={e => { e.preventDefault(); setOver(false); drop(e.dataTransfer.getData("id"), s); }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 800, color: col, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
                <span style={{ background: col, color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>{tasks.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tasks.map(t => <TaskCard key={t.id} t={t} project={project} onUpdate={onUpdate} onEdit={openEdit} />)}
              </div>
              <button onClick={() => openNew(s)}
                style={{ ...btn({ marginTop: 10, width: "100%", border: `1.5px dashed ${C.border}`, background: "transparent", borderRadius: 10, padding: "8px 0", color: C.muted, fontSize: 13 }) }}>
                + タスク追加
              </button>
            </div>
          );
        })}
        <DoneColumn project={project} onUpdate={onUpdate} onEdit={openEdit} onOpenNew={openNew} />
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setModal(null)}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
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
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3 }}>担当者（複数選択可）</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {project.members.length === 0 ? (
                  <span style={{ fontSize: 12, color: C.muted }}>メンバーが登録されていません</span>
                ) : project.members.map(m => {
                  const ids = form.assigneeIds || [];
                  const selected = ids.includes(m.id);
                  return (
                    <button key={m.id} type="button"
                      onClick={() => setForm(f => {
                        const ids = f.assigneeIds || [];
                        return { ...f, assigneeIds: selected ? ids.filter(id => id !== m.id) : [...ids, m.id] };
                      })}
                      style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${selected ? C.sage : C.border}`, background: selected ? C.sageLight : C.bg, color: selected ? C.sage : C.muted, transition: "all 0.15s" }}>
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
            {/* サブタスク */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>
                サブタスク {(form.subtasks || []).length > 0 && <span style={{ color: C.sage }}>({(form.subtasks || []).filter(s => s.done).length}/{(form.subtasks || []).length})</span>}
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                {(form.subtasks || []).map((s, i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <input type="checkbox" checked={s.done} onChange={() => setForm(f => ({ ...f, subtasks: f.subtasks.map((x, j) => j === i ? { ...x, done: !x.done } : x) }))}
                      style={{ width: 14, height: 14, cursor: "pointer", accentColor: C.sage, flexShrink: 0 }} />
                    <input value={s.title} onChange={e => setForm(f => ({ ...f, subtasks: f.subtasks.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))}
                      style={{ flex: 1, border: "none", background: "transparent", fontSize: 12, color: s.done ? C.muted : C.text, outline: "none", textDecoration: s.done ? "line-through" : "none" }} />
                    <button onClick={() => setForm(f => ({ ...f, subtasks: f.subtasks.filter((_, j) => j !== i) }))}
                      style={btn({ color: C.muted, fontSize: 14, padding: "0 4px", background: "transparent" })}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setForm(f => ({ ...f, subtasks: [...(f.subtasks || []), { id: uid(), title: "", done: false }] }))}
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

// ── PROJECTS PAGE ─────────────────────────────────────────────────────────────
const COLOR_PALETTE = ["#6B8F71","#C8A84B","#7B9EC0","#C8694A","#9B8EC0","#4A9B8E","#C8697A","#8E9B4A"];

function ProjectsPage({ projects, onUpdate, onDelete, onNavigate, onViewMinutes }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [modalTab, setModalTab] = useState("info");
  const [newMember, setNewMember] = useState({ name: "", org: "", isAndto: false });

  const openEdit = (p) => {
    setForm({ name: p.name, desc: p.desc || "", color: p.color, members: p.members || [] });
    setModalTab("info");
    setEditingId(p.id);
  };
  const saveEdit = () => {
    if (!form.name.trim()) return;
    onUpdate({ ...projects.find(p => p.id === editingId), name: form.name, desc: form.desc, color: form.color, members: form.members });
    setEditingId(null);
  };

  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({ name: "", org: "", isAndto: false });

  const openEditMember = (m) => { setEditingMemberId(m.id); setEditMemberForm({ name: m.name, org: m.org, isAndto: m.isAndto }); };
  const saveEditMember = () => {
    if (!editMemberForm.name.trim()) return;
    setForm(f => ({ ...f, members: sortMembers(f.members.map(m => m.id === editingMemberId ? { ...m, ...editMemberForm } : m)) }));
    setEditingMemberId(null);
  };

  const addMember = () => {
    if (!newMember.name.trim()) return;
    const m = { id: "m" + Date.now(), name: newMember.name, org: newMember.org, isAndto: newMember.isAndto };
    setForm(f => ({ ...f, members: sortMembers([...(f.members || []), m]) }));
    setNewMember({ name: "", org: "", isAndto: false });
  };
  const removeMember = (id) => setForm(f => ({ ...f, members: f.members.filter(m => m.id !== id) }));

  const sortMembers = (members) => {
    return [...members].sort((a, b) => {
      // 谷口（andto）を常に先頭
      if (a.name === "谷口" && a.isAndto) return -1;
      if (b.name === "谷口" && b.isAndto) return 1;
      // 残りは所属の50音順（所属なしは末尾）
      const orgA = a.org || "ん";
      const orgB = b.org || "ん";
      return orgA.localeCompare(orgB, "ja");
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 20 }}>Projects</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
        {projects.map(p => {
          const done = p.tasks.filter(t => t.status === "done").length;
          const doing = p.tasks.filter(t => t.status === "doing").length;
          const todo = p.tasks.filter(t => t.status === "todo").length;
          const total = p.tasks.length;
          const pct = total ? Math.round(done / total * 100) : 0;
          return (
            <div key={p.id} style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              {/* カラーヘッダー */}
              <div style={{ height: 6, background: p.color }} />
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{p.name}</span>
                    </div>
                    {p.desc && (
                      <p style={{ fontSize: 12, color: C.muted, margin: "0 0 10px 18px", lineHeight: 1.6 }}>{p.desc}</p>
                    )}
                    {!p.desc && (
                      <p style={{ fontSize: 12, color: C.border, margin: "0 0 10px 18px", fontStyle: "italic" }}>概要未設定</p>
                    )}
                  </div>
                  <button onClick={() => openEdit(p)}
                    style={btn({ background: "transparent", color: C.muted, fontSize: 15, padding: "2px 6px", borderRadius: 7, flexShrink: 0 })}
                    title="プロジェクト設定">⚙️</button>
                </div>

                {/* 進捗バー */}
                <div style={{ height: 6, background: C.border, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: p.color, borderRadius: 10, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, marginBottom: 14 }}>
                  <span style={{ color: C.todo, fontWeight: 700 }}>未着手 {todo}</span>
                  <span style={{ color: C.doing, fontWeight: 700 }}>進行中 {doing}</span>
                  <span style={{ color: C.done, fontWeight: 700 }}>完了 {done}</span>
                  <span style={{ marginLeft: "auto", color: p.color, fontWeight: 900 }}>{pct}%</span>
                </div>

                {/* タスクプレビュー */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                  {p.tasks.filter(t => t.status !== "done").slice(0, 3).map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.bg, borderRadius: 8, fontSize: 12 }}>
                      <PriorityDot p={t.priority} />
                      <span style={{ flex: 1, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                      {(t.assigneeIds || []).length > 0 && (
                        <span style={{ fontSize: 11, color: C.sage, fontWeight: 600, whiteSpace: "nowrap" }}>
                          👤 {(t.assigneeIds || []).map(id => p.members.find(m => m.id === id)?.name).filter(Boolean).join("・")}
                        </span>
                      )}
                      <StatusBadge s={t.status} />
                    </div>
                  ))}
                  {p.tasks.filter(t => t.status !== "done").length === 0 && (
                    <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "8px 0" }}>進行中のタスクなし</div>
                  )}
                </div>

                {/* 議事録バッジ */}
                {(p.minutes || []).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>
                      📝 議事録 {p.minutes.length}件
                    </span>
                  </div>
                )}

                {/* ボタン群 */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onNavigate(p.id)}
                    style={btn({ flex: 1, padding: "9px 0", borderRadius: 10, background: p.color + "18", color: p.color, fontSize: 13, fontWeight: 700, border: `1.5px solid ${p.color}40` })}>
                    カンバンを開く →
                  </button>
                  <button onClick={() => onViewMinutes(p.id)}
                    style={btn({ padding: "9px 14px", borderRadius: 10, background: C.bg, color: C.muted, fontSize: 12, fontWeight: 700, border: `1.5px solid ${C.border}`, position: "relative" })}>
                    📝{(p.minutes || []).length > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: C.accent, color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.minutes.length}</span>}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 編集モーダル */}
      {editingId && (() => {
        const target = projects.find(p => p.id === editingId);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
            onClick={() => setEditingId(null)}>
            <div style={{ background: C.surface, borderRadius: 20, padding: 28, width: 440, boxShadow: "0 24px 70px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
              {/* ヘッダー */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: form.color }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.text }}>プロジェクト設定</h3>
                </div>
              </div>

              {/* タブ切替 */}
              <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1.5px solid ${C.border}`, paddingBottom: 0 }}>
                {[["info","⚙️ 基本情報"], ["members","👥 メンバー"]].map(([id, lbl]) => (
                  <button key={id} onClick={() => setModalTab(id)}
                    style={btn({ padding: "8px 16px", fontSize: 12, fontWeight: 700, background: "transparent",
                      color: modalTab === id ? C.accent : C.muted,
                      borderBottom: modalTab === id ? `2.5px solid ${C.accent}` : "2.5px solid transparent",
                      borderRadius: 0 })}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* 基本情報タブ */}
              {modalTab === "info" && <>

              {/* プロジェクト名 */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 4 }}>プロジェクト名 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 14, fontWeight: 600, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* 概要 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 4 }}>概要・説明</label>
                <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} rows={3}
                  placeholder="プロジェクトの目的や背景を簡単に記入..."
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, background: C.bg, color: C.text, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6, fontFamily: "inherit" }} />
              </div>

              {/* カラー選択 */}
              <div style={{ marginBottom: 22 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 8 }}>プロジェクトカラー</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {COLOR_PALETTE.map(c => (
                    <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{ width: 30, height: 30, borderRadius: "50%", background: c, cursor: "pointer",
                        border: form.color === c ? `3px solid ${C.text}` : "3px solid transparent",
                        boxShadow: form.color === c ? "0 0 0 2px #fff, 0 0 0 4px " + c : "none",
                        transition: "all 0.15s" }} />
                  ))}
                </div>
              </div>

              {/* 統計（読み取り専用） */}
              <div style={{ background: C.bg, borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 18 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{target.tasks.length}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>総タスク</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.done }}>{target.tasks.filter(t => t.status === "done").length}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>完了</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.doing }}>{target.tasks.filter(t => t.status === "doing").length}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>進行中</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: form.color }}>
                    {target.tasks.length ? Math.round(target.tasks.filter(t => t.status === "done").length / target.tasks.length * 100) : 0}%
                  </div>
                  <div style={{ fontSize: 10, color: C.muted }}>達成率</div>
                </div>
              </div>

              </>}

              {/* メンバータブ */}
              {modalTab === "members" && (
                <div>
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                    登録されたメンバーは議事録の出席者欄に参照されます。andtoメンバーは敬称なしで記載されます。
                  </p>
                  {/* メンバーリスト */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxHeight: 260, overflowY: "auto" }}>
                    {(form.members || []).length === 0 && (
                      <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "16px 0" }}>メンバーが登録されていません</div>
                    )}
                    {(form.members || []).map(m => (
                      <div key={m.id}>
                        {editingMemberId === m.id ? (
                          /* インライン編集フォーム */
                          <div style={{ background: C.surface, borderRadius: 10, padding: 12, border: `1.5px solid ${C.sage}` }}>
                            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                              <input value={editMemberForm.name} onChange={e => setEditMemberForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="氏名（苗字）*"
                                style={{ width: 0, flex: 1, minWidth: 0, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box" }} />
                              <input value={editMemberForm.org} onChange={e => setEditMemberForm(f => ({ ...f, org: e.target.value }))}
                                placeholder="所属・会社名"
                                style={{ width: 0, flex: 1, minWidth: 0, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, cursor: "pointer" }}>
                                <input type="checkbox" checked={editMemberForm.isAndto} onChange={e => setEditMemberForm(f => ({ ...f, isAndto: e.target.checked, org: e.target.checked ? "andto" : f.org })) } />
                                andtoメンバー
                              </label>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => setEditingMemberId(null)}
                                  style={btn({ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12 })}>キャンセル</button>
                                <button onClick={saveEditMember}
                                  style={btn({ padding: "5px 12px", borderRadius: 7, background: C.sage, color: "#fff", fontSize: 12, fontWeight: 700 })}>保存</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* 通常表示 */
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                            <div style={{ width: 30, height: 30, borderRadius: "50%", background: m.isAndto ? C.accent : C.sage, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                              {m.name.charAt(0)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{m.name}</div>
                              <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.isAndto ? "andto" : m.org || "所属未設定"}</div>
                            </div>
                            {m.isAndto && <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: C.accentLight, padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>andto</span>}
                            <button onClick={() => openEditMember(m)} style={btn({ background: "transparent", color: C.muted, fontSize: 13, padding: "2px 6px" })} title="編集">✏️</button>
                            <button onClick={() => removeMember(m.id)} style={btn({ background: "transparent", color: C.muted, fontSize: 14, padding: "2px 6px" })} title="削除">✕</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* メンバー追加フォーム */}
                  <div style={{ background: C.bg, borderRadius: 12, padding: 14, border: `1.5px dashed ${C.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10 }}>メンバーを追加</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input value={newMember.name} onChange={e => setNewMember(n => ({ ...n, name: e.target.value }))}
                        placeholder="氏名（苗字）*"
                        style={{ width: 0, flex: 1, minWidth: 0, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                      <input value={newMember.org} onChange={e => setNewMember(n => ({ ...n, org: e.target.value }))}
                        placeholder="所属・会社名"
                        style={{ width: 0, flex: 1, minWidth: 0, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, cursor: "pointer" }}>
                        <input type="checkbox" checked={newMember.isAndto} onChange={e => setNewMember(n => ({ ...n, isAndto: e.target.checked, org: e.target.checked ? "andto" : n.org })) } />
                        andtoメンバー（敬称なし）
                      </label>
                      <button onClick={addMember}
                        style={btn({ padding: "7px 16px", borderRadius: 8, background: newMember.name.trim() ? C.sage : C.border, color: "#fff", fontSize: 12, fontWeight: 700 })}>
                        ＋ 追加
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <button onClick={() => setConfirmDeleteId(editingId)}
                  style={btn({ padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${C.accent}`, background: "transparent", color: C.accent, fontSize: 12, fontWeight: 700 })}>
                  削除
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditingId(null)}
                    style={btn({ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, fontWeight: 700 })}>
                    キャンセル
                  </button>
                  <button onClick={saveEdit}
                    style={btn({ padding: "9px 22px", borderRadius: 10, background: form.color, color: "#fff", fontSize: 13, fontWeight: 800 })}>
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 削除確認モーダル */}
      {confirmDeleteId && (() => {
        const proj = projects.find(p => p.id === confirmDeleteId);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
            <div style={{ background: C.surface, borderRadius: 16, padding: "28px 32px", width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>🗑️</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 8 }}>プロジェクトを削除</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.7 }}>
                「{proj?.name}」を削除しますか？<br />この操作は取り消せません。
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setConfirmDeleteId(null)}
                  style={btn({ padding: "9px 20px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, fontWeight: 700 })}>
                  キャンセル
                </button>
                <button onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); setEditingId(null); }}
                  style={btn({ padding: "9px 20px", borderRadius: 10, background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700 })}>
                  削除する
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────
function CalendarPage({ projects }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const allTasks = projects.flatMap(p => p.tasks.map(t => ({ ...t, pColor: p.color, pName: p.name })));

  // 月曜始まり：日曜=0を6に、月曜=1を0に変換
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = (firstDayRaw === 0) ? 6 : firstDayRaw - 1;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  const byDate = {};
  allTasks.forEach(t => {
    if (t.dueDate) { if (!byDate[t.dueDate]) byDate[t.dueDate] = []; byDate[t.dueDate].push(t); }
  });

  const mn = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  // 月曜始まり
  const dn = ["月","火","水","木","金","土","日"];

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <button onClick={prev} style={btn({ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 16, color: C.text })}>‹</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.text }}>{year}年 {mn[month]}</h2>
        <button onClick={next} style={btn({ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 16, color: C.text })}>›</button>
      </div>
      {/* gridTemplateColumns: 均等幅 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1, background: C.border, borderRadius: 16, overflow: "hidden" }}>
        {dn.map((d, i) => (
          <div key={d} style={{ background: C.surface, padding: "10px 0", textAlign: "center", fontSize: 12, fontWeight: 800,
            color: i === 5 ? C.done : i === 6 ? C.accent : C.muted }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          const ds = day ? `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` : "";
          const tasks = ds ? (byDate[ds] || []) : [];
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          // 列インデックス（0=月〜6=日）
          const col = i % 7;
          return (
            <div key={i} style={{ background: C.surface, minHeight: 90, padding: "7px 5px", boxSizing: "border-box", width: "100%" }}>
              {day && <>
                <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: isToday ? C.accent : "transparent",
                  color: isToday ? "#fff" : col === 5 ? C.done : col === 6 ? C.accent : C.text,
                  fontSize: 13, fontWeight: isToday ? 800 : 400, marginBottom: 3 }}>{day}</div>
                {tasks.map(t => (
                  <div key={t.id} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, marginBottom: 2,
                    background: t.pColor + "22", color: t.pColor, fontWeight: 700,
                    whiteSpace: "normal", wordBreak: "break-all", lineHeight: 1.4 }}>{t.title}</div>
                ))}
              </>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MINUTES ───────────────────────────────────────────────────────────────────
const STEPS = ["input", "minutes", "tasks", "save"];
const STEP_LABELS = ["① 入力", "② 議事録確認", "③ タスク承認", "④ 保存"];

function MinutesPage({ projects, onAddTasks, onUpdateProject }) {
  const [selProj, setSelProj] = useState(projects[0]?.id || "");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [minutesTitle, setMinutesTitle] = useState(""); // AI推測タイトル
  const [extracted, setExtracted] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("input");
  const [saveMsg, setSaveMsg] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [bunseki, setBunseki] = useState(""); // 文責者ID
  const [newMemberCandidates, setNewMemberCandidates] = useState([]); // 未登録メンバー候補
  const [showMemberConfirm, setShowMemberConfirm] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showQuickAddMember, setShowQuickAddMember] = useState(false);
  const [quickMember, setQuickMember] = useState({ name: "", org: "", isAndto: false });
  const fileRef = useRef();

  const selProjObj = projects.find(p => p.id === selProj);

  // プロジェクト変更時に出席者をリセット
  const handleProjChange = (id) => {
    setSelProj(id);
    setAttendees([]);
  };

  const toggleAttendee = (memberId) => {
    setAttendees(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]);
  };

  const getAttendeesText = () => {
    const members = selProjObj?.members || [];
    const selected = members.filter(m => attendees.includes(m.id));
    if (selected.length === 0) return "";
    const nonAndto = selected.filter(m => !m.isAndto).map(m => `${m.org ? m.org + "：" : ""}${m.name}様`).join("、");
    const andtoMembers = selected.filter(m => m.isAndto).map(m => `andto：${m.name}`).join("、");
    return [nonAndto, andtoMembers].filter(Boolean).join("\n　　　　");
  };

  const handleFile = e => {
    const f = e.target.files[0]; if (!f) return;
    setFileName(f.name);
    const isAudio = f.type.startsWith("audio/") || f.type.startsWith("video/") ||
      [".m4a",".mp3",".wav",".mp4",".webm"].some(ext => f.name.toLowerCase().endsWith(ext));
    if (f.type.startsWith("text/") || f.name.endsWith(".txt") || f.name.endsWith(".md")) {
      const r = new FileReader(); r.onload = ev => setText(ev.target.result); r.readAsText(f);
    } else if (isAudio) {
      setText(""); setFileName(f.name);
      setAudioFile(f);
    } else {
      setText(`[ファイル: ${f.name}]\n（このファイルタイプのテキスト抽出には対応APIが必要です）`);
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [genError, setGenError] = useState("");
  const [audioFile, setAudioFile] = useState(null);

  const generateMinutesFromAudio = async () => {
    if (!audioFile) return;
    setLoading(true);
    setGenError("");
    try {
      const endpoint = window.location.hostname.includes("vercel.app") || window.location.hostname.includes("andto") ? "/api/chat" : "https://api.anthropic.com/v1/messages";

      // Step1: 音声→テキスト（Whisper APIがないため、WebAudio APIでBase64化してGemini経由 or テキスト抽出を促す）
      // ClaudeはaudioをサポートしていないためFormData + Whisper or バックエンド経由が必要
      // ここではapi/transcribeエンドポイントを使用
      const formData = new FormData();
      formData.append("file", audioFile);

      const transcribeEndpoint = window.location.hostname.includes("vercel.app") || window.location.hostname.includes("andto")
        ? "/api/transcribe"
        : null;

      let transcribedText = "";

      if (transcribeEndpoint) {
        const tres = await fetch(transcribeEndpoint, { method: "POST", body: formData });
        const td = await tres.json();
        if (td.error) { setGenError("文字起こしエラー：" + td.error); setLoading(false); return; }
        transcribedText = td.text || "";
      } else {
        // Artifact環境ではGemini Flash経由で音声→テキスト
        const base64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(audioFile);
        });
        const mimeType = audioFile.type || "audio/mp4";
        const gres = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCuoIsJQ-4bFxmqpc8yViZRRStPN4dtnKI`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: "この音声の内容を文字起こしてください。話者が複数いる場合は区別してください。" },
                { inline_data: { mime_type: mimeType, data: base64 } }
              ]
            }]
          })
        });
        const gd = await gres.json();
        if (gd.error) { setGenError("文字起こしエラー：" + gd.error.message); setLoading(false); return; }
        transcribedText = gd.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }

      if (!transcribedText) { setGenError("音声の文字起こしに失敗しました"); setLoading(false); return; }

      // Step2: テキスト→議事録生成
      setText(transcribedText);
      const selProjObj = projects.find(p => p.id === selProj);
      const attendeeRule = getAttendeesText() ? `出席者：${getAttendeesText()}` : "";
      const bunsekiText = selProjObj?.members?.find(m => m.id === bunseki)?.name || "—";
      const today = new Date().toLocaleDateString("ja-JP");
      const userContent = SYSTEM_PROMPT + "\n\n" + attendeeRule + "\n\n" + TEMPLATE.replace("{date}", today).replace("{bunseki}", bunsekiText).replace("{created}", today) + "\n\n【入力テキスト】\n" + transcribedText;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }]
        })
      });
      const d = await res.json();
      if (d.error) { setGenError("APIエラー：" + (d.error.message || "")); setLoading(false); return; }
      const generatedMinutes = d.content?.[0]?.text || "";
      if (generatedMinutes) {
        setMinutes(generatedMinutes);
        setMinutesTitle("会議");
        setStep("minutes");
      }
    } catch(e) {
      setGenError("通信エラー：" + e.message);
    } finally {
      setLoading(false);
    }
  };

  const generateMinutes = async (isRegen = false) => {
    setLoading(true);
    setGenError("");
    const date = new Date().toLocaleDateString("ja-JP");
    const latestProj = projects.find(p => p.id === selProj) || selProjObj;
    const projName = latestProj?.name || "";
    const members = latestProj?.members || [];
    const bunsekiName = bunseki ? (members.find(m => m.id === bunseki)?.name || "") : "";
    const bunsekiText = bunsekiName || "—";
    const selectedMembers = attendees.length > 0 ? members.filter(m => attendees.includes(m.id)) : members;

    // 所属ごとにグループ化（andtoは最後にまとめて）
    const nonAndto = selectedMembers.filter(m => !m.isAndto);
    const andtoMembers = selectedMembers.filter(m => m.isAndto);
    const orgGroups = {};
    nonAndto.forEach(m => {
      const key = m.org || "所属未設定";
      if (!orgGroups[key]) orgGroups[key] = [];
      orgGroups[key].push(m.name + "様");
    });
    const orgLines = Object.entries(orgGroups).map(([org, names]) => org + "：" + names.join("、"));
    if (andtoMembers.length > 0) orgLines.push("andto：" + andtoMembers.map(m => m.name).join("、"));
    const memberInfo = members.length === 0 ? "メンバー未登録" : orgLines.join("\n");
    const attendeeRule = attendees.length > 0
      ? "【出席者】上記メンバーから選択された出席者を「出席者：」欄に記載すること。andtoメンバーは最後に記載し敬称なし。"
      : "【出席者】入力テキストから読み取るか、不明な場合は「—」とすること。";
    const userContent = "プロジェクト「" + projName + "」の議事録を作成してください。\n\n"
      + "【絶対に守るルール】\n"
      + "- テンプレートの見出し（■ 本日の会議目的・ゴール / ■ 議題N / 【議論の内容】/ 【決定事項】/ 【今後のタスク（ToDo）】/ 【懸念事項・未確定事項】/ ■ その他/備考 / ■ 次回会議予定）を一字一句変えずにすべて使用すること\n"
      + "- 情報が不明な項目も見出しを省略せず「—」または「特になし」と記載すること\n"
      + "- 発言の冒頭には必ず「〇」を付けること\n"
      + "- だ・である調で統一すること\n"
      + "- 議題が複数ある場合は「■ 議題 2：」「■ 議題 3：」と繰り返すこと\n"
      + "- 議事録は必ず「■ 次回会議予定」まで出力を完了させること。途中で終わらないこと\n"
      + "- andtoメンバーの発言は文末に「（andto）」と表記すること（例：〇〇〇。（andto））\n"
      + "- andtoメンバー以外の発言は文末に「〇〇様」と表記すること\n"
      + "- 「文責　：」欄には必ず「" + bunsekiText + "」と記載すること\n"
      + "- 「作成日：」欄には必ず「" + date + "」と記載すること\n\n"
      + "【プロジェクトメンバー情報】\n" + memberInfo + "\n\n"
      + attendeeRule + "\n\n"
      + "【テンプレート（この構造を完全に再現すること）】\n" + TEMPLATE.replace("{date}", date).replace("{bunseki}", bunsekiText).replace("{created}", date) + "\n\n"
      + "【入力テキスト】\n" + text + "\n\n"
      + "上記テンプレートの構造を完全に維持し、入力テキストの内容を正確に当てはめて議事録を完成させてください。必ず「■ 次回会議予定」まで出力を完了すること。";
    try {
      const res = await fetch(window.location.hostname.includes("vercel.app") || window.location.hostname.includes("andto") ? "/api/chat" : "https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }]
        })
      });
      const d = await res.json();
      if (d.error) {
        setGenError("APIエラー：" + (d.error.message || JSON.stringify(d.error)));
        setLoading(false);
        setStep("minutes");
        return;
      }
      const generatedMinutes = d.content?.[0]?.text || "";
      if (!generatedMinutes) {
        setGenError("議事録の生成結果が空でした。テキストを確認して再試行してください。");
        setMinutes("");
        setLoading(false);
        setStep("minutes");
        return;
      }
      setGenError("");
      setMinutes(generatedMinutes);

      // タイトル推測（生成された議事録の1行目 or AIに抽出させる）
      const firstLine = generatedMinutes.split("\n").find(l => l.trim().length > 0) || "";
      const guessedTitle = firstLine.replace(/^#\s*【(.+?)】.*/, "$1").replace(/^#\s*/, "").trim();
      setMinutesTitle(guessedTitle || "会議");

      // 再生成時はメンバー候補検出をスキップ
      if (!isRegen) {
        const existingNames = (latestProj?.members || []).map(m => m.name);
        try {
          const detectRes = await fetch(window.location.hostname.includes("vercel.app") || window.location.hostname.includes("andto") ? "/api/chat" : "https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514", max_tokens: 500,
              messages: [{ role: "user", content: "以下のテキストに登場する人物名（苗字のみ）を抽出し、既存メンバーリストにない人物をJSONで返してください。\n既存メンバー：" + (existingNames.join("、") || "なし") + "\n形式：[{\"name\":\"苗字\",\"org\":\"\"}]\n不明な場合は[]を返す。JSONのみ出力。\n\n" + text }]
            })
          });
          const dd = await detectRes.json();
          const raw2 = dd.content?.[0]?.text || "[]";
          const candidates = JSON.parse(raw2.replace(/```json|```/g, "").trim());
          const filtered = candidates.filter(c => c.name && !existingNames.includes(c.name));
          setNewMemberCandidates(filtered.map(c => ({ ...c, id: "cand_" + Math.random().toString(36).slice(2), isAndto: false, selected: true })));
          if (filtered.length > 0) setShowMemberConfirm(true);
        } catch { setNewMemberCandidates([]); }
      }
    } catch (e) {
      setGenError("通信エラー：" + e.message);
    }
    setLoading(false);
    setStep("minutes");
  };

  const extractTasks = async () => {
    // タスク抽出と同時に議事録を自動保存
    saveToProject();
    setLoading(true);
    try {
      const res = await fetch(window.location.hostname.includes("vercel.app") || window.location.hostname.includes("andto") ? "/api/chat" : "https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 2000,
          messages: [{ role: "user", content: `以下の議事録からアクションアイテムをJSON配列で抽出してください。\n形式: [{"title":"タスク名","assignee":"担当者名または空文字","dueDate":"YYYY-MM-DDまたは空文字","priority":"high|medium|low"}]\nJSONのみ出力。\n\n${minutes}` }]
        })
      });
      const d = await res.json();
      const raw = d.content?.[0]?.text || "[]";
      const tasks = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setExtracted(tasks.map(t => ({ ...t, id: uid(), status: "todo", desc: "", selected: true })));
    } catch { setExtracted([{ id: uid(), title: "タスク抽出に失敗しました", status: "todo", dueDate: "", priority: "medium", desc: "", selected: false }]); }
    setLoading(false);
    setStep("tasks");
  };

  const approveTasks = () => {
    const proj = projects.find(p => p.id === selProj);
    const tasks = extracted.filter(t => t.selected).map(({ selected, assignee, ...t }) => {
      // assignee名からassigneeIdに変換
      const member = proj?.members?.find(m => m.name === assignee || assignee?.includes(m.name));
      return { ...t, assigneeIds: member ? [member.id] : [] };
    });
    onAddTasks(selProj, tasks);
    setStep("save");
  };

  const saveToProject = () => {
    const latestProj = projects.find(p => p.id === selProj);
    if (!latestProj || !minutes) return;
    const dateStr = new Date().toLocaleDateString("ja-JP");
    const titleStr = minutesTitle ? `${dateStr}　${minutesTitle}` : `${dateStr}　議事録`;
    const entry = {
      id: "min_" + Date.now(),
      title: titleStr,
      content: minutes,
      createdAt: new Date().toISOString(),
    };
    onUpdateProject({ ...latestProj, minutes: [...(latestProj.minutes || []), entry] });
    setSaveMsg("プロジェクトに保存しました。Projectsページで確認できます。");
  };

  const downloadPDF = () => {
    const projName = selProjObj?.name || "議事録";
    const date = new Date().toLocaleDateString("ja-JP").replace(/\//g, "-");
    const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${projName} 議事録</title>
<style>
  body { font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; padding: 40px; color: #2D2A24; line-height: 1.8; font-size: 13px; }
  h1 { font-size: 20px; border-bottom: 2px solid #C8694A; padding-bottom: 8px; margin-bottom: 24px; }
  h3 { font-size: 14px; margin-top: 24px; color: #4A4540; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0; }
  .project-tag { display: inline-block; background: #F5E6E0; color: #C8694A; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-bottom: 16px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="project-tag">📁 ${projName}</div>
<pre>${minutes}</pre>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projName}_議事録_${date}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveMsg("HTMLファイルをダウンロードしました。ブラウザで開いて印刷するとPDFに変換できます。");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(minutes).then(() => setSaveMsg("議事録をクリップボードにコピーしました。NotionやSlackに貼り付けてご利用ください。"));
  };

  const downloadTxt = () => {
    const projName = selProjObj?.name || "議事録";
    const date = new Date().toLocaleDateString("ja-JP").replace(/\//g, "-");
    const blob = new Blob([minutes], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projName}_議事録_${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveMsg("テキストファイルをダウンロードしました。");
  };

  const reset = () => {
    setStep("input"); setText(""); setFileName(""); setMinutes(""); setMinutesTitle(""); setExtracted([]); setSaveMsg(""); setAttendees([]); setBunseki(""); setNewMemberCandidates([]); setShowMemberConfirm(false); setShowRegenConfirm(false); setShowQuickAddMember(false); setQuickMember({ name: "", org: "", isAndto: false }); setAudioFile(null);
  };

  const stepIdx = STEPS.indexOf(step);

  const inputStyle = { width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>

      {/* 未登録メンバー確認モーダル */}
      {showMemberConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
          onClick={() => setShowMemberConfirm(false)}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 28, width: 420, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 24px 70px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>👥</div>
            <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 900, color: C.text }}>新しいメンバー候補が見つかりました</h3>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              テキストに未登録の人物が含まれています。プロジェクト「<strong style={{ color: selProjObj?.color }}>{selProjObj?.name}</strong>」のメンバーに追加しますか？
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, maxHeight: "40vh", overflowY: "auto" }}>
              {newMemberCandidates.map(c => (
                <div key={c.id} onClick={() => setNewMemberCandidates(cs => cs.map(x => x.id === c.id ? { ...x, selected: !x.selected } : x))}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    background: c.selected ? C.sageLight : C.bg,
                    border: `1.5px solid ${c.selected ? C.sage : C.border}`,
                    borderRadius: 12, cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${c.selected ? C.sage : C.border}`,
                    background: c.selected ? C.sage : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {c.selected && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.name}</div>
                    <input onClick={e => e.stopPropagation()} value={c.org} onChange={e => setNewMemberCandidates(cs => cs.map(x => x.id === c.id ? { ...x, org: e.target.value } : x))}
                      placeholder="所属・会社名を入力"
                      style={{ marginTop: 4, width: "100%", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <label onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.muted, cursor: "pointer", flexShrink: 0 }}>
                    <input type="checkbox" checked={c.isAndto} onChange={e => setNewMemberCandidates(cs => cs.map(x => x.id === c.id ? { ...x, isAndto: e.target.checked } : x))} />
                    andto
                  </label>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowMemberConfirm(false)}
                style={btn({ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, fontWeight: 700 })}>
                スキップ
              </button>
              <button onClick={() => {
                const toAdd = newMemberCandidates.filter(c => c.selected).map(({ id, selected, ...m }) => ({ ...m, id: "m" + Date.now() + Math.random().toString(36).slice(2) }));
                if (toAdd.length > 0 && selProjObj) {
                  const updatedMembers = [...(selProjObj.members || []), ...toAdd].sort((a, b) => {
                    if (a.name === "谷口" && a.isAndto) return -1;
                    if (b.name === "谷口" && b.isAndto) return 1;
                    return (a.org || "ん").localeCompare(b.org || "ん", "ja");
                  });
                  onUpdateProject({ ...selProjObj, members: updatedMembers });
                  setAttendees(prev => [...prev, ...toAdd.map(m => m.id)]);
                }
                setShowMemberConfirm(false);
                setShowRegenConfirm(true);
              }}
                style={btn({ padding: "9px 22px", borderRadius: 10, background: C.sage, color: "#fff", fontSize: 13, fontWeight: 800 })}>
                追加する
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 議事録再生成確認モーダル */}
      {showRegenConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 28, width: 380, maxWidth: "90vw", boxShadow: "0 24px 70px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 900, color: C.text }}>議事録を再生成しますか？</h3>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
              追加されたメンバーを反映して、議事録を作り直すことができます。<br/>
              現在の議事録を手動で編集する場合はそのままにしてください。
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowRegenConfirm(false)}
                style={btn({ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, fontWeight: 700 })}>
                そのまま編集
              </button>
              <button onClick={() => {
                setShowRegenConfirm(false);
                setStep("input");
              }}
                style={btn({ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${C.sage}`, background: "transparent", color: C.sage, fontSize: 13, fontWeight: 700 })}>
                入力に戻る
              </button>
              <button onClick={() => {
                setShowRegenConfirm(false);
                setMinutes("");
                setStep("input");
                setTimeout(() => generateMinutes(true), 50);
              }}
                style={btn({ padding: "9px 22px", borderRadius: 10, background: C.accent, color: "#fff", fontSize: 13, fontWeight: 800 })}>
                再生成する
              </button>
            </div>
          </div>
        </div>
      )}
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>会議メモからAIが議事録を生成し、タスクを自動抽出してプロジェクトに登録します。</p>

      {/* ステップインジケーター */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
        {STEP_LABELS.map((lbl, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEP_LABELS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                background: i < stepIdx ? C.sage : i === stepIdx ? C.accent : C.border,
                color: i <= stepIdx ? "#fff" : C.muted }}>
                {i < stepIdx ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: i === stepIdx ? C.accent : i < stepIdx ? C.sage : C.muted, whiteSpace: "nowrap" }}>{lbl}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < stepIdx ? C.sage : C.border, margin: "0 6px", marginBottom: 18 }} />
            )}
          </div>
        ))}
      </div>

      {/* ① 入力 */}
      {step === "input" && (
        <div style={{ background: C.surface, borderRadius: 16, padding: 24, border: `1.5px solid ${C.border}` }}>
          {/* プロジェクト選択 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 8 }}>📁 対象プロジェクト</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {projects.map(p => (
                <button key={p.id} onClick={() => handleProjChange(p.id)}
                  style={btn({ padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                    background: selProj === p.id ? p.color : "transparent",
                    color: selProj === p.id ? "#fff" : C.muted,
                    border: `2px solid ${selProj === p.id ? p.color : C.border}`,
                    transition: "all 0.15s" })}>
                  <span style={{ marginRight: 5 }}>●</span>{p.name}
                </button>
              ))}
            </div>
            {selProjObj && (
              <div style={{ marginTop: 8, fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: selProjObj.color }} />
                選択中：<strong style={{ color: selProjObj.color }}>{selProjObj.name}</strong>
                {selProjObj.desc && <span>— {selProjObj.desc}</span>}
              </div>
            )}
          </div>

          {/* 出席者選択 */}
          {selProjObj && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>👥 出席者を選択</label>
                <button onClick={() => setShowQuickAddMember(v => !v)}
                  style={btn({ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: showQuickAddMember ? C.sage : "transparent",
                    color: showQuickAddMember ? "#fff" : C.sage,
                    border: `1.5px solid ${C.sage}`, transition: "all 0.15s" })}>
                  ＋ メンバーを追加
                </button>
              </div>

              {/* メンバー追加ミニフォーム */}
              {showQuickAddMember && (
                <div style={{ background: C.bg, borderRadius: 12, padding: 14, border: `1.5px dashed ${C.sage}`, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input value={quickMember.name} onChange={e => setQuickMember(m => ({ ...m, name: e.target.value }))}
                      placeholder="氏名（苗字）*"
                      style={{ width: 0, flex: 1, minWidth: 0, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                    <input value={quickMember.org} onChange={e => setQuickMember(m => ({ ...m, org: e.target.value }))}
                      placeholder="所属・会社名"
                      style={{ width: 0, flex: 1, minWidth: 0, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, cursor: "pointer" }}>
                      <input type="checkbox" checked={quickMember.isAndto} onChange={e => setQuickMember(m => ({ ...m, isAndto: e.target.checked, org: e.target.checked ? "andto" : m.org }))} />
                      andtoメンバー（敬称なし）
                    </label>
                    <button onClick={() => {
                      if (!quickMember.name.trim() || !selProjObj) return;
                      const newM = { id: "m" + Date.now(), name: quickMember.name, org: quickMember.org, isAndto: quickMember.isAndto };
                      const sorted = [...(selProjObj.members || []), newM].sort((a, b) => {
                        if (a.name === "谷口" && a.isAndto) return -1;
                        if (b.name === "谷口" && b.isAndto) return 1;
                        return (a.org || "ん").localeCompare(b.org || "ん", "ja");
                      });
                      onUpdateProject({ ...selProjObj, members: sorted });
                      // 追加したメンバーを出席者にも自動選択
                      setAttendees(prev => [...prev, newM.id]);
                      setQuickMember({ name: "", org: "", isAndto: false });
                      setShowQuickAddMember(false);
                    }}
                      style={btn({ padding: "7px 16px", borderRadius: 8, background: quickMember.name.trim() ? C.sage : C.border, color: "#fff", fontSize: 12, fontWeight: 700 })}>
                      追加
                    </button>
                  </div>
                </div>
              )}

              {(selProjObj.members || []).length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(selProjObj.members || []).map(m => {
                      const selected = attendees.includes(m.id);
                      return (
                        <button key={m.id} onClick={() => toggleAttendee(m.id)}
                          style={btn({ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: selected ? (m.isAndto ? C.accent : C.sage) : "transparent",
                            color: selected ? "#fff" : C.muted,
                            border: `1.5px solid ${selected ? (m.isAndto ? C.accent : C.sage) : C.border}`,
                            display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" })}>
                          <div style={{ width: 18, height: 18, borderRadius: "50%", background: selected ? "rgba(255,255,255,0.3)" : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: selected ? "#fff" : C.muted }}>
                            {m.name.charAt(0)}
                          </div>
                          {m.name}
                          {m.isAndto && <span style={{ fontSize: 9, opacity: 0.8 }}>andto</span>}
                        </button>
                      );
                    })}
                  </div>
                  {attendees.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: C.muted, background: C.bg, borderRadius: 8, padding: "6px 10px" }}>
                      出席者：{(selProjObj.members || []).filter(m => attendees.includes(m.id)).map(m => m.isAndto ? `${m.name}（andto）` : `${m.name}様`).join("、")}
                    </div>
                  )}
                </>
              )}
              {(selProjObj.members || []).length === 0 && !showQuickAddMember && (
                <div style={{ fontSize: 12, color: C.muted }}>メンバーが未登録です。追加ボタンから登録してください。</div>
              )}
            </div>
          )}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 14 }}>

            {/* 文責選択 */}
            {selProjObj && (selProjObj.members || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 8 }}>✍️ 文責</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(selProjObj.members || []).map(m => (
                    <button key={m.id} onClick={() => setBunseki(bunseki === m.id ? "" : m.id)}
                      style={btn({ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: bunseki === m.id ? (m.isAndto ? C.accent : C.sage) : "transparent",
                        color: bunseki === m.id ? "#fff" : C.muted,
                        border: `1.5px solid ${bunseki === m.id ? (m.isAndto ? C.accent : C.sage) : C.border}`,
                        display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" })}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: bunseki === m.id ? "rgba(255,255,255,0.3)" : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: bunseki === m.id ? "#fff" : C.muted }}>
                        {m.name.charAt(0)}
                      </div>
                      {m.name}{m.isAndto && <span style={{ fontSize: 9, opacity: 0.8 }}>andto</span>}
                    </button>
                  ))}
                </div>
                {bunseki && (
                  <div style={{ marginTop: 6, fontSize: 11, color: C.muted }}>
                    文責：{selProjObj.members.find(m => m.id === bunseki)?.name}
                  </div>
                )}
              </div>
            )}

            <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 8 }}>📎 ファイル添付またはテキスト入力</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
              onDrop={e => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile({ target: { files: [f] } });
              }}
              style={{ border: `2px dashed ${isDragging ? C.sage : C.border}`, borderRadius: 12, padding: "24px", textAlign: "center", cursor: "pointer", marginBottom: 12,
                background: isDragging ? C.sageLight : C.bg, transition: "all 0.15s" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{isDragging ? "📂" : "📎"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: isDragging ? C.sage : fileName ? C.accent : C.text }}>
                {isDragging ? "ここにドロップ" : fileName || "クリックまたはドラッグ＆ドロップ"}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>.txt / .md / .m4a / .mp3 / .wav 対応</div>
              <input ref={fileRef} type="file" style={{ display: "none" }} accept=".txt,.md,.m4a,.mp3,.wav,.mp4,.webm" onChange={handleFile} />
            </div>
            {audioFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.accentLight, borderRadius: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>🎤 {audioFile.name}</span>
                <button onClick={generateMinutesFromAudio} disabled={loading || !selProj}
                  style={btn({ padding: "5px 16px", borderRadius: 8, background: loading || !selProj ? C.border : C.accent, color: "#fff", fontSize: 12, fontWeight: 700, marginLeft: "auto" })}>
                  {loading ? "⏳ 生成中..." : "✨ 議事録を生成"}
                </button>
              </div>
            )}
            <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
              placeholder="または会議メモ・発言内容を直接ペースト..."
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7, fontFamily: "inherit" }} />
          </div>

          <button onClick={() => generateMinutes(false)} disabled={!text.trim() || !selProj || loading}
            style={btn({ padding: "12px 28px", borderRadius: 12, fontSize: 13, fontWeight: 800, color: "#fff",
              background: text.trim() && selProj && !loading ? C.accent : C.border, transition: "background 0.2s" })}>
            {loading ? "⏳ 生成中..." : "✨ 議事録を生成する"}
          </button>
          {genError && (
            <div style={{ marginTop: 14, background: "#FEE2E2", border: "1.5px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
              ⚠️ {genError}
            </div>
          )}
        </div>
      )}

      {/* ② 議事録確認 */}
      {step === "minutes" && (
        <div style={{ background: C.surface, borderRadius: 16, padding: 24, border: `1.5px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <span style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>生成された議事録</span>
              <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>内容を確認・編集してからタスクを抽出してください</span>
            </div>
            <button onClick={() => setStep("input")} style={btn({ fontSize: 12, color: C.muted, background: "transparent" })}>← 戻る</button>
          </div>
          {/* 日付＋タイトル */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "10px 14px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{new Date().toLocaleDateString("ja-JP")}</span>
            <span style={{ color: C.border }}>｜</span>
            <input value={minutesTitle} onChange={e => setMinutesTitle(e.target.value)}
              placeholder="タイトルを入力"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, fontWeight: 700, color: C.text, background: "transparent" }} />
          </div>
          {genError && (
            <div style={{ marginBottom: 14, background: "#FEE2E2", border: "1.5px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
              ⚠️ {genError}
              <button onClick={() => { setGenError(""); setStep("input"); }}
                style={btn({ marginLeft: 12, fontSize: 11, color: "#DC2626", background: "transparent", textDecoration: "underline" })}>
                入力に戻って再試行
              </button>
            </div>
          )}
          <div style={{ background: C.bg, borderRadius: 10, padding: 4, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: selProjObj?.color, marginLeft: 8 }} />
            <span style={{ fontSize: 12, color: C.muted }}>プロジェクト：</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: selProjObj?.color }}>{selProjObj?.name}</span>
          </div>
          <textarea value={minutes} onChange={e => setMinutes(e.target.value)} rows={18}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.8, fontFamily: "'Courier New', monospace", fontSize: 12, marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={extractTasks} disabled={loading}
              style={btn({ padding: "12px 28px", borderRadius: 12, background: loading ? C.border : C.sage, color: "#fff", fontSize: 13, fontWeight: 800 })}>
              {loading ? "⏳ 抽出中..." : "📋 タスクを抽出する"}
            </button>
          </div>
        </div>
      )}

      {/* ③ タスク承認 */}
      {step === "tasks" && (
        <div style={{ background: C.surface, borderRadius: 16, padding: 24, border: `1.5px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>タスクの承認</span>
            <button onClick={() => setStep("minutes")} style={btn({ fontSize: 12, color: C.muted, background: "transparent" })}>← 議事録に戻る</button>
          </div>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
            追加するタスクにチェックを入れ、内容を編集してください。承認後、<strong style={{ color: selProjObj?.color }}>{selProjObj?.name}</strong> のカンバンに登録されます。
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button onClick={() => setExtracted(ex => ex.map(x => ({ ...x, selected: true })))}
              style={btn({ fontSize: 12, color: C.sage, background: "transparent", marginRight: 12 })}>全選択</button>
            <button onClick={() => setExtracted(ex => ex.map(x => ({ ...x, selected: false })))}
              style={btn({ fontSize: 12, color: C.muted, background: "transparent" })}>全解除</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {extracted.map(t => (
              <div key={t.id} style={{ background: t.selected ? C.sageLight : C.bg, border: `1.5px solid ${t.selected ? C.sage : C.border}`, borderRadius: 12, overflow: "hidden" }}>
                {/* チェック行 */}
                <div onClick={() => setExtracted(ex => ex.map(x => x.id === t.id ? { ...x, selected: !x.selected } : x))}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${t.selected ? C.sage : C.border}`,
                    background: t.selected ? C.sage : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {t.selected && <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text }}>{t.title || "（タイトル未入力）"}</span>
                  <PriorityDot p={t.priority} />
                </div>
                {/* 編集フィールド */}
                <div onClick={e => e.stopPropagation()} style={{ padding: "0 14px 12px 46px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={t.title} onChange={e => setExtracted(ex => ex.map(x => x.id === t.id ? { ...x, title: e.target.value } : x))}
                    placeholder="タスク名"
                    style={{ flex: "2 1 160px", minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 9px", fontSize: 12, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                  <input value={t.assignee} onChange={e => setExtracted(ex => ex.map(x => x.id === t.id ? { ...x, assignee: e.target.value } : x))}
                    placeholder="👤 担当者"
                    style={{ flex: "1 1 90px", minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 9px", fontSize: 12, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                  <input type="date" value={t.dueDate} onChange={e => setExtracted(ex => ex.map(x => x.id === t.id ? { ...x, dueDate: e.target.value } : x))}
                    style={{ flex: "1 1 120px", minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 9px", fontSize: 12, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                  <select value={t.priority} onChange={e => setExtracted(ex => ex.map(x => x.id === t.id ? { ...x, priority: e.target.value } : x))}
                    style={{ flex: "1 1 70px", minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 9px", fontSize: 12, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }}>
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 13, color: C.muted }}>{extracted.filter(t => t.selected).length} / {extracted.length} 件を選択中</span>
            <button onClick={approveTasks} disabled={extracted.filter(t => t.selected).length === 0}
              style={btn({ padding: "12px 28px", borderRadius: 12, fontSize: 13, fontWeight: 800, color: "#fff",
                background: extracted.filter(t => t.selected).length > 0 ? C.accent : C.border })}>
              ✅ 承認してカンバンに追加
            </button>
          </div>
        </div>
      )}

      {/* ④ 保存 */}
      {step === "save" && (
        <div style={{ background: C.surface, borderRadius: 16, padding: 24, border: `1.5px solid ${C.border}` }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 4 }}>タスクを登録しました！</div>
            <div style={{ fontSize: 13, color: C.muted }}>
              <strong style={{ color: selProjObj?.color }}>{selProjObj?.name}</strong> のカンバンにタスクが追加されました。<br/>
              議事録を保存する方法を選択してください。
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
            {[
              { icon: "📁", label: "プロジェクトに保存", desc: "Projectsページに蓄積", action: saveToProject, color: selProjObj?.color || C.sage },
              { icon: "🖨️", label: "PDF として保存", desc: "印刷ダイアログからPDF出力", action: downloadPDF, color: C.accent },
              { icon: "📄", label: "テキストで保存", desc: ".txt ファイルをダウンロード", action: downloadTxt, color: C.sage },
              { icon: "📋", label: "クリップボードにコピー", desc: "NotionやSlackに貼り付け", action: copyToClipboard, color: C.doing },
            ].map(({ icon, label, desc, action, color }) => (
              <button key={label} onClick={action}
                style={btn({ padding: "18px 16px", borderRadius: 14, border: `2px solid ${color}30`, background: color + "12",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", transition: "all 0.15s" })}>
                <span style={{ fontSize: 28 }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color }}>{label}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{desc}</span>
              </button>
            ))}
          </div>

          {saveMsg && (
            <div style={{ background: C.sageLight, border: `1.5px solid ${C.sage}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: C.sage, fontWeight: 600, marginBottom: 16 }}>
              ✓ {saveMsg}
            </div>
          )}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <button onClick={reset}
              style={btn({ padding: "10px 22px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, fontWeight: 700 })}>
              ＋ 新しい議事録を作成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MINUTES DETAIL PAGE ───────────────────────────────────────────────────────
function MinutesDetailPage({ project, onBack, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [aiEditId, setAiEditId] = useState(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const runAiEdit = async (m) => {
    if (!aiInstruction.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const endpoint = window.location.hostname.includes("vercel.app") || window.location.hostname.includes("andto") ? "/api/chat" : "https://api.anthropic.com/v1/messages";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: "あなたは議事録編集の専門家です。ユーザーの指示に従って議事録を修正してください。元の構成・フォーマットを極力維持し、指示された箇所のみ修正してください。修正後の議事録全文のみを出力してください。",
          messages: [{ role: "user", content: `以下の議事録を指示に従って修正してください。

【修正指示】
${aiInstruction}

【議事録】
${m.content}` }]
        })
      });
      const d = await res.json();
      if (d.error) { setAiError("AIエラー：" + (d.error.message || "")); return; }
      const revised = d.content?.[0]?.text || "";
      if (revised) {
        onUpdate({ ...project, minutes: project.minutes.map(x => x.id === m.id ? { ...x, content: revised } : x) });
        setAiEditId(null);
        setAiInstruction("");
      }
    } catch (e) {
      setAiError("通信エラー：" + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const openEdit = (m) => { setEditingId(m.id); setEditContent(m.content); };
  const saveEdit = () => {
    onUpdate({ ...project, minutes: project.minutes.map(m => m.id === editingId ? { ...m, content: editContent } : m) });
    setEditingId(null);
  };


  const downloadPDF = (m) => {
    const safeContent = m.content
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const htmlBody = safeContent.split("\n").map(line => {
      if (line.startsWith("# "))   return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## "))  return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("* ") || line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      if (line.startsWith("---")) return `<hr>`;
      if (line.trim() === "") return `<div class="spacer"></div>`;
      return `<p>${line}</p>`;
    }).join("\n");

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${m.title || "議事録"}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif;
    color: #000; font-size: 10.5pt; line-height: 1.9;
    background: #eee;
  }
  .print-btn {
    position: fixed; top: 20px; right: 20px;
    background: #333; color: #fff; border: none;
    padding: 10px 22px; border-radius: 6px; font-size: 13px;
    font-weight: 700; cursor: pointer; z-index: 100;
    font-family: inherit;
  }
  .print-btn:hover { background: #000; }
  .page {
    max-width: 794px; margin: 40px auto; background: #fff;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  }
  .doc-header {
    padding: 32px 48px 24px;
    border-bottom: 1.5px solid #000;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .header-left { flex: 1; }
  .company-name { font-size: 9pt; color: #333; margin-bottom: 4px; }
  .project-name { font-size: 12pt; font-weight: 700; }
  .header-right { text-align: right; font-size: 8.5pt; color: #333; }
  .meta-row { margin-bottom: 3px; }
  .content { padding: 28px 48px 48px; }
  h1 {
    font-size: 12pt; font-weight: 900;
    border-bottom: 1.5px solid #000; padding-bottom: 4px;
    margin: 24px 0 8px;
  }
  h2 {
    font-size: 11pt; font-weight: 700;
    border-left: 3px solid #000; padding-left: 8px;
    margin: 16px 0 6px;
  }
  h3 {
    font-size: 10.5pt; font-weight: 700;
    margin: 12px 0 4px; padding-left: 12px;
  }
  p { margin: 2px 0; padding-left: 4px; }
  li { margin: 2px 0 2px 24px; }
  hr { border: none; border-top: 1px solid #ccc; margin: 14px 0; }
  .spacer { height: 6px; }
  .doc-footer {
    border-top: 1px solid #ccc; padding: 12px 48px;
    display: flex; justify-content: space-between;
    font-size: 8pt; color: #666;
  }
  @media print {
    .print-btn { display: none; }
    body { background: #fff; font-size: 10pt; }
    .page { margin: 0; box-shadow: none; max-width: 100%; }
    @page { margin: 15mm 18mm; size: A4; }
    h1, h2, h3 { page-break-after: avoid; }
    p, li { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ PDFとして保存</button>
<div class="page">
  <div class="doc-header">
    <div class="header-left">
      <div class="company-name">andto</div>
      <div class="project-name">${project.name}</div>
    </div>
    <div class="header-right">
      <div class="meta-row">作成日：${new Date(m.createdAt).toLocaleDateString("ja-JP")}</div>
      <div class="meta-row">文書：議事録</div>
    </div>
  </div>
  <div class="content">
    ${htmlBody}
  </div>
  <div class="doc-footer">
    <span>andto</span>
    <span>${project.name}</span>
  </div>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (m.title || "議事録").replace(/[\/\\:*?"<>|　]/g, "_") + ".html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [deletingId, setDeletingId] = useState(null);

  const deleteMinute = (id) => {
    if (deletingId === id) {
      onUpdate({ ...project, minutes: project.minutes.filter(m => m.id !== id) });
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  };

  // 本文の「日時　：」から打合せ日を抽出してソート（降順）
  const extractMeetingDate = (content) => {
    const match = content.match(/日時[　\s]*：[　\s]*(\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2})/);
    if (match) {
      const normalized = match[1].replace(/[年月]/g, "/").replace(/-/g, "/");
      const d = new Date(normalized);
      if (!isNaN(d)) return d;
    }
    return null;
  };

  const minutes = [...(project.minutes || [])].sort((a, b) => {
    const da = extractMeetingDate(a.content) || new Date(a.createdAt);
    const db = extractMeetingDate(b.content) || new Date(b.createdAt);
    return db - da; // 新しい順
  });

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={btn({ background: "transparent", color: C.muted, fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${C.border}` })}>← 戻る</button>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: project.color }} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.text }}>{project.name} — 議事録</h2>
        <span style={{ fontSize: 12, color: C.muted }}>{minutes.length}件</span>
      </div>

      {minutes.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.muted, fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          議事録がまだ保存されていません
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {minutes.map(m => (
          <div key={m.id} style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: "hidden" }}>
            {/* 議事録ヘッダー */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: editingId === m.id ? `1.5px solid ${C.border}` : "none" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: project.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, flexShrink: 0 }}>
                    {new Date(m.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.title.replace(/^\d{4}\/\d{1,2}\/\d{1,2}\s*/, "")}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => editingId === m.id ? saveEdit() : openEdit(m)}
                  style={btn({ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: editingId === m.id ? C.sage : "transparent",
                    color: editingId === m.id ? "#fff" : C.muted,
                    border: `1.5px solid ${editingId === m.id ? C.sage : C.border}` })}>
                  {editingId === m.id ? "💾 保存" : "✏️ 編集"}
                </button>
                {editingId === m.id && (
                  <button onClick={() => setEditingId(null)}
                    style={btn({ padding: "5px 12px", borderRadius: 8, fontSize: 12, color: C.muted, border: `1.5px solid ${C.border}`, background: "transparent" })}>キャンセル</button>
                )}
                <button onClick={() => { setAiEditId(aiEditId === m.id ? null : m.id); setAiInstruction(""); setAiError(""); }}
                  style={btn({ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: aiEditId === m.id ? C.accent : "transparent",
                    color: aiEditId === m.id ? "#fff" : C.accent,
                    border: `1.5px solid ${C.accent}` })}>
                  ✨ AI修正
                </button>
                <button onClick={() => downloadPDF(m)}
                  style={btn({ padding: "5px 12px", borderRadius: 8, fontSize: 12, color: C.muted, border: `1.5px solid ${C.border}`, background: "transparent" })} title="PDF出力">🖨️</button>
                <button onClick={() => deleteMinute(m.id)}
                  style={btn({ padding: "5px 12px", borderRadius: 8, fontSize: 12,
                    color: deletingId === m.id ? "#fff" : C.accent,
                    background: deletingId === m.id ? C.accent : "transparent",
                    border: `1.5px solid ${C.accent}` })}
                  title={deletingId === m.id ? "もう一度押すと削除" : "削除"}>
                  {deletingId === m.id ? "確認" : "✕"}
                </button>
              </div>
            </div>
            {/* AI修正パネル */}
            {aiEditId === m.id && (
              <div style={{ padding: "14px 18px", background: C.accentLight, borderBottom: `1.5px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8 }}>✨ AI修正指示</div>
                <textarea
                  value={aiInstruction}
                  onChange={e => setAiInstruction(e.target.value)}
                  placeholder="例：決定事項をより明確に書き直してください / 誤字脱字を修正してください / タスクの期限をすべて確認してください"
                  rows={3}
                  style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 11px", fontSize: 12, background: "#fff", color: C.text, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.7 }}
                />
                {aiError && <div style={{ fontSize: 12, color: C.accent, marginTop: 6 }}>{aiError}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => { setAiEditId(null); setAiInstruction(""); }}
                    style={btn({ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12, fontWeight: 700 })}>
                    キャンセル
                  </button>
                  <button onClick={() => runAiEdit(m)} disabled={aiLoading || !aiInstruction.trim()}
                    style={btn({ padding: "6px 18px", borderRadius: 8, background: aiLoading || !aiInstruction.trim() ? C.border : C.accent, color: "#fff", fontSize: 12, fontWeight: 700 })}>
                    {aiLoading ? "修正中..." : "修正する"}
                  </button>
                </div>
              </div>
            )}
            {/* 内容 */}
            {editingId === m.id ? (
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={20}
                style={{ width: "100%", border: "none", outline: "none", padding: "16px 18px", fontSize: 12, lineHeight: 1.8, fontFamily: "monospace", background: C.bg, color: C.text, resize: "vertical", boxSizing: "border-box" }} />
            ) : (
              <pre style={{ margin: 0, padding: "16px 18px", fontSize: 12, lineHeight: 1.8, color: C.text, whiteSpace: "pre-wrap", wordWrap: "break-word", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif" }}>
                {m.content}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [projects, setProjects] = useState(INIT_PROJECTS);
  const [tab, setTab] = useState("projects");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [minutesProjectId, setMinutesProjectId] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // ── ストレージから初回ロード ──────────────────────────────────────────────
  useEffect(() => {
    loadProjects().then(saved => {
      if (saved && saved.length > 0) {
        setProjects(saved);
      } else {
        // 保存データなし＝初回アクセス
        setShowWelcome(true);
      }
      setStorageReady(true);
    });
  }, []);

  // ── projects が変わったら自動保存 ─────────────────────────────────────────
  useEffect(() => {
    if (!storageReady) return;
    saveProjects(projects);
  }, [projects, storageReady]);
  // ──────────────────────────────────────────────────────────────────────────

  const updateProject = p => setProjects(ps => ps.map(x => x.id === p.id ? p : x));
  const deleteProject = id => { setProjects(ps => ps.filter(p => p.id !== id)); setTab("projects"); };
  const addProject = () => {
    if (!newName.trim()) return;
    const colors = [C.sage, C.doing, C.done, C.accent, "#9B8EC0"];
    const p = { id: uid(), name: newName, desc: "", color: colors[projects.length % colors.length], minutes: [], members: [], tasks: [] };
    setProjects(ps => [...ps, p]);
    setTab(p.id); setNewName(""); setShowAdd(false);
  };
  const addTasks = (pid, tasks) => { setProjects(ps => ps.map(p => p.id === pid ? { ...p, tasks: [...p.tasks, ...tasks] } : p)); setTab(pid); };

  const active = projects.find(p => p.id === tab);

  const exportData = () => {
    const data = JSON.stringify({ projects, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `taskflow-backup-${new Date().toLocaleDateString("ja-JP").replace(/\//g, "-")}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.projects && Array.isArray(data.projects)) {
          setProjects(data.projects);
          setTab("projects");
        } else { alert("正しいバックアップファイルではありません"); }
      } catch { alert("ファイルの読み込みに失敗しました"); }
    };
    r.readAsText(file);
    e.target.value = "";
  };

  const importRef = React.useRef ? React.useRef(null) : { current: null };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif", color: C.text }}>
      {/* NAV */}
      <div style={{ background: C.surface, borderBottom: `1.5px solid ${C.border}`, display: "flex", alignItems: "stretch", overflowX: "auto", paddingLeft: 20 }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: C.accent, paddingRight: 20, display: "flex", alignItems: "center", borderRight: `1px solid ${C.border}`, marginRight: 4, flexShrink: 0, letterSpacing: 0.5 }}>
          ✦ TaskFlow
        </div>
        {[["projects","📁 Projects"],["calendar","📅 カレンダー"],["minutes","✨ 議事録"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)}
            style={btn({ padding: "0 16px", height: 52, background: "transparent", fontSize: 13, fontWeight: 700, color: tab===id ? C.accent : C.muted, borderBottom: tab===id ? `2.5px solid ${C.accent}` : "2.5px solid transparent", flexShrink: 0, whiteSpace: "nowrap" })}>
            {lbl}
          </button>
        ))}
        <div style={{ width: 1, background: C.border, margin: "10px 8px", flexShrink: 0 }} />
        {projects.map(p => (
          <button key={p.id} onClick={() => setTab(p.id)}
            style={btn({ padding: "0 14px", height: 52, background: "transparent", fontSize: 13, fontWeight: 700, color: tab===p.id ? p.color : C.muted, borderBottom: tab===p.id ? `2.5px solid ${p.color}` : "2.5px solid transparent", flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 })}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} />
            {p.name}
          </button>
        ))}
        {showAdd ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", flexShrink: 0 }}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==="Enter" && addProject()} placeholder="プロジェクト名"
              style={{ border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 13, background: C.bg, color: C.text, outline: "none", width: 130 }} />
            <button onClick={addProject} style={btn({ background: C.accent, color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700 })}>追加</button>
            <button onClick={() => setShowAdd(false)} style={btn({ background: "transparent", color: C.muted, fontSize: 16 })}>✕</button>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} style={btn({ padding: "0 14px", height: 52, background: "transparent", fontSize: 13, color: C.muted, flexShrink: 0 })}>+ プロジェクト</button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, padding: "0 12px", flexShrink: 0 }}>
          <button onClick={exportData} title="データをエクスポート"
            style={btn({ padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" })}>
            ⬆ エクスポート
          </button>
          <button onClick={() => importRef.current?.click()} title="データをインポート"
            style={btn({ padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" })}>
            ⬇ インポート
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={importData} style={{ display: "none" }} />
        </div>
      </div>

      {/* CONTENT */}
      {minutesProjectId ? (
        <MinutesDetailPage
          project={projects.find(p => p.id === minutesProjectId)}
          onBack={() => setMinutesProjectId(null)}
          onUpdate={updateProject}
        />
      ) : (
        <>
          <div style={{ display: tab === "projects" ? "block" : "none" }}>
            <ProjectsPage
              projects={projects}
              onUpdate={updateProject}
              onDelete={deleteProject}
              onNavigate={id => setTab(id)}
              onViewMinutes={id => setMinutesProjectId(id)}
            />
          </div>
          <div style={{ display: tab === "calendar" ? "block" : "none" }}>
            <CalendarPage projects={projects} />
          </div>
          <div style={{ display: tab === "minutes" ? "block" : "none" }}>
            <MinutesPage projects={projects} onAddTasks={addTasks} onUpdateProject={updateProject} />
          </div>
          {active && tab === active.id && <KanbanPage key={active.id} project={active} onUpdate={updateProject} />}
        </>
      )}

      {/* ウェルカムモーダル（初回のみ） */}
      {showWelcome && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 10, letterSpacing: -0.3 }}>
              TaskFlowへようこそ
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 2, marginBottom: 28 }}>
              プロジェクト・タスク・議事録を一元管理できるチームツールです。<br />
              データは自動保存され、チーム全員とリアルタイムで共有されます。<br />
              サンプルデータを参考に、まず使い始めてみましょう。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
              {[["📁 Projects", "プロジェクト・タスク管理", C.sageLight, C.sage],
                ["✨ 議事録", "AI議事録作成・タスク自動抽出", C.accentLight, C.accent],
                ["📅 カレンダー", "期日・スケジュール確認", "#EEF3FF", "#5B7EC9"]
              ].map(([label, desc, bg, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, background: bg, borderRadius: 8, padding: "8px 14px" }}>
                  <span style={{ color, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>{label}</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>{desc}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowWelcome(false)}
              style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "13px 40px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              はじめる →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
