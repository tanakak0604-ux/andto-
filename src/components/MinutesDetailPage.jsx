import React, { useState, useRef, useEffect } from "react";
import { ConfirmDialog, PriorityDot } from "./common";
import { BTN, C, btn } from "../constants";
import { callClaude } from "../lib/gemini";
import { PREVIEW_CSS, buildAgendaBody, buildMinutesBody, highlightInHtml } from "../lib/print";
import { escapeHtml, extractJsonArray, uid } from "../lib/text";

function MinutesDetailPage({ project, onBack, onUpdate }) {
  const [selectedId, setSelectedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const detailTextareaRef = useRef();
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const [aiPanelMode, setAiPanelMode] = useState("edit"); // "edit" | "chat"
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [diffResult, setDiffResult] = useState(null); // {original, revised, lines}
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef();
  const [deletingId, setDeletingId] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractMode, setExtractMode] = useState(false);
  const [detailExtracted, setDetailExtracted] = useState([]);
  const [detailExtractedDecisions, setDetailExtractedDecisions] = useState([]);
  const [detailEditingDecId, setDetailEditingDecId] = useState(null);
  const [detailEditingDecText, setDetailEditingDecText] = useState("");
  const [approveMsg, setApproveMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const [agendaError, setAgendaError] = useState("");
  const [showAgendaPreview, setShowAgendaPreview] = useState(false);
  const [isEditingAgenda, setIsEditingAgenda] = useState(false);
  const [agendaContent, setAgendaContent] = useState('');
  const [currentAgenda, setCurrentAgenda] = useState(null);
  const [confirmDeleteAgenda, setConfirmDeleteAgenda] = useState(false);
  const [subtaskLoading, setSubtaskLoading] = useState(false);
  const [localFolders, setLocalFolders] = useState(project.decisionFolders || []);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const subtaskMoveRef = React.useRef(false);

  // ※ selectedMinute は下で宣言のため、依存配列は selectedId を使用

  const extractGaiyou = (content) => {
    const match = content.match(/名称[　\s]*：[　\s]*(.+)/) || content.match(/打合せ概要[　\s]*：[　\s]*(.+)/);
    return match ? match[1].trim() : "";
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

  const selectedMinute = minutes.find(m => m.id === selectedId);

  // アジェンダ自動ロード：selectedId 変化時（selectedMinute より後に定義のため依存は selectedId）
  useEffect(() => {
    try {
      const agendas = selectedMinute?.agendas;
      if (agendas && Array.isArray(agendas) && agendas.length > 0) {
        const latest = agendas[agendas.length - 1];
        if (latest) {
          setCurrentAgenda(latest);
          setAgendaContent(latest.content || '');
        }
      } else {
        setCurrentAgenda(null);
        setAgendaContent('');
      }
    } catch (e) {
      console.error('agenda init error:', e);
      setCurrentAgenda(null);
      setAgendaContent('');
    }
    setIsEditingAgenda(false);
  }, [selectedId]); // eslint-disable-line

  useEffect(() => {
    const minute = project.minutes?.find(m => m.id === selectedId);
    setChatMessages(minute?.chatHistory || []);
  }, [selectedId]); // eslint-disable-line

  const hasAgenda = Boolean(
    currentAgenda &&
    selectedMinute?.agendas &&
    Array.isArray(selectedMinute.agendas) &&
    selectedMinute.agendas.length > 0
  );

  const computeLineDiff = (oldText, newText) => {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const m = oldLines.length, n = newLines.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = oldLines[i-1] === newLines[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
    const result = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i-1] === newLines[j-1]) { result.unshift({ type: "same", text: oldLines[i-1] }); i--; j--; }
      else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { result.unshift({ type: "add", text: newLines[j-1] }); j--; }
      else { result.unshift({ type: "remove", text: oldLines[i-1] }); i--; }
    }
    return result;
  };

  const runAiEdit = async () => {
    if (!aiInstruction.trim() || !selectedMinute) return;
    const input = aiInstruction.trim();
    setAiInstruction("");
    setAiLoading(true); setAiError("");
    try {
      const revised = await callClaude({
        system: "あなたは議事録編集の専門家です。ユーザーの指示に従って議事録を修正してください。元の構成・フォーマットを極力維持し、指示された箇所のみ修正してください。修正後の議事録全文のみを出力してください。",
        messages: [{ role: "user", content: `以下の議事録を指示に従って修正してください。\n\n【修正指示】\n${input}\n\n【議事録】\n${editContent}` }]
      });
      if (revised) {
        const diffLines = computeLineDiff(editContent, revised);
        setDiffResult({ original: editContent, revised, lines: diffLines });
        setAiEditOpen(false);
      }
    } catch(e) { setAiError("エラー："+e.message); setAiInstruction(input); }
    setAiLoading(false);
  };

  const runAiChat = async () => {
    if (!aiInstruction.trim() || !selectedMinute) return;
    const input = aiInstruction.trim();
    const prevMessages = [...chatMessages];
    setAiInstruction("");
    setAiLoading(true); setAiError("");
    const src = selectedMinute.sourceText;
    try {
      const answer = await callClaude({
        system: `あなたは議事録作成の専門家です。以下の情報を参照してユーザーの質問に日本語で簡潔に答えてください。\n\n【議事録】\n${editContent}${src ? `\n\n【原文・文字起こし】\n${src}` : ""}`,
        messages: [{ role: "user", content: input }]
      });
      const newMessages = [...prevMessages, { role: "user", content: input }, { role: "assistant", content: answer }];
      setChatMessages(newMessages);
      onUpdate({ ...project, minutes: project.minutes.map(m => m.id === selectedId ? { ...m, chatHistory: newMessages } : m) });
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch(e) { setAiError("エラー："+e.message); setAiInstruction(input); }
    setAiLoading(false);
  };

  const saveEdit = () => {
    onUpdate({ ...project, minutes: project.minutes.map(m => m.id===selectedId ? {...m,content:editContent} : m) });
    setIsEditing(false);
  };

  const extractBothFromSaved = async () => {
    if (!selectedMinute) return;
    setExtracting(true); setApproveMsg("");
    const existingFolders = project.decisionFolders || [];
    const folderList = existingFolders.map(f => f.name).join('、') || 'なし';
    try {
      const _td = new Date();
      const todayStr = `${_td.getFullYear()}年${_td.getMonth()+1}月${_td.getDate()}日（${'日月火水木金土'[_td.getDay()]}）`;
      const [rawTasks, rawDecs] = await Promise.all([
        callClaude({ max_tokens: 8000, messages: [{ role: "user", content: `今日の日付：${todayStr}\n\n以下の議事録からアクションアイテムをJSON配列で抽出してください。\n\n【期限抽出ルール】\n・「〇月〇日」「〇日まで」→ YYYY-MM-DD形式に変換\n・「来週」→ 今日から7〜13日後の該当曜日\n・「月末」→ 今月末日\n・「次回まで」「次回会議まで」→ null\n・「至急」「できるだけ早く」→ dueDate: null、priority: "high"\n・期限が明示されていない場合 → null\n\n形式: [{"title":"タスク名","assignee":"担当者名または空文字","dueDate":"YYYY-MM-DDまたはnull","priority":"high|medium|low"}]\nJSONのみ出力。\n\n${selectedMinute.content}` }] }),
        callClaude({ max_tokens: 4000, messages: [{ role: "user", content: `以下の議事録から【決定事項】の項目をJSON配列で抽出してください。各決定事項を1件ずつ配列に含めてください。\n既存フォルダ一覧: ${folderList}\n各決定事項について上記フォルダから最も適切なものを選んでください。該当しない場合はsuggestedFolderをnullにしてください。\n形式: [{"text":"決定事項の内容","suggestedFolder":"フォルダ名またはnull"}]\nJSONのみ出力。\n\n${selectedMinute.content}` }] })
      ]);
      let parsedTasks = [];
      try {
        const resolveIds = (assignee) => {
          if (!assignee) return [];
          const m = (project.members||[]).find(m => m.name===assignee || assignee.includes(m.name) || m.name.includes(assignee));
          return m ? [m.id] : [];
        };
        parsedTasks = extractJsonArray(rawTasks).map(x=>({...x, id:uid(), status:"todo", desc:"", selected:true, subtasks:[], assigneeIds: resolveIds(x.assignee), relatedDecisionIds:[], createdAt:new Date().toISOString()}));
        setDetailExtracted(parsedTasks);
      } catch {
        parsedTasks = [{id:uid(),title:"タスク抽出に失敗しました",status:"todo",dueDate:"",priority:"medium",desc:"",selected:false,subtasks:[]}];
        setDetailExtracted(parsedTasks);
      }
      try {
        const d = extractJsonArray(rawDecs);
        setDetailExtractedDecisions(d.map(x=>{
          const matchedFolder = existingFolders.find(f => f.name === x.suggestedFolder);
          const folderId = matchedFolder?.id || null;
          return { ...x, id:uid(), selected:true, folderId, newFolderName:"", _folderSel: folderId || "__none__", addAsTask:false };
        }));
      } catch {
        setDetailExtractedDecisions([{id:uid(),text:"決定事項の抽出に失敗しました",selected:false,folderId:null,newFolderName:"",_folderSel:"__none__"}]);
      }
      // サブタスク自動生成
      setSubtaskLoading(true);
      try {
        const subtaskResults = await Promise.all(
          parsedTasks.map(t => callClaude({ max_tokens: 500, messages: [{ role: "user", content: `あなたは建築・ホテル開発プロジェクトの意匠設計者です。以下のタスクを完了するために必要なサブタスクを意匠設計者の観点から3〜5個考えてください。各サブタスクは具体的なアクションとして記述してください。\n\nタスク：${t.title}\nプロジェクト：${project.name}\n\n出力形式（JSONのみ）：\n["サブタスク1", "サブタスク2", "サブタスク3"]` }] }))
        );
        setDetailExtracted(prev => prev.map((t, i) => {
          try {
            const subs = extractJsonArray(subtaskResults[i]);
            return { ...t, subtasks: subs.map(s => ({ id: uid(), title: `（AI自動生成）${s}`, done: false })) };
          } catch { return t; }
        }));
      } catch {}
      setSubtaskLoading(false);
    } catch {
      setDetailExtracted([{id:uid(),title:"タスク抽出に失敗しました",status:"todo",dueDate:"",priority:"medium",desc:"",selected:false,subtasks:[]}]);
      setDetailExtractedDecisions([{id:uid(),text:"決定事項の抽出に失敗しました",selected:false,folderId:null,newFolderName:"",_folderSel:"__none__"}]);
    }
    setLocalFolders(project.decisionFolders || []);
    setExtracting(false); setExtractMode(true);
  };

  const approveBothFromSaved = () => {
    const tasksToAdd = detailExtracted.filter(t=>t.selected).map(({selected,assignee,...t}) => ({...t}));
    const source = extractGaiyou(selectedMinute.content) || selectedMinute.title.replace(/^\d{4}\/\d{1,2}\/\d{1,2}\s*/,"");
    // localFoldersのうち既存に存在しないものを新規フォルダとして追加
    const existingFolderIds = new Set((project.decisionFolders||[]).map(f => f.id));
    const newFolders = localFolders.filter(f => !existingFolderIds.has(f.id));
    const _mdMatch = selectedMinute.content.match(/日時[　\s]*：[　\s]*(\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2})/);
    const _mdStr = _mdMatch ? (() => { const d=new Date(_mdMatch[1].replace(/[年月]/g,"/").replace(/-/g,"/")); return isNaN(d)?null:d.toISOString().slice(0,10); })() : null;
    const newDecisions = detailExtractedDecisions.filter(d=>d.selected).map(d=>{
      const folderId = (d._folderSel && d._folderSel !== "__none__" && d._folderSel !== "__new__") ? d._folderSel : null;
      return { id: d.id, text: d.text, source, createdAt: new Date().toISOString(), date: _mdStr||undefined, folderId };
    });
    const decisionTasks = detailExtractedDecisions.filter(d=>d.selected && d.addAsTask).map(d=>({
      id: uid(), title: d.text, status: "todo", dueDate: "", priority: "medium", desc: "", subtasks: [], assigneeIds: []
    }));
    const allNewTaskIds = [...tasksToAdd.map(t=>t.id), ...decisionTasks.map(t=>t.id)];
    const updatedMinutes = selectedMinute
      ? (project.minutes||[]).map(m => m.id === selectedMinute.id ? {...m, taskIds: [...(m.taskIds||[]), ...allNewTaskIds]} : m)
      : (project.minutes||[]);
    onUpdate({
      ...project,
      tasks: [...project.tasks, ...tasksToAdd, ...decisionTasks],
      decisions: [...(project.decisions||[]), ...newDecisions],
      decisionFolders: [...(project.decisionFolders||[]), ...newFolders],
      minutes: updatedMinutes,
    });
    setApproveMsg(`決定事項 ${newDecisions.length}件・タスク ${tasksToAdd.length}件を保存しました`);
    setExtractMode(false);
  };

  const deleteMinute = (id) => {
    if (deletingId===id) {
      onUpdate({...project, minutes:project.minutes.filter(m=>m.id!==id)});
      setDeletingId(null);
      if (selectedId === id) setSelectedId(null);
    } else setDeletingId(id);
  };

  const downloadPdf = (m) => {
    const PDF_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; } @page { size: A4; margin: 20mm 20mm 25mm 20mm; } body { font-family: 'Yu Gothic','游ゴシック','YuGothic','Hiragino Kaku Gothic ProN','Meiryo',sans-serif; font-size: 10pt; color: #000; padding: 20mm 20mm 25mm 20mm; line-height: 1.75; width: 210mm; min-height: 297mm; } .title { font-size: 14pt; font-weight: 700; text-align: left; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #000; letter-spacing: 0.05em; } table.meta { border-collapse: collapse; margin-bottom: 8px; font-size: 9.5pt; } .mk { font-weight: 700; padding: 1px 10px 1px 0; white-space: nowrap; vertical-align: top; } .mv { padding: 1px 0; vertical-align: top; } .div { border: none; border-top: 1px solid #aaa; margin: 8px 0; } .sh { font-size: 10.5pt; font-weight: 700; margin: 14px 0 6px; padding: 3px 0; border-bottom: 1px solid #000; } .subh { font-size: 10pt; font-weight: 700; margin: 8px 0 3px; } .ul { padding-left: 0; margin: 3px 0 6px; list-style: none; } .ul li { margin: 2px 0; font-size: 9.5pt; line-height: 1.7; padding-left: 1em; text-indent: -1em; } .ul li::before { content: "・"; } .p { font-size: 9.5pt; margin: 2px 0 5px; line-height: 1.7; } .tt { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9.5pt; } .tt th { background: #f0f0f0; border: 1px solid #999; padding: 5px 8px; text-align: left; font-weight: 700; } .tt td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; line-height: 1.6; } @media print { body { padding: 0; } .sh { break-after: avoid; } .pb { page-break-before: always; height: 0; margin: 0; } }`;
    const docTitle = `${project.name} ${m.title}`.trim();
    const win = window.open("", "_blank");
    if (!win) return;
    const body = buildMinutesBody(m.content);
    win.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(docTitle)}</title><style>${PDF_CSS}</style></head><body>${body}</body></html>`);
    win.document.close(); win.focus(); win.print();
  };

  const downloadAgendaPdf = (agendaEntry) => {
    const PDF_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; } @page { size: A4; margin: 20mm 20mm 25mm 20mm; } body { font-family: 'Yu Gothic','游ゴシック','YuGothic','Hiragino Kaku Gothic ProN','Meiryo',sans-serif; font-size: 10pt; color: #000; padding: 20mm 20mm 25mm 20mm; line-height: 1.75; width: 210mm; min-height: 297mm; } .title { font-size: 14pt; font-weight: 700; text-align: left; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #000; letter-spacing: 0.05em; } table.meta { border-collapse: collapse; margin-bottom: 8px; font-size: 9.5pt; } .mk { font-weight: 700; padding: 1px 10px 1px 0; white-space: nowrap; vertical-align: top; } .mv { padding: 1px 0; vertical-align: top; } .div { border: none; border-top: 1px solid #aaa; margin: 8px 0; } .sh { font-size: 10.5pt; font-weight: 700; margin: 14px 0 6px; padding: 3px 0; border-bottom: 1px solid #000; } .subh { font-size: 10pt; font-weight: 700; margin: 8px 0 3px; } .ul { padding-left: 0; margin: 3px 0 6px; list-style: none; } .ul li { margin: 2px 0; font-size: 9.5pt; line-height: 1.7; padding-left: 1em; text-indent: -1em; } .ul li::before { content: "・"; } .p { font-size: 9.5pt; margin: 2px 0 5px; line-height: 1.7; } @media print { body { padding: 0; } .sh { break-after: avoid; } .pb { page-break-before: always; height: 0; margin: 0; } }`;
    const win = window.open("", "_blank");
    if (!win) return;
    const body = buildAgendaBody(agendaEntry.content);
    win.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(agendaEntry.fileName)}</title><style>${PDF_CSS}</style></head><body>${body}</body></html>`);
    win.document.close(); win.focus(); win.print();
  };

  const extractTopics = (content) => {
    if (!content) return '';
    return content.split('\n').filter(l => l.includes('議題') || l.includes('■')).slice(0, 10).join('\n');
  };

  const generateAgenda = async () => {
    if (!selectedMinute) return;
    setAgendaLoading(true); setAgendaError("");
    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日（${'日月火水木金土'[today.getDay()]}）`;
      const dateStr = today.toISOString().slice(0, 10);
      const minuteTitle = extractGaiyou(selectedMinute.content) || selectedMinute.title;
      const projectTasks = project.tasks || [];
      const incompleteTasks = projectTasks
        .filter(t => t.status !== 'done')
        .map(t => {
          const assigneeNames = (t.assigneeIds || []).map(id => (project.members || []).find(m => m.id === id)?.name).filter(Boolean).join('、') || t.assignee || '';
          return `・${t.title}（担当：${assigneeNames || '未定'}、期日：${t.dueDate || '未定'}）`;
        }).join('\n') || '（なし）';
      const pastMinutesTitles = (project.minutes || [])
        .filter(m => m.id !== selectedMinute.id)
        .slice(-3)
        .map(m => `【${m.title}】\n${extractTopics(m.content)}`)
        .join('\n\n') || '（なし）';
      const minuteContent = selectedMinute.content.length > 3000
        ? selectedMinute.content.slice(0, 3000) + "\n…（以下省略）"
        : selectedMinute.content;
      const prompt = `あなたは建築・ホテル開発プロジェクトの意匠設計者です。
以下の情報から次回打合せのアジェンダを作成してください。

【プロジェクト名】
${project.name}

【今回の議事録】
${minuteContent}

【プロジェクトの未完了タスク一覧】
${incompleteTasks}

【過去の議事録の議題構成（参考）】
${pastMinutesTitles}

【アジェンダ作成ルール】
1. 今回の議事録の「決定事項」「今後のタスク」「懸念事項」を優先的に議題化
2. プロジェクトの未完了タスクのうち期日が近いものも議題に含める
3. 過去の議事録の議題構成・階層を参考に、同じプロジェクトらしい構成にする
4. 議題は具体的なアクションベースで記述する

【出力フォーマット】
次回打合せアジェンダ

名称　：{次回打合せ名}
日時　：（未定）
場所　：（未定）
出席者：{今回の出席者をそのまま引き継ぎ}
文責　：{今回の文責}　作成日：${todayStr}
フェーズ　：{現在のフェーズ}

---

■ 本日の会議目的・ゴール
・{前回からの継続課題・今回確認すべきことを記載}

---

■ 議題 1：{議題名}
確認事項：
・{確認事項1}
・{確認事項2}

■ 議題 2：{議題名}
確認事項：
・{確認事項1}
・{確認事項2}

（必要な議題数分繰り返す）

---

■ その他/備考
・{引き継ぎ事項・懸念事項}

【出力ルール】
1. 議題ヘッダーは必ず「■ 議題 N：〇〇」の形式
2. 箇条書きは「・」を使用（*や-は使用しない）
3. 担当・期日は記載しない
4. タイトル下の項目（名称・日時・場所・出席者・文責・フェーズ）は議事録の該当情報から自動引き継ぎ
5. 議事録のヘッダースタイル（■ 議題）と完全に統一する`;
      const result = await callClaude({
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });
      if (result) {
        const agendaEntry = {
          id: "a" + Date.now(),
          title: `アジェンダ_${project.name}_${dateStr}`,
          content: result,
          createdAt: dateStr,
          fileName: `アジェンダ_${project.name}_${dateStr}.pdf`,
        };
        const updatedMinutes = project.minutes.map(m => m.id === selectedMinute.id ? {...m, agendas: [...(m.agendas||[]), agendaEntry]} : m);
        onUpdate({ ...project, minutes: updatedMinutes });
        setAgendaContent(result);
        setCurrentAgenda(agendaEntry);
        setIsEditingAgenda(false);
        setShowAgendaPreview(true);
      }
    } catch(e) { setAgendaError("エラー：" + e.message); }
    setAgendaLoading(false);
  };

  return (
    <><div style={{ display:"flex", height:"calc(100dvh - 52px)", overflow:"hidden" }}>
      {/* 左カラム：議事録一覧 */}
      <div style={{ width:160, borderRight:`1.5px solid ${C.border}`, display:"flex", flexDirection:"column", background:C.surface, flexShrink:0 }}>
        <div style={{ padding:"14px 16px 12px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, minWidth:0 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:project.color, flexShrink:0 }} />
            <span style={{ fontSize:13, fontWeight:800, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{project.name}</span>
          </div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>{minutes.length}件の議事録</div>
          <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            placeholder="🔍 議事録を検索..."
            style={{ width:"100%", border:`1.5px solid ${searchQuery?C.sage:C.border}`, borderRadius:10, padding:"7px 11px", fontSize:12, background:C.bg, color:C.text, outline:"none", boxSizing:"border-box" }} />
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"8px 10px" }}>
          {(() => {
            const q = searchQuery.trim().toLowerCase();
            const filtered = q
              ? minutes.filter(m => (m.content||"").toLowerCase().includes(q) || (m.title||"").toLowerCase().includes(q))
              : minutes;
            if (minutes.length===0) return (
              <div style={{ textAlign:"center", padding:"40px 12px", color:C.muted, fontSize:12 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📝</div>
                議事録がまだ保存されていません
              </div>
            );
            if (q && filtered.length===0) return (
              <div style={{ textAlign:"center", padding:"24px 12px", color:C.muted, fontSize:12 }}>ヒットなし</div>
            );
            return filtered.map(m => {
              const gaiyou = extractGaiyou(m.content);
              const dateStr = (() => {
                const d = extractMeetingDate(m.content);
                return d ? d.toLocaleDateString("ja-JP") : new Date(m.createdAt).toLocaleDateString("ja-JP");
              })();
              const isSel = selectedId === m.id;
              const titleText = gaiyou || m.title.replace(/^\d{4}\/\d{1,2}\/\d{1,2}\s*/,"");
              const snippet = (() => {
                if (!q) return null;
                const idx = (m.content||"").toLowerCase().indexOf(q);
                return idx>=0 ? (m.content||"").slice(Math.max(0,idx-15),idx+70).replace(/\n+/g," ") : null;
              })();
              return (
                <div key={m.id} onClick={() => { setSelectedId(m.id); setIsEditing(false); setAiEditOpen(false); setDeletingId(null); setExtractMode(false); setApproveMsg(""); setAgendaError(""); }}
                  style={{ padding:"10px 11px", borderRadius:10, marginBottom:5, cursor:"pointer", background:isSel?C.accentLight:"transparent", border:`1.5px solid ${isSel?C.accent:C.border}` }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>{dateStr}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text, lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                    dangerouslySetInnerHTML={{ __html: highlightInHtml(titleText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'), q) }} />
                  {snippet && (
                    <div style={{ fontSize:11, color:C.muted, lineHeight:1.5, marginTop:4 }}
                      dangerouslySetInnerHTML={{ __html: "…" + highlightInHtml(snippet.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'), q) + "…" }} />
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* 右カラム：プレビュー／編集 */}
      <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", boxSizing:"border-box", background:C.bg }}>
        {selectedMinute ? (
          <div style={{ padding:"28px 16px", maxWidth:"100%", boxSizing:"border-box" }}>
            <style dangerouslySetInnerHTML={{ __html: PREVIEW_CSS }} />
            <div style={{ display:"flex", flexWrap:"wrap", gap:16, width:"100%", maxWidth:"100%", boxSizing:"border-box", overflow:"hidden", alignItems:"flex-start", justifyContent:hasAgenda?"flex-start":"center" }}>
              {/* 左：議事録エリア */}
              <div style={{ flex:"1 1 320px", minWidth:0, overflow:"hidden" }}>
                {/* ボタン行 */}
                <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", marginBottom:12, flexWrap:"nowrap", gap:8 }}>
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} disabled={!!diffResult} style={{...BTN.primary, opacity:diffResult?0.5:1, cursor:diffResult?"default":"pointer"}}>💾 保存</button>
                      {!diffResult && <button onClick={()=>{ setAiEditOpen(v=>!v); setAiInstruction(""); setAiError(""); }}
                        style={{ background:aiEditOpen?C.accent:C.accentLight, color:aiEditOpen?"#fff":C.accent, border:`1.5px solid ${C.accent}`, borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" }}>✨ AI編集</button>}
                      {!diffResult && <button onClick={() => {
                        const el = detailTextareaRef.current;
                        if (!el) return;
                        const s = el.selectionStart, e2 = el.selectionEnd;
                        const marker = "\n[改ページ]\n";
                        const next = editContent.slice(0, s) + marker + editContent.slice(e2);
                        setEditContent(next);
                        setTimeout(() => { el.selectionStart = el.selectionEnd = s + marker.length; el.focus(); }, 0);
                      }} style={BTN.ghost}>✂ 改ページ</button>}
                      <button onClick={()=>{ setIsEditing(false); setAiEditOpen(false); setDiffResult(null); }} style={BTN.ghost}>キャンセル</button>
                    </>
                  ) : extractMode ? (
                    <button onClick={()=>setExtractMode(false)} style={BTN.ghost}>← プレビューに戻る</button>
                  ) : (
                    <>
                      <button onClick={()=>{ setIsEditing(true); setEditContent(selectedMinute.content); setAiEditOpen(false); }}
                        onMouseEnter={()=>setHoveredBtn('edit')} onMouseLeave={()=>setHoveredBtn(null)}
                        style={{ background:hoveredBtn==='edit'?C.hover:"transparent", border:"1.5px solid #9E9E9E", color:"#616161", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>✏️ 編集</button>
                      <button onClick={extractBothFromSaved} disabled={extracting}
                        onMouseEnter={()=>setHoveredBtn('extract')} onMouseLeave={()=>setHoveredBtn(null)}
                        style={{ background:extracting?"#3D8579":hoveredBtn==='extract'?"#3D8579":"#4A9B8E", border:"none", color:"#fff", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:extracting?"default":"pointer", opacity:extracting?0.7:1 }}>
                        {extracting?"⏳ 抽出中...":"📋 決定事項・タスク抽出"}
                      </button>
                      <button onClick={generateAgenda} disabled={agendaLoading}
                        onMouseEnter={()=>setHoveredBtn('agenda')} onMouseLeave={()=>setHoveredBtn(null)}
                        style={{ background:agendaLoading?"#3D8579":hoveredBtn==='agenda'?"#3D8579":"#4A9B8E", border:"none", color:"#fff", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:agendaLoading?"default":"pointer", opacity:agendaLoading?0.7:1 }}>
                        {agendaLoading?"⏳ 生成中...":"📋 次回アジェンダ作成"}
                      </button>
                      <button onClick={()=>downloadPdf(selectedMinute)}
                        onMouseEnter={()=>setHoveredBtn('pdf')} onMouseLeave={()=>setHoveredBtn(null)}
                        style={{ ...BTN.pdf, background:hoveredBtn==='pdf'?"#C62828":"#E8412A", transition:"all 0.15s" }}>PDF</button>
                      <button onClick={()=>setConfirmDelete(true)}
                        onMouseEnter={()=>setHoveredBtn('delete')} onMouseLeave={()=>setHoveredBtn(null)}
                        style={{ background:hoveredBtn==='delete'?"#FFEBEE":"transparent", border:"1.5px solid #E53935", color:"#E53935", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
                        🗑 削除
                      </button>
                      <ConfirmDialog open={confirmDelete} title="議事録の削除"
                        message={`「${selectedMinute?.title||"この議事録"}」を削除しますか？この操作は取り消せません。`}
                        onConfirm={()=>{ onUpdate({...project, minutes:project.minutes.filter(m=>m.id!==selectedMinute.id)}); setSelectedId(null); setConfirmDelete(false); }}
                        onCancel={()=>setConfirmDelete(false)} />
                      {currentAgenda === null && (selectedMinute?.agendas||[]).length > 0 && (
                        <button onClick={()=>{ const latest = selectedMinute.agendas[selectedMinute.agendas.length-1]; setCurrentAgenda(latest); setAgendaContent(latest.content||''); }}
                          style={{ background:"transparent", border:`1.5px solid ${C.border}`, color:C.text, borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                          アジェンダを表示
                        </button>
                      )}
                    </>
                  )}
                </div>
                {aiEditOpen && isEditing && (
                  <div style={{ marginBottom:16, background:C.accentLight, border:`1.5px solid ${C.accent}`, borderRadius:12, padding:16 }}>
                    {(chatMessages.length > 0 || aiLoading) && (
                      <div style={{ maxHeight:200, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
                        {chatMessages.length === 0 && !aiLoading && null}
                        {chatMessages.map((msg, i) => (
                          <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start" }}>
                            <div style={{ maxWidth:"85%", padding:"8px 12px", borderRadius:msg.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",
                              background:msg.role==="user"?C.accent:"#fff", color:msg.role==="user"?"#fff":C.text,
                              fontSize:12, lineHeight:1.6, border:msg.role==="assistant"?`1px solid ${C.border}`:"none", whiteSpace:"pre-wrap" }}>
                              {msg.content}
                            </div>
                          </div>
                        ))}
                        {aiLoading && (
                          <div style={{ display:"flex", justifyContent:"flex-start" }}>
                            <div style={{ padding:"8px 14px", borderRadius:"12px 12px 12px 4px", background:"#fff", border:`1px solid ${C.border}`, fontSize:12, color:C.muted }}>考え中...</div>
                          </div>
                        )}
                        <div ref={chatBottomRef} />
                      </div>
                    )}
                    <div style={{ fontSize:11, color:C.accent, marginBottom:6, fontWeight:700 }}>✨ AI編集</div>
                    <textarea value={aiInstruction} onChange={e=>setAiInstruction(e.target.value)} rows={3}
                      placeholder="質問や編集指示を記入してください。"
                      style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 11px", fontSize:12, background:"#fff", color:C.text, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
                    {aiError && <div style={{ fontSize:12, color:C.accent, marginTop:6 }}>{aiError}</div>}
                    {!selectedMinute?.sourceText && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>※ 原文が保存されていないため議事録のみを参照します</div>}
                    <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"space-between", alignItems:"center" }}>
                      <button onClick={()=>{setAiEditOpen(false);setAiInstruction("");setAiError("");}} style={BTN.ghost}>閉じる</button>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={runAiChat} disabled={aiLoading||!aiInstruction.trim()} style={{ ...BTN.ghost, opacity:aiLoading||!aiInstruction.trim()?0.5:1, cursor:aiLoading||!aiInstruction.trim()?"default":"pointer" }}>{aiLoading?"処理中...":"💬 質問する"}</button>
                        <button onClick={runAiEdit} disabled={aiLoading||!aiInstruction.trim()} style={{ ...BTN.primary, opacity:aiLoading||!aiInstruction.trim()?0.5:1, cursor:aiLoading||!aiInstruction.trim()?"default":"pointer" }}>{aiLoading?"処理中...":"✨ 編集する"}</button>
                      </div>
                    </div>
                  </div>
                )}
            {extractMode ? (
              <div style={{ background:C.surface, borderRadius:16, padding:24, border:`1.5px solid ${C.border}` }}>
                {approveMsg && <div style={{ background:C.sageLight, border:`1.5px solid ${C.sage}`, borderRadius:10, padding:"10px 14px", fontSize:12, color:C.sage, fontWeight:700, marginBottom:16 }}>✓ {approveMsg}</div>}
                {/* 決定事項 */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:C.decision }}>📋 決定事項</span>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>setDetailExtractedDecisions(ds=>ds.map(d=>({...d,selected:true})))} style={btn({fontSize:11,color:C.sage,background:"transparent"})}>全選択</button>
                      <button onClick={()=>setDetailExtractedDecisions(ds=>ds.map(d=>({...d,selected:false})))} style={btn({fontSize:11,color:C.muted,background:"transparent"})}>全解除</button>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {detailExtractedDecisions.map(d=>(
                      <div key={d.id} style={{ background:d.selected?C.decisionLight:C.bg, border:`1.5px solid ${d.selected?C.decision:C.border}`, borderRadius:10, overflow:"hidden" }}>
                        <div onClick={()=>{ if(detailEditingDecId!==d.id) setDetailExtractedDecisions(ds=>ds.map(x=>x.id===d.id?{...x,selected:!x.selected}:x)); }}
                          style={{ padding:"10px 14px", cursor:"pointer", display:"flex", alignItems:"flex-start", gap:10 }}>
                          <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${d.selected?C.decision:C.border}`, background:d.selected?C.decision:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
                            {d.selected&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
                          </div>
                          {detailEditingDecId===d.id ? (
                            <textarea value={detailEditingDecText} onChange={e=>setDetailEditingDecText(e.target.value)} rows={2} onClick={e=>e.stopPropagation()}
                              style={{ flex:1, border:`1.5px solid #5B7EC9`, borderRadius:7, padding:"5px 8px", fontSize:12, background:"#fff", color:C.text, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }} />
                          ) : (
                            <span style={{ flex:1, fontSize:12, color:C.text, lineHeight:1.6 }}>{d.text}</span>
                          )}
                          <div onClick={e=>e.stopPropagation()} style={{ display:"flex", gap:4, flexShrink:0 }}>
                            {detailEditingDecId===d.id ? (
                              <>
                                <button onClick={()=>{ setDetailExtractedDecisions(ds=>ds.map(x=>x.id===d.id?{...x,text:detailEditingDecText}:x)); setDetailEditingDecId(null); }}
                                  style={btn({padding:"3px 8px",borderRadius:6,background:C.decision,color:"#fff",fontSize:11,fontWeight:700})}>保存</button>
                                <button onClick={()=>setDetailEditingDecId(null)}
                                  style={btn({padding:"3px 7px",borderRadius:6,background:"transparent",color:C.muted,fontSize:11,border:`1px solid ${C.border}`})}>取消</button>
                              </>
                            ) : (
                              <button aria-label="決定事項を編集" onClick={()=>{ setDetailEditingDecId(d.id); setDetailEditingDecText(d.text); }}
                                style={btn({padding:"3px 7px",borderRadius:6,background:"transparent",color:C.muted,fontSize:11})}>✏️</button>
                            )}
                          </div>
                        </div>
                        <div onClick={e=>e.stopPropagation()} style={{ padding:"0 14px 10px 42px", display:"flex", flexDirection:"column", gap:4 }}>
                          <button onClick={()=>setDetailExtractedDecisions(ds=>ds.map(x=>x.id===d.id?{...x,addAsTask:!x.addAsTask}:x))}
                            style={btn({padding:"3px 9px",borderRadius:6,background:d.addAsTask?C.sage:"transparent",color:d.addAsTask?"#fff":C.muted,fontSize:11,fontWeight:700,border:`1px solid ${d.addAsTask?C.sage:C.border}`,alignSelf:"flex-start"})}>✅ タスクとしても追加</button>
                          <select value={d._folderSel||"__none__"} onChange={e=>setDetailExtractedDecisions(ds=>ds.map(x=>x.id===d.id?{...x,_folderSel:e.target.value,newFolderName:""}:x))}
                            style={{ border:`1px solid ${C.border}`, borderRadius:6, padding:"3px 8px", fontSize:11, background:C.surface, color:C.text, outline:"none" }}>
                            <option value="__none__">📁 フォルダなし</option>
                            {localFolders.map(f=><option key={f.id} value={f.id}>📁 {f.name}</option>)}
                            <option value="__new__">＋ 新規フォルダ作成</option>
                          </select>
                          {d._folderSel==="__new__" && (
                            <div style={{ display:"flex", gap:4 }}>
                              <input value={d.newFolderName||""} onChange={e=>setDetailExtractedDecisions(ds=>ds.map(x=>x.id===d.id?{...x,newFolderName:e.target.value}:x))}
                                placeholder="新規フォルダ名を入力..."
                                onKeyDown={e=>{ if(e.key==="Enter"){ const name=(d.newFolderName||"").trim(); if(!name)return; const ex=localFolders.find(f=>f.name===name); const fid=ex?ex.id:uid(); if(!ex)setLocalFolders(prev=>[...prev,{id:fid,name,parentId:null}]); setDetailExtractedDecisions(ds=>ds.map(x=>x.id===d.id?{...x,_folderSel:fid,newFolderName:""}:x)); }}}
                                style={{ flex:1, border:`1px solid #5B7EC9`, borderRadius:6, padding:"3px 8px", fontSize:11, background:"#fff", color:C.text, outline:"none" }} />
                              <button onClick={()=>{ const name=(d.newFolderName||"").trim(); if(!name)return; const ex=localFolders.find(f=>f.name===name); const fid=ex?ex.id:uid(); if(!ex)setLocalFolders(prev=>[...prev,{id:fid,name,parentId:null}]); setDetailExtractedDecisions(ds=>ds.map(x=>x.id===d.id?{...x,_folderSel:fid,newFolderName:""}:x)); }}
                                style={btn({padding:"3px 10px",borderRadius:6,background:C.decision,color:"#fff",fontSize:11,fontWeight:700})}>作成</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* タスク */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:C.sage }}>✅ タスク</span>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>setDetailExtracted(ts=>ts.map(t=>({...t,selected:true})))} style={btn({fontSize:11,color:C.sage,background:"transparent"})}>全選択</button>
                      <button onClick={()=>setDetailExtracted(ts=>ts.map(t=>({...t,selected:false})))} style={btn({fontSize:11,color:C.muted,background:"transparent"})}>全解除</button>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {detailExtracted.map(t=>(
                      <div key={t.id} style={{ background:t.selected?C.sageLight:C.bg, border:`1.5px solid ${t.selected?C.sage:C.border}`, borderRadius:10, overflow:"hidden" }}>
                        <div onClick={()=>setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,selected:!x.selected}:x))}
                          style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", cursor:"pointer" }}>
                          <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${t.selected?C.sage:C.border}`, background:t.selected?C.sage:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {t.selected&&<span style={{color:"#fff",fontSize:11,fontWeight:900}}>✓</span>}
                          </div>
                          <span style={{ flex:1, fontSize:12, fontWeight:700, color:C.text }}>{t.title||"（タイトル未入力）"}</span>
                          <PriorityDot p={t.priority} />
                          <button aria-label="タスクを編集" onClick={e=>{e.stopPropagation();setEditingTaskId(t.id);}}
                            style={btn({padding:"2px 6px",borderRadius:5,background:"transparent",color:C.muted,fontSize:12})}>✏️</button>
                        </div>
                        {editingTaskId===t.id ? (
                          <div onClick={e=>e.stopPropagation()} style={{ padding:"0 12px 10px 40px", display:"flex", gap:6, flexWrap:"wrap" }}>
                            <input autoFocus value={t.title} onChange={e=>setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,title:e.target.value}:x))} placeholder="タスク名"
                              onKeyDown={e=>{if(e.key==="Enter")setEditingTaskId(null);}}
                              style={{ flex:"2 1 140px", minWidth:0, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }} />
                            <div style={{ display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
                              {(project.members||[]).length === 0 ? (
                                <input value={t.assignee||""} onChange={e=>setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,assignee:e.target.value}:x))} placeholder="👤 担当者"
                                  onKeyDown={e=>{if(e.key==="Enter")setEditingTaskId(null);}}
                                  style={{ flex:1, minWidth:0, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }} />
                              ) : (project.members||[]).map(m => {
                                const sel = (t.assigneeIds||[]).includes(m.id);
                                return <button key={m.id} type="button" onClick={()=>setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,assigneeIds:sel?(x.assigneeIds||[]).filter(id=>id!==m.id):[...(x.assigneeIds||[]),m.id]}:x))}
                                  style={{ padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:700, background:sel?C.sage:"transparent", color:sel?"#fff":C.muted, border:`1.5px solid ${sel?C.sage:C.border}`, cursor:"pointer", whiteSpace:"nowrap" }}>
                                  {sel?"✓ ":""}{m.name}
                                </button>;
                              })}
                            </div>
                            <input type="date" value={t.dueDate||""} onChange={e=>setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,dueDate:e.target.value}:x))}
                              style={{ flex:"1 1 110px", minWidth:0, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }} />
                            <select value={t.priority} onChange={e=>setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,priority:e.target.value}:x))}
                              style={{ flex:"1 1 60px", minWidth:0, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }}>
                              <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
                            </select>
                            <button onClick={()=>setEditingTaskId(null)}
                              style={btn({padding:"4px 10px",borderRadius:6,background:C.sage,color:"#fff",fontSize:11,fontWeight:700})}>完了</button>
                          </div>
                        ) : (
                          <div style={{ padding:"0 12px 8px 40px", display:"flex", gap:8, flexWrap:"wrap" }}>
                            {t.assignee && <span style={{ fontSize:11, color:C.muted }}>👤 {t.assignee}</span>}
                            {t.dueDate && <span style={{ fontSize:11, color:C.muted }}>📅 {t.dueDate}</span>}
                            <span style={{ fontSize:11, color:t.priority==="high"?"#E53935":t.priority==="low"?"#78909C":C.muted }}>
                              {t.priority==="high"?"🔴 高":t.priority==="low"?"🟢 低":"🟡 中"}
                            </span>
                          </div>
                        )}
                        <div onClick={e=>e.stopPropagation()} style={{ padding:"0 12px 10px 40px" }}>
                          {subtaskLoading ? (
                            <div style={{ fontSize:11, color:C.muted, padding:"4px 0" }}>⏳ サブタスク生成中...</div>
                          ) : (
                            <>
                              {(t.subtasks||[]).length > 0 && (
                                <div style={{ display:"flex", flexDirection:"column", gap:3, marginBottom:5 }}>
                                  {(t.subtasks||[]).map(s=>(
                                    <div key={s.id} style={{ display:"flex", alignItems:"center", gap:6, background:C.bg, borderRadius:6, padding:"3px 8px" }}>
                                      {editingSubtaskId===s.id ? (
                                        <input autoFocus value={s.title}
                                          data-subtask-id={s.id}
                                          onChange={e=>setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,subtasks:(x.subtasks||[]).map(ss=>ss.id===s.id?{...ss,title:e.target.value}:ss)}:x))}
                                          onKeyDown={e=>{
                                            if(e.key==="Escape"){setEditingSubtaskId(null);return;}
                                            if(e.key==="Enter"){
                                              e.preventDefault();
                                              const subs=t.subtasks||[];
                                              const idx=subs.findIndex(st=>st.id===s.id);
                                              const next=subs[idx+1];
                                              subtaskMoveRef.current=true;
                                              if(next){
                                                setEditingSubtaskId(next.id);
                                                setTimeout(()=>{
                                                  document.querySelector(`[data-subtask-id="${next.id}"]`)?.focus();
                                                  subtaskMoveRef.current=false;
                                                },0);
                                              } else {
                                                const nid=uid();
                                                setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,subtasks:[...(x.subtasks||[]),{id:nid,title:"",done:false}]}:x));
                                                setTimeout(()=>{
                                                  setEditingSubtaskId(nid);
                                                  subtaskMoveRef.current=false;
                                                },50);
                                              }
                                            }
                                          }}
                                          onBlur={()=>{if(!subtaskMoveRef.current)setEditingSubtaskId(null);}}
                                          style={{ flex:1, fontSize:11, border:`1px solid ${C.border}`, borderRadius:4, padding:"2px 6px", background:"#fff", color:C.text, outline:"none" }} />
                                      ) : (
                                        <span onClick={()=>setEditingSubtaskId(s.id)} style={{ flex:1, fontSize:11, color:C.text, cursor:"text" }}>{s.title||"（未入力）"}</span>
                                      )}
                                      {editingSubtaskId!==s.id && (
                                        <button aria-label="サブタスクを編集" onClick={()=>setEditingSubtaskId(s.id)}
                                          style={btn({padding:"1px 4px",borderRadius:4,fontSize:10,color:C.muted,background:"transparent"})}>✏️</button>
                                      )}
                                      <button aria-label="サブタスクを削除" onClick={()=>setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,subtasks:(x.subtasks||[]).filter(ss=>ss.id!==s.id)}:x))}
                                        style={btn({padding:"1px 6px",borderRadius:4,fontSize:10,color:C.muted,background:"transparent"})}>×</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button onClick={()=>{const nid=uid();setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,subtasks:[...(x.subtasks||[]),{id:nid,title:"",done:false}]}:x));setEditingSubtaskId(nid);}}
                                style={btn({padding:"2px 8px",borderRadius:6,fontSize:11,color:C.sage,background:"transparent",border:`1px dashed ${C.sage}`})}>
                                ＋ サブタスクを追加
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                  <span style={{ fontSize:12, color:C.muted }}>
                    決定事項 {detailExtractedDecisions.filter(d=>d.selected).length}/{detailExtractedDecisions.length}件　タスク {detailExtracted.filter(t=>t.selected).length}/{detailExtracted.length}件
                  </span>
                  <button onClick={approveBothFromSaved} style={{...BTN.primaryLg}}>
                    ✅ 承認して保存
                  </button>
                </div>
              </div>
            ) : isEditing ? (
              diffResult ? (
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:C.text }}>AI修正の差分プレビュー</span>
                    <span style={{ fontSize:11, color:"#D32F2F", background:"#FFEBEE", borderRadius:4, padding:"2px 7px", fontWeight:600 }}>― 削除</span>
                    <span style={{ fontSize:11, color:"#2E7D32", background:"#E8F5E9", borderRadius:4, padding:"2px 7px", fontWeight:600 }}>＋ 追加</span>
                    <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
                      <button onClick={()=>setDiffResult(null)} style={BTN.ghost}>破棄</button>
                      <button onClick={()=>{ setEditContent(diffResult.revised); setDiffResult(null); }} style={BTN.primary}>適用する</button>
                    </div>
                  </div>
                  <div style={{ border:`1.5px solid ${C.border}`, borderRadius:10, overflow:"auto", maxHeight:600, fontFamily:"'Courier New',monospace", fontSize:12, lineHeight:1.8 }}>
                    {diffResult.lines.map((line, idx) => (
                      <div key={idx} style={{
                        padding:"1px 14px",
                        background: line.type==="add" ? "#E8F5E9" : line.type==="remove" ? "#FFEBEE" : "transparent",
                        color: line.type==="add" ? "#2E7D32" : line.type==="remove" ? "#C62828" : C.text,
                        whiteSpace:"pre-wrap", wordBreak:"break-all",
                      }}>
                        {line.type==="add" ? "＋ " : line.type==="remove" ? "― " : "　 "}{line.text || "\u00A0"}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <textarea ref={detailTextareaRef} value={editContent} onChange={e=>setEditContent(e.target.value)} rows={30}
                  style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10, padding:"12px 14px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box", resize:"vertical", lineHeight:1.8, fontFamily:"'Courier New',monospace" }} />
              )
            ) : (<>
              <div className="mins-preview" style={{ background:"#fff", borderRadius:12, padding:"28px 32px", border:`1px solid ${C.border}`, wordBreak:"break-word", overflowWrap:"break-word", overflow:"hidden" }}
                dangerouslySetInnerHTML={{ __html: highlightInHtml(buildMinutesBody(selectedMinute.content), searchQuery.trim()) }} />
              {(selectedMinute.taskIds||[]).length > 0 && (() => {
                const linkedTasks = (project.tasks||[]).filter(t => (selectedMinute.taskIds||[]).includes(t.id));
                if (linkedTasks.length === 0) return null;
                return (
                  <div style={{ marginTop:16, background:"#fff", borderRadius:12, padding:"20px 28px", border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:13, fontWeight:800, color:C.text, marginBottom:12, borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>■ タスク一覧</div>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                      <thead>
                        <tr style={{ background:C.bg }}>
                          <th style={{ padding:"6px 10px", textAlign:"left", fontWeight:700, color:C.muted, borderBottom:`1px solid ${C.border}` }}>タスク</th>
                          <th style={{ padding:"6px 10px", textAlign:"left", fontWeight:700, color:C.muted, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>担当者</th>
                          <th style={{ padding:"6px 10px", textAlign:"left", fontWeight:700, color:C.muted, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>期日</th>
                          <th style={{ padding:"6px 10px", textAlign:"left", fontWeight:700, color:C.muted, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>状態</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedTasks.map(t => {
                          const names = (t.assigneeIds||[]).map(id=>(project.members||[]).find(m=>m.id===id)?.name).filter(Boolean).join("・");
                          const statusLabel = t.status==="done"?"✅ 完了":t.status==="doing"?"🔄 進行中":"⬜ 未着手";
                          return (
                            <tr key={t.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                              <td style={{ padding:"7px 10px", color:C.text, textDecoration:t.status==="done"?"line-through":"none" }}>{t.title}</td>
                              <td style={{ padding:"7px 10px", color:C.muted, whiteSpace:"nowrap" }}>{names||"—"}</td>
                              <td style={{ padding:"7px 10px", color:C.muted, whiteSpace:"nowrap" }}>{t.dueDate||"—"}</td>
                              <td style={{ padding:"7px 10px", whiteSpace:"nowrap" }}>{statusLabel}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>)}
              </div>
              {/* 右：アジェンダプレビュー */}
              {hasAgenda && (
                <div style={{ flex:"1 1 320px", minWidth:0, overflow:"hidden", borderLeft:`1.5px solid ${C.border}`, paddingLeft:16 }}>
                  <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", marginBottom:12, gap:8 }}>
                    {isEditingAgenda ? (<>
                      <button onClick={()=>{ setAgendaContent(currentAgenda.content||''); setIsEditingAgenda(false); }} style={BTN.ghost}>キャンセル</button>
                      <button onClick={()=>{
                        const updated = { ...currentAgenda, content: agendaContent };
                        setCurrentAgenda(updated);
                        const updatedMinutes = project.minutes.map(m => m.id === selectedMinute.id ? {...m, agendas: (m.agendas||[]).map(a => a.id === updated.id ? updated : a)} : m);
                        onUpdate({ ...project, minutes: updatedMinutes });
                        setIsEditingAgenda(false);
                      }} style={BTN.primary}>💾 保存</button>
                    </>) : (
                      <button onClick={()=>setIsEditingAgenda(true)} style={BTN.ghost}>✏️ 編集</button>
                    )}
                    <button onClick={()=>downloadAgendaPdf(currentAgenda)}
                      onMouseEnter={()=>setHoveredBtn('agendaPdf')} onMouseLeave={()=>setHoveredBtn(null)}
                      style={{ ...BTN.pdf, background:hoveredBtn==='agendaPdf'?"#C62828":"#E8412A", transition:"all 0.15s" }}>PDF</button>
                    <button onClick={()=>setCurrentAgenda(null)}
                      style={btn({padding:"6px 12px",borderRadius:6,fontSize:12,color:C.muted,background:"transparent",border:`1.5px solid ${C.border}`})}>非表示</button>
                    <button onClick={()=>setConfirmDeleteAgenda(true)}
                      onMouseEnter={()=>setHoveredBtn('agendaDelete')} onMouseLeave={()=>setHoveredBtn(null)}
                      style={{ background:hoveredBtn==='agendaDelete'?"#FFEBEE":"transparent", border:"1.5px solid #E53935", color:"#E53935", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>🗑 削除</button>
                  </div>
                  {isEditingAgenda ? (
                    <textarea value={agendaContent} onChange={e=>setAgendaContent(e.target.value)} rows={30}
                      style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10, padding:"12px 14px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box", resize:"vertical", lineHeight:1.8, fontFamily:"'Courier New',monospace" }} />
                  ) : (
                    <div className="mins-preview" style={{ background:"#fff", borderRadius:12, padding:"24px 28px", border:`1px solid ${C.border}`, wordBreak:"break-word", overflowWrap:"break-word", overflow:"hidden" }}
                      dangerouslySetInnerHTML={{ __html: highlightInHtml(buildAgendaBody(agendaContent), '') }} />
                  )}
                </div>
              )}
            </div>
            {agendaError && (
              <div style={{ marginTop:12, background:"#FFF0F0", border:"1.5px solid #E07070", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#C0392B" }}>
                {agendaError}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:C.muted }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
              <div style={{ fontSize:14, fontWeight:700 }}>左の一覧から議事録を選択してください</div>
              {minutes.length===0 && <div style={{ fontSize:12, marginTop:8, lineHeight:1.8 }}>まだ議事録が保存されていません。<br/>「✨ 議事録」タブから作成できます。</div>}
            </div>
          </div>
        )}
      </div>
    </div>
    {confirmDeleteAgenda && (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
        <div style={{ background:"#fff", borderRadius:16, padding:28, width:340, boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
          <div style={{ fontSize:15, fontWeight:800, color:"#222", marginBottom:8 }}>アジェンダを削除しますか？</div>
          <div style={{ fontSize:13, color:"#888", marginBottom:20, lineHeight:1.6 }}>この操作は取り消せません。</div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={()=>setConfirmDeleteAgenda(false)} style={{ padding:"7px 16px", borderRadius:8, border:"1.5px solid #ddd", background:"transparent", fontSize:13, cursor:"pointer" }}>キャンセル</button>
            <button onClick={()=>{
              const updatedAgendas = (selectedMinute.agendas||[]).filter(a=>a.id!==currentAgenda.id);
              const updatedMinutes = project.minutes.map(m=>m.id===selectedMinute.id?{...m,agendas:updatedAgendas}:m);
              onUpdate({...project, minutes:updatedMinutes});
              setCurrentAgenda(null);
              setAgendaContent('');
              setConfirmDeleteAgenda(false);
            }} style={{ padding:"7px 16px", borderRadius:8, background:"#E53935", color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer" }}>削除する</button>
          </div>
        </div>
      </div>
    )}
  </>);
}


export { MinutesDetailPage };
