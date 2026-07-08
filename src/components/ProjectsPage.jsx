import React, { useState, useRef, useEffect } from "react";
import { BTN, C, COLOR_PALETTE, PHASE_LABELS, btn } from "../constants";

function ProjectsPage({ projects, onUpdate, onDelete, onNavigate, onReorder }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [modalTab, setModalTab] = useState("info");
  const [newMember, setNewMember] = useState({ name: "", org: "", isAndto: false });
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({ name: "", org: "", isAndto: false, slackId: "" });

  const sortMembers = (members) => [...members].sort((a, b) => {
    if (a.name === "谷口" && a.isAndto) return -1;
    if (b.name === "谷口" && b.isAndto) return 1;
    return (a.org || "ん").localeCompare(b.org || "ん", "ja");
  });

  const openEdit = (p) => { setForm({ name: p.name, desc: p.desc||"", color: p.color, members: p.members||[], phase: p.phase||"", phaseDates: p.phaseDates||{}, slackChannelId: p.slackChannelId||"" }); setModalTab("info"); setEditingId(p.id); };
  const closeEdit = () => { setEditingId(null); };
  const saveEdit = () => {
    if (!form.name.trim()) return;
    onUpdate({ ...projects.find(p => p.id === editingId), name: form.name, desc: form.desc, color: form.color, members: form.members, phase: form.phase, phaseDates: form.phaseDates||{}, slackChannelId: form.slackChannelId });
    closeEdit();
  };
  const addMember = () => {
    if (!newMember.name.trim()) return;
    setForm(f => ({ ...f, members: sortMembers([...(f.members||[]), { id: "m"+Date.now(), ...newMember }]) }));
    setNewMember({ name: "", org: "", isAndto: false });
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
        {projects.map(p => {
          const done = p.tasks.filter(t => t.status==="done").length;
          const doing = p.tasks.filter(t => t.status==="doing").length;
          const todo = p.tasks.filter(t => t.status==="todo").length;
          const pct = p.tasks.length ? Math.round(done/p.tasks.length*100) : 0;
          return (
            <div key={p.id} draggable className="card-anim"
              onDragStart={()=>setDragId(p.id)}
              onDragOver={e=>e.preventDefault()}
              onDrop={()=>{ if(!dragId||dragId===p.id)return; const ids=projects.map(x=>x.id); const from=ids.indexOf(dragId); const to=ids.indexOf(p.id); const next=[...ids]; next.splice(from,1); next.splice(to,0,dragId); onReorder(next); setDragId(null); }}
              onDragEnd={()=>setDragId(null)}
              style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display:"flex", flexDirection:"column", opacity:dragId===p.id?0.5:1, cursor:"grab" }}>
              <div style={{ height: 6, background: p.color }} />
              <div style={{ padding: 20, display:"flex", flexDirection:"column", flex:1 }}>
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
                <div style={{ display: "flex", gap: 12, fontSize: 12, marginBottom: 12 }}>
                  <span style={{ color: C.todo, fontWeight: 700 }}>未着手 {todo}</span>
                  <span style={{ color: C.doing, fontWeight: 700 }}>進行中 {doing}</span>
                  <span style={{ color: C.done, fontWeight: 700 }}>完了 {done}</span>
                  <span style={{ marginLeft: "auto", color: p.color, fontWeight: 900 }}>{pct}%</span>
                </div>
                {/* フェーズ進捗ステッパー */}
                {(() => {
                  const ci = PHASE_LABELS.indexOf(p.phase || "");
                  return (
                    <div style={{ marginBottom: 14, background: C.bg, borderRadius: 10, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginBottom: 6 }}>📍 フェーズ</div>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        {PHASE_LABELS.map((ph, i) => {
                          const done = ci >= 0 && i < ci;
                          const cur = i === ci;
                          return (
                            <React.Fragment key={ph}>
                              {i > 0 && <div style={{ flex: 1, height: 1.5, background: done || cur ? p.color : C.border, minWidth: 4, margin: "0 1px", marginBottom: 14 }} />}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
                                <div style={{ width: 16, height: 16, borderRadius: "50%", background: cur ? p.color : done ? p.color : "transparent", border: `2px solid ${done || cur ? p.color : C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {done && <span style={{ color: "#fff", fontSize: 7, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                                  {cur && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                                </div>
                                <span style={{ fontSize: 8, fontWeight: cur ? 900 : 600, color: done || cur ? p.color : C.muted, whiteSpace: "nowrap" }}>{ph}</span>
                                {(p.phaseDates||{})[ph] && <span style={{ fontSize: 7, color: C.muted, whiteSpace: "nowrap" }}>{(p.phaseDates||{})[ph].replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1/$2/$3")}</span>}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                  {(p.minutes||[]).length > 0 && <span style={{ fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>📝 議事録 {p.minutes.length}件</span>}
                  {(p.decisions||[]).length > 0 && <span style={{ fontSize: 11, color: C.decision, background: C.decisionLight, border: `1px solid #B8CAED`, borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>📋 決定事項 {p.decisions.length}件</span>}
                </div>
                <div style={{ marginTop:"auto" }}>
                  <button onClick={() => onNavigate(p.id)} style={btn({ width:"100%", padding: "9px 0", borderRadius: 10, background: p.color+"18", color: p.color, fontSize: 13, fontWeight: 700, border: `1.5px solid ${p.color}40` })}>開く →</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editingId && (() => {
        const target = projects.find(p => p.id === editingId);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onMouseDown={e=>{if(e.target===e.currentTarget)closeEdit();}}>
            <div style={{ background: C.surface, borderRadius: 20, padding: 28, width: 560, boxShadow: "0 24px 70px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
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
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 4 }}>
                    <span style={{ marginRight: 4 }}>💬</span>Slack連携チャンネルID
                  </label>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>このチャンネルの✅リアクションでタスクを自動登録します</div>
                  <input value={form.slackChannelId} onChange={e => setForm(f => ({ ...f, slackChannelId: e.target.value.trim() }))}
                    placeholder="例：C0466A8FAP8"
                    style={{ width: "100%", border: `1.5px solid ${form.slackChannelId ? form.color : C.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: C.bg, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
                  {form.slackChannelId && (
                    <div style={{ fontSize: 10, color: C.sage, marginTop: 4 }}>✓ チャンネル {form.slackChannelId} と連携します</div>
                  )}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 8 }}>📍 フェーズ</label>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {PHASE_LABELS.map((ph, i) => {
                      const ci = PHASE_LABELS.indexOf(form.phase || "");
                      const done = ci >= 0 && i < ci;
                      const cur = form.phase === ph;
                      return (
                        <React.Fragment key={ph}>
                          {i > 0 && <div style={{ flex: 1, height: 2, background: done || cur ? form.color : C.border, minWidth: 4, margin: "0 1px", marginBottom: 20 }} />}
                          <div onClick={() => setForm(f => ({ ...f, phase: ph }))} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: cur ? form.color : done ? form.color : "transparent", border: `2.5px solid ${done || cur ? form.color : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                              {done && <span style={{ color: "#fff", fontSize: 9, fontWeight: 900 }}>✓</span>}
                              {cur && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                            </div>
                            <span style={{ fontSize: 9, fontWeight: cur ? 900 : 600, color: done || cur ? form.color : C.muted, whiteSpace: "nowrap" }}>{ph}</span>
                            <input type="date" value={(form.phaseDates||{})[ph]||""} onChange={e => setForm(f => ({ ...f, phaseDates: { ...(f.phaseDates||{}), [ph]: e.target.value } }))} onClick={e => e.stopPropagation()} style={{ fontSize: 8, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 2px", background: C.bg, color: C.muted, width: 72, cursor: "pointer" }} />
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {form.phase && (
                    <button onClick={() => setForm(f => ({ ...f, phase: "" }))} style={btn({ marginTop: 8, fontSize: 10, color: C.muted, background: "transparent", padding: "2px 6px" })}>✕ フェーズをリセット</button>
                  )}
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
                            {editMemberForm.isAndto && (
                              <div style={{ marginBottom: 8 }}>
                                <input value={editMemberForm.slackId} onChange={e => setEditMemberForm(f => ({ ...f, slackId: e.target.value }))} placeholder="Slack ID（例: U037A6QU4QY）"
                                  style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, background: C.bg, color: C.text, outline: "none" }} />
                              </div>
                            )}
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
                            <button onClick={() => { setEditingMemberId(m.id); setEditMemberForm({ name: m.name, org: m.org, isAndto: m.isAndto, slackId: m.slackId || "" }); }} style={btn({ background: "transparent", color: C.muted, fontSize: 13, padding: "2px 6px" })}>✏️</button>
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
                  <button onClick={closeEdit} style={BTN.ghost}>キャンセル</button>
                  <button onClick={saveEdit} style={BTN.primary}>保存</button>
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
                <button onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); closeEdit(); }} style={BTN.danger}>削除する</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


export { ProjectsPage };
