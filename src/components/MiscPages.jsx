import React, { useState, useRef, useEffect } from "react";
import { DecisionsPage } from "./DecisionsPage";
import { KanbanPage } from "./KanbanPage";
import { MilestonePage } from "./MilestonePage";
import { MinutesDetailPage } from "./MinutesDetailPage";
import { PriorityDot, StatusBadge } from "./common";
import { C, btn } from "../constants";

function ProjectDetailPage({ project, onUpdate, onMinutesUpdate }) {
  const [subTab, setSubTab] = useState("tasks");
  return (
    <div>
      <div style={{ background: C.surface, borderBottom: `1.5px solid ${C.border}`, display: "flex", paddingLeft: 24 }}>
        {[["milestones","🚩 マイルストーン"],["tasks","📋 タスク"],["minutes","📝 議事録"],["decisions","📌 決定事項"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setSubTab(id)}
            style={btn({ padding: "10px 18px", fontSize: 13, fontWeight: 700, background: "transparent", color: subTab === id ? project.color : C.muted, borderBottom: subTab === id ? `2.5px solid ${project.color}` : "2.5px solid transparent", borderRadius: 0 })}>
            {lbl}
          </button>
        ))}
      </div>
      {subTab === "tasks" && <KanbanPage key={project.id} project={project} onUpdate={onUpdate} />}
      {subTab === "minutes" && <MinutesDetailPage project={project} onBack={() => setSubTab("tasks")} onUpdate={onMinutesUpdate} />}
      {subTab === "decisions" && <DecisionsPage project={project} onUpdate={onUpdate} />}
      {subTab === "milestones" && <MilestonePage project={project} onUpdate={onUpdate} />}
    </div>
  );
}

function MemberTasksPage({ projects }) {
  const [filterStatus, setFilterStatus] = useState("active");

  // メンバー名でグルーピング（複数プロジェクトに同名メンバーが存在する場合もまとめる）
  const memberMap = {};
  projects.forEach(p => {
    (p.members || []).forEach(m => {
      const key = m.name;
      if (!memberMap[key]) memberMap[key] = { name: m.name, isAndto: m.isAndto, tasks: [] };
      (p.tasks || []).filter(t => (t.assigneeIds || []).includes(m.id)).forEach(t => {
        memberMap[key].tasks.push({ task: t, project: p });
      });
    });
  });

  const entries = Object.values(memberMap).map(e => ({
    ...e,
    tasks: filterStatus === "active" ? e.tasks.filter(({task}) => task.status !== "done") : e.tasks
  })).filter(e => e.tasks.length > 0);

  return (
    <div style={{ overflowY:"auto", height:"calc(100dvh - 52px)", background:C.bg }}>
      <div style={{ padding:24, maxWidth:960, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:C.text, margin:0 }}>👥 メンバー別タスク</h2>
          <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
            {[["active","進行中のみ"],["all","全て"]].map(([key,lbl]) => (
              <button key={key} onClick={()=>setFilterStatus(key)}
                style={btn({ padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:700, border:`1.5px solid ${filterStatus===key?C.sage:C.border}`, background:filterStatus===key?C.sageLight:"transparent", color:filterStatus===key?C.sage:C.muted })}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {entries.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}>
            <div style={{ fontSize:36, marginBottom:12 }}>👥</div>
            <div style={{ fontSize:14, fontWeight:700 }}>担当タスクがありません</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {entries.map(e => (
              <div key={e.name} style={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:16, overflow:"hidden" }}>
                <div style={{ padding:"12px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, background:e.isAndto?C.sageLight:"#f9f7f3" }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:e.isAndto?C.sage:C.muted, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, flexShrink:0 }}>{e.name[0]}</div>
                  <span style={{ fontSize:15, fontWeight:800, color:C.text }}>{e.name}</span>
                  {e.isAndto && <span style={{ fontSize:10, color:C.sage, background:C.sageLight, border:`1px solid ${C.sage}`, borderRadius:20, padding:"2px 8px", fontWeight:700 }}>andto</span>}
                  <span style={{ marginLeft:"auto", fontSize:12, color:C.muted, fontWeight:700 }}>{e.tasks.length}件</span>
                </div>
                <div>
                  {e.tasks.map(({task:t, project:p}, i) => (
                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 20px", borderBottom:i<e.tasks.length-1?`1px solid ${C.border}`:"none" }}>
                      <PriorityDot p={t.priority} />
                      <span style={{ flex:1, fontSize:13, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</span>
                      <StatusBadge s={t.status} />
                      <span style={{ fontSize:11, color:C.muted, minWidth:80, textAlign:"right", flexShrink:0 }}>{t.dueDate||"期日未設定"}</span>
                      <span style={{ fontSize:11, color:p.color, fontWeight:700, background:`${p.color}18`, borderRadius:20, padding:"2px 10px", minWidth:80, textAlign:"center", flexShrink:0 }}>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SlackSettingsPage({ slackSettings, onChange }) {
  const def = {
    summaryChannel: "",
    notifyChannel: "",
    sourceChannels: [],
  };
  const [form, setForm] = useState({ ...def, ...slackSettings });
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null); // "ok" | "error"

  const sendSummaryNow = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/manual-summary", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
      });
      const data = await res.json();
      setSendResult(data.ok ? "ok" : "error");
    } catch {
      setSendResult("error");
    } finally {
      setSending(false);
      setTimeout(() => setSendResult(null), 4000);
    }
  };

  // Supabase からの非同期ロード完了後に props が更新されたら form に反映
  useEffect(() => {
    setForm({ ...def, ...slackSettings });
  }, [slackSettings]);

  const save = () => {
    onChange(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addChannel = () => setForm(f => ({ ...f, sourceChannels: [...f.sourceChannels, { id: "", name: "" }] }));
  const removeChannel = i => setForm(f => ({ ...f, sourceChannels: f.sourceChannels.filter((_, idx) => idx !== i) }));
  const updateChannel = (i, key, val) => setForm(f => ({
    ...f, sourceChannels: f.sourceChannels.map((ch, idx) => idx === i ? { ...ch, [key]: val } : ch)
  }));

  return (
    <div style={{ padding: "32px 24px", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 24 }}>💬 Slack設定</div>

      {/* 週次サマリー */}
      <div style={{ background: C.surface, borderRadius: 14, padding: 20, border: `1.5px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 16 }}>📊 週次サマリー</div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 4 }}>週次サマリー投稿先チャンネルID</label>
          <input value={form.summaryChannel} onChange={e => setForm(f => ({ ...f, summaryChannel: e.target.value.trim() }))}
            placeholder="例：C06UAGYA1L2"
            style={{ width: "100%", border: `1.5px solid ${form.summaryChannel ? C.sage : C.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>週次サマリー対象チャンネル</label>
            <button onClick={addChannel} style={btn({ padding: "4px 12px", borderRadius: 8, background: C.sage, color: "#fff", fontSize: 11, fontWeight: 700 })}>＋ 追加</button>
          </div>
          {form.sourceChannels.length === 0 && (
            <div style={{ fontSize: 11, color: C.muted, padding: "8px 0" }}>対象チャンネルがまだ追加されていません</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {form.sourceChannels.map((ch, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={ch.id} onChange={e => updateChannel(i, "id", e.target.value.trim())}
                  placeholder="チャンネルID（例：C0466A8FAP8）"
                  style={{ flex: 2, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
                <input value={ch.name} onChange={e => updateChannel(i, "name", e.target.value)}
                  placeholder="チャンネル名（例：KAM）"
                  style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box" }} />
                <button aria-label="チャンネルを削除" onClick={() => removeChannel(i)} style={btn({ padding: "5px 10px", borderRadius: 8, background: "transparent", color: C.muted, fontSize: 13, border: `1.5px solid ${C.border}` })}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 期日通知 */}
      <div style={{ background: C.surface, borderRadius: 14, padding: 20, border: `1.5px solid ${C.border}`, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 16 }}>🔔 期日通知</div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 4 }}>期日通知投稿先チャンネルID</label>
          <input value={form.notifyChannel} onChange={e => setForm(f => ({ ...f, notifyChannel: e.target.value.trim() }))}
            placeholder="例：C06UAGYA1L2"
            style={{ width: "100%", border: `1.5px solid ${form.notifyChannel ? C.sage : C.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={save} style={btn({ padding: "10px 28px", borderRadius: 10, background: C.sage, color: "#fff", fontSize: 13, fontWeight: 800 })}>💾 保存</button>
        {saved && <span style={{ fontSize: 12, color: C.sage, fontWeight: 700 }}>✓ 保存しました</span>}
        <button onClick={sendSummaryNow} disabled={sending}
          style={btn({ padding: "10px 20px", borderRadius: 10, background: sending ? C.border : C.decision, color: "#fff", fontSize: 13, fontWeight: 800, opacity: sending ? 0.7 : 1, cursor: sending ? "default" : "pointer" })}>
          {sending ? "⏳ 送信中..." : "📊 今すぐサマリーを送信"}
        </button>
        {sendResult === "ok" && <span style={{ fontSize: 12, color: C.sage, fontWeight: 700 }}>✓ 送信しました</span>}
        {sendResult === "error" && <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>⚠️ 送信に失敗しました</span>}
      </div>
    </div>
  );
}


export { ProjectDetailPage, MemberTasksPage, SlackSettingsPage };
