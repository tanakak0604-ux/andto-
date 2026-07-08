import React, { useState, useRef, useEffect } from "react";
import { PriorityDot, ProgressPanel } from "./common";
import { BTN, C, PHASE_LABELS, btn } from "../constants";
import { audioBufferToWavBlob, extractAudioChunk } from "../lib/audio";
import { callClaude, callClaudePartial, transcribeLongAudio, uploadAudioToGemini, uploadWavChunkToGemini, waitGeminiFileActive } from "../lib/gemini";
import { buildMinutesBody } from "../lib/print";
import { cleanTranscriptChunk, escapeHtml, extractJsonArray, removeLoopedLines, uid } from "../lib/text";
import { SYSTEM_PROMPT, TEMPLATE } from "../prompts";

const STEPS = ["input","minutes","tasks","save"];
const STEP_LABELS = ["① 入力","② 議事録確認","③ 決定事項・タスク承認","④ 保存"];
const STEPS_WITH_TRANSCRIPT = ["input","transcript","minutes","tasks","save"];
const STEP_LABELS_WITH_TRANSCRIPT = ["① 入力","② 文字起こし確認","③ 議事録確認","④ 決定事項・タスク承認","⑤ 保存"];

const TRANSCRIPTION_SYSTEM_PROMPT = `あなたは建築・ホテル開発プロジェクトの音声文字起こし専門家です。以下のルールで音声を正確に文字起こしてください。

【最重要ルール】
- 音声の最初から最後まで、飛ばさず全て文字起こしすること
- 同じ発言・同じ行を絶対に繰り返さないこと。繰り返しが始まりそうになったら即座に文字起こしを終了すること
- 実際に音声に存在しない内容を作り出さないこと
- タイムスタンプは必ず単調増加すること。前の行より小さい値は絶対に使わないこと

【文字起こしルール】
1. 発言内容を逐語的に書き起こす（要約・省略は禁止）
2. 話者を識別し「[MM:SS] 話者名：発言内容」の形式で1行ずつ記載する
   - 参加者情報から話者を推定する
   - 判明しない場合は「話者A：」「話者B：」などでラベリング（「話者不明」は使わない）
3. 聞き取れない箇所は「（聞き取り不明）」と記載
4. 相槌・フィラー（「えー」「あの」「うん」「えっと」「まあ」「なんか」「そう」「ちょっと」等）・2文字以下の短い発声・単純な繰り返しは省略する
5. 発言の区切りは改行で表現

【建築・設計の専門用語（正しい表記）】
確認申請・建築確認・消防申請・開発許可・完了検査
平面図・立面図・断面図・矩計図・詳細図・施工図・竣工図
意匠設計・外装・内装・仕上げ材・マテリアル・サイン
構造設計・設備設計・MEP・躯体・鉄骨・RC造・SRC造
施工者・ゼネコン・サブコン・工程表・工期・現場監理
FF&E（家具・備品・什器）・OS&E・プログラム・ゾーニング・動線・スキーム`;

function detectCurrentPhase(proj) {
  if (!proj) return "";
  const pd = proj.phaseDates || {};
  const today = new Date(); today.setHours(0,0,0,0);
  const valid = PHASE_LABELS.filter(p => pd[p]);
  if (valid.length > 0) {
    for (let i = 0; i < valid.length; i++) {
      const start = new Date(pd[valid[i]]);
      const end = valid[i+1] ? new Date(pd[valid[i+1]]) : new Date("9999-12-31");
      if (today >= start && today < end) return valid[i];
    }
  }
  return proj.phase || "";
}

function MinutesPage({ projects, onUpdateProject }) {
  const [selProj, setSelProj] = useState(projects[0]?.id||"");
  const [text, setText] = useState("");
  const [templateModal, setTemplateModal] = useState(null); // null | { idx, name, attendees, bunseki }
  const [selectedTplIdx, setSelectedTplIdx] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [minutes, setMinutes] = useState("");
  const [minutesTitle, setMinutesTitle] = useState("");
  const [extracted, setExtracted] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("input");
  const [saveMsg, setSaveMsg] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [bunseki, setBunseki] = useState("");
  const [teishutsushiryo, setTeishutsushiryo] = useState("");
  const [juryoshiryo, setJuryoshiryo] = useState("");
  const [phase, setPhase] = useState(() => detectCurrentPhase(projects.find(p => p.id === (projects[0]?.id||""))));
  const [phaseCustom, setPhaseCustom] = useState("");
  const [gaiyou, setGaiyou] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [extractedDecisions, setExtractedDecisions] = useState([]);
  const [savedType, setSavedType] = useState("tasks");
  const [newMemberCandidates, setNewMemberCandidates] = useState([]);
  const [showMemberConfirm, setShowMemberConfirm] = useState(false);
  const [showQuickAddMember, setShowQuickAddMember] = useState(false);
  const [quickMember, setQuickMember] = useState({ name: "", org: "", isAndto: false });
  const [isDragging, setIsDragging] = useState(false);
  const [showAiEdit, setShowAiEdit] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [aiEditError, setAiEditError] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState([]);
  const aiChatBottomRef = useRef();
  const [genError, setGenError] = useState("");
  const [hoveredGenBtn, setHoveredGenBtn] = useState(false);
  const [showPdfConfirm, setShowPdfConfirm] = useState(false);
  const [showAiCompDialog, setShowAiCompDialog] = useState(false);
  const [pendingMinutes, setPendingMinutes] = useState("");
  const [pendingMinutesOriginal, setPendingMinutesOriginal] = useState("");
  const [editingDecisionId, setEditingDecisionId] = useState(null);
  const [editingDecisionText, setEditingDecisionText] = useState("");
  const [prevStep, setPrevStep] = useState("tasks");
  const [minutesSaved, setMinutesSaved] = useState(false);
  const [savedMinutesId, setSavedMinutesId] = useState(null);
  const [generatedSourceText, setGeneratedSourceText] = useState("");
  const [bgTranscriptStatus, setBgTranscriptStatus] = useState(null); // null | { pct, msg, error }
  const bgStateRef = useRef({ savedMinutesId: null, selProj: "" });
  const projectsRef = useRef(projects);
  const [transcript, setTranscript] = useState("");
  const [showTranscriptAiEdit, setShowTranscriptAiEdit] = useState(false);
  const [transcriptAiInstruction, setTranscriptAiInstruction] = useState("");
  const [transcriptAiEditLoading, setTranscriptAiEditLoading] = useState(false);
  const [transcriptAiEditError, setTranscriptAiEditError] = useState("");
  const [uploadedAudioFileUri, setUploadedAudioFileUri] = useState(null);
  const [transcriptContinueLoading, setTranscriptContinueLoading] = useState(false);
  const [chunkProgress, setChunkProgress] = useState("");
  const [progress, setProgress] = useState(null); // { steps, idx, detail, startedAt }
  const [isChunked, setIsChunked] = useState(false);
  const [loadingOp, setLoadingOp] = useState(null); // "transcript" | "minutes" | null
  const [aiDiff, setAiDiff] = useState(null); // { original, revised } 議事録AI修正プレビュー
  const [transcriptAiDiff, setTranscriptAiDiff] = useState(null); // 文字起こしAI修正プレビュー
  const [fileError, setFileError] = useState("");
  const fileRef = useRef();
  const abortControllerRef = useRef(null);
  const minutesTextareaRef = useRef();
  const selProjObj = projects.find(p => p.id === selProj);

  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const tplSlots = selProjObj ? [...Array(4)].map((_,i) => (selProjObj.minutesTemplates||[])[i] || { id:"_"+i, name:"", attendees:[], bunseki:"" }) : [];
  const saveTemplate = (idx, name, attendees, bunseki) => {
    if (!selProjObj) return;
    const next = [...Array(4)].map((_,i) => (selProjObj.minutesTemplates||[])[i] || { id: uid(), name:"", attendees:[], bunseki:"" });
    next[idx] = { ...next[idx], name, attendees, bunseki };
    onUpdateProject({ ...selProjObj, minutesTemplates: next });
  };
  const deleteTemplate = (idx) => {
    if (!selProjObj) return;
    const next = [...Array(4)].map((_,i) => (selProjObj.minutesTemplates||[])[i] || { id: uid(), name:"", attendees:[], bunseki:"" });
    next[idx] = { id: uid(), name:"", attendees:[], bunseki:"" };
    if (selectedTplIdx === idx) { setSelectedTplIdx(null); setAttendees([]); setBunseki(""); }
    onUpdateProject({ ...selProjObj, minutesTemplates: next });
  };

  const extractGaiyou = (content) => {
    const match = content.match(/名称[　\s]*：[　\s]*(.+)/) || content.match(/打合せ概要[　\s]*：[　\s]*(.+)/);
    return match ? match[1].trim() : "";
  };
  const extractDate = (content) => {
    const match = content.match(/日時[　\s]*：[　\s]*(.+)/);
    return match ? match[1].trim() : "";
  };

  const handleProjChange = (id) => {
    const proj = projects.find(p => p.id === id);
    setSelProj(id);
    setAttendees([]);
    setBunseki("");
    setSelectedTplIdx(null);
    setPhase(detectCurrentPhase(proj));
  };
  const toggleAttendee = (memberId) => setAttendees(prev => prev.includes(memberId) ? prev.filter(id=>id!==memberId) : [...prev, memberId]);

  const handleFile = e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(f => {
      if (f.type.startsWith("text/") || f.name.endsWith(".txt") || f.name.endsWith(".md")) {
        const r = new FileReader();
        r.onload = ev => setAttachedFiles(prev => [...prev, { name: f.name, content: ev.target.result, isAudio: false }]);
        r.readAsText(f);
      } else if (f.name.endsWith(".mp3") || f.type === "audio/mpeg") {
        // File objectをそのまま保持（直接Geminiにアップロード）
        setAttachedFiles(prev => [...prev, { name: f.name, isAudio: true, file: f, mimeType: "audio/mp3" }]);
      } else if (f.name.endsWith(".m4a") || f.type === "audio/mp4" || f.type === "audio/x-m4a" || f.type === "audio/m4a") {
        setAttachedFiles(prev => [...prev, { name: f.name, isAudio: true, file: f, mimeType: "audio/m4a" }]);
      } else {
        setFileError(`「${f.name}」は非対応形式です。対応ファイル：.txt / .md / .mp3 / .m4a`);
        setTimeout(() => setFileError(""), 4000);
      }
    });
    if (fileRef.current) fileRef.current.value = "";
  };

    const runAiEdit = async () => {
    if (!aiInstruction.trim()) return;
    setAiEditLoading(true); setAiEditError("");
    try {
      const revised = await callClaude({
        system: "あなたは議事録編集の専門家です。ユーザーの指示に従って議事録を修正してください。元の構成・フォーマットを極力維持し、指示された箇所のみ修正してください。修正後の議事録全文のみを出力してください。",
        messages: [{ role: "user", content: `以下の議事録を指示に従って修正してください。\n\n【修正指示】\n${aiInstruction}\n\n【議事録】\n${minutes}` }]
      });
      if (revised) {
        setAiDiff({ original: minutes, revised });
        setShowAiEdit(false);
        const latestProj = projects.find(p => p.id === selProj);
        if (latestProj && aiInstruction.trim()) {
          const learning = [...(latestProj.minutesLearning || []), { instruction: aiInstruction.trim(), date: new Date().toISOString() }].slice(-10);
          onUpdateProject({ ...latestProj, minutesLearning: learning });
        }
        setAiInstruction("");
      }
    } catch(e) { setAiEditError(e.message); }
    setAiEditLoading(false);
  };

  const runAiChatMinutes = async () => {
    if (!aiInstruction.trim()) return;
    const input = aiInstruction.trim();
    setAiInstruction("");
    setAiEditLoading(true); setAiEditError("");
    try {
      const answer = await callClaude({
        system: `あなたは議事録作成の専門家です。以下の情報を参照してユーザーの質問に日本語で簡潔に答えてください。\n\n【議事録】\n${minutes}${text.trim() ? `\n\n【原文・入力テキスト】\n${text}` : ""}`,
        messages: [{ role: "user", content: input }]
      });
      setAiChatMessages(m => [...m,
        { role: "user", content: input },
        { role: "assistant", content: answer }
      ]);
      setTimeout(() => aiChatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch(e) { setAiEditError(e.message); setAiInstruction(input); }
    setAiEditLoading(false);
  };

  const cancelGenerate = () => {
    abortControllerRef.current?.abort();
    setLoading(false);
  };

  const runBgTranscript = async (audioFileUri, mimeType, memberInfo) => {
    try {
      setBgTranscriptStatus({ pct: 10, msg: "バックグラウンドで文字起こし中..." });
      let fakePct = 10;
      const ticker = setInterval(() => {
        fakePct = Math.min(fakePct + 8, 85);
        setBgTranscriptStatus(s => (s && !s.error) ? { pct: fakePct, msg: "バックグラウンドで文字起こし中..." } : s);
      }, 4000);
      let cleaned = "";
      try {
        cleaned = await transcribeLongAudio({
          audioFileUri,
          mimeType,
          firstPrompt: TRANSCRIPTION_SYSTEM_PROMPT + "\n\n以下の音声を文字起こしてください。\n\n【参加者情報】\n" + memberInfo + "\n\n参加者情報から話者を推定し、各発言を「話者名：内容」の形式で書き起こしてください。",
        });
      } finally {
        clearInterval(ticker);
      }
      setBgTranscriptStatus({ pct: 95, msg: "バックグラウンドで文字起こし中..." });
      setGeneratedSourceText(cleaned);
      const savedId = bgStateRef.current.savedMinutesId;
      const projId = bgStateRef.current.selProj;
      if (savedId && projId) {
        const latestProj = projectsRef.current.find(p => p.id === projId);
        if (latestProj) {
          const updatedMinutes = (latestProj.minutes || []).map(m =>
            m.id === savedId ? { ...m, sourceText: cleaned } : m
          );
          onUpdateProject({ ...latestProj, minutes: updatedMinutes });
        }
      }
      setBgTranscriptStatus({ pct: 100, msg: "文字起こし完了" });
      setTimeout(() => setBgTranscriptStatus(null), 3000);
    } catch (e) {
      setBgTranscriptStatus({ pct: 0, msg: "", error: "文字起こしエラー: " + e.message });
      setTimeout(() => setBgTranscriptStatus(null), 5000);
    }
  };

  const generateTranscript = async () => {
    const audioAttachment = attachedFiles.find(f => f.isAudio);
    if (!audioAttachment) return;
    abortControllerRef.current = new AbortController();
    setLoading(true); setGenError(""); setChunkProgress(""); setIsChunked(false); setLoadingOp("transcript");
    setProgress({ steps: ["音声アップロード", "文字起こし", "完了"], idx: 0, detail: "", startedAt: Date.now() });
    try {
      const latestProj = projects.find(p => p.id === selProj);
      const members = latestProj?.members || [];
      const memberInfo = members.length > 0
        ? members.map(m => `${m.name}（${m.isAndto ? "andto" : m.org || "参加者"}）`).join("、")
        : "不明";
      const basePrompt = (offsetStr, offsetSec) =>
        TRANSCRIPTION_SYSTEM_PROMPT +
        (offsetSec > 0
          ? `\n\n【重要】この音声は元の録音の${offsetStr}（${Math.floor(offsetSec / 60)}分${Math.floor(offsetSec % 60)}秒）から始まります。タイムスタンプは[${offsetStr}]から開始し、以降は単調増加で記載してください。`
          : "") +
        "\n\n以下の音声を文字起こしてください。\n\n【参加者情報】\n" + memberInfo +
        "\n\n参加者情報から話者を推定し、各発言を「話者名：内容」の形式で書き起こしてください。";

      // 音声をデコードして尺を確認
      const CHUNK_SEC = 300; // 5分
      const arrayBuffer = await audioAttachment.file.arrayBuffer();
      let audioBuffer = null;
      try {
        const audioCtx = new AudioContext();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        audioCtx.close();
      } catch { /* デコード失敗時は従来フローへ */ }

      if (!audioBuffer || audioBuffer.duration <= CHUNK_SEC) {
        // ── 従来フロー（5分以下 or デコード失敗）────────────────────
        const fileBytes = new Uint8Array(arrayBuffer);
        const { uri: audioFileUri, name: audioFileName } = await uploadAudioToGemini(fileBytes, audioAttachment.mimeType, audioAttachment.name, abortControllerRef.current?.signal);
        setUploadedAudioFileUri(audioFileUri);
        await waitGeminiFileActive(audioFileName, abortControllerRef.current?.signal);
        setProgress(p => p && { ...p, idx: 1 });
        const raw = await transcribeLongAudio({
          audioFileUri,
          mimeType: audioAttachment.mimeType,
          firstPrompt: basePrompt("00:00", 0),
          signal: abortControllerRef.current?.signal,
          onPass: (n) => {
            setChunkProgress(n > 1 ? `文字起こし継続中（${n}回目）...` : "");
            setProgress(p => p && { ...p, detail: n > 1 ? `続きを取得中（${n}回目）` : "" });
          },
        });
        setTranscript(raw);
      } else {
        // ── チャンク分割フロー（5分超）────────────────────────────
        setIsChunked(true);
        const numChunks = Math.ceil(audioBuffer.duration / CHUNK_SEC);
        let fullTranscript = "";
        for (let i = 0; i < numChunks; i++) {
          if (abortControllerRef.current?.signal.aborted) break;
          setChunkProgress(`チャンク ${i + 1} / ${numChunks} 処理中...`);
          setProgress(p => p && { ...p, idx: 1, detail: `チャンク ${i + 1} / ${numChunks} を処理中` });
          const startSec = i * CHUNK_SEC;
          const endSec = Math.min((i + 1) * CHUNK_SEC, audioBuffer.duration);
          const chunkBuf = extractAudioChunk(audioBuffer, startSec, endSec);
          const wavBlob = audioBufferToWavBlob(chunkBuf);
          const fileUri = await uploadWavChunkToGemini(wavBlob, i + 1);
          const mm = String(Math.floor(startSec / 60)).padStart(2, "0");
          const ss = String(Math.floor(startSec % 60)).padStart(2, "0");
          let chunkText;
          try {
            chunkText = await callClaude({
              messages: [{ role: "user", content: basePrompt(`${mm}:${ss}`, startSec) }],
              temperature: 0,
              audioFileUri: fileUri,
              audioMimeType: "audio/wav",
              signal: abortControllerRef.current?.signal,
            });
          } catch (err) {
            if (err.name === "AbortError") throw err;
            throw new Error(`チャンク${i + 1}: ${err.message}`);
          }
          // チャンクごとに個別クリーニング（チャンク間の誤検知防止）
          const cleanedChunk = cleanTranscriptChunk(chunkText);
          fullTranscript += (fullTranscript ? "\n" : "") + cleanedChunk;
        }
        setTranscript(removeLoopedLines(fullTranscript));
      }
      setStep("transcript");
      setProgress(p => p && { ...p, idx: 2, detail: "" });
      setTimeout(() => setProgress(null), 3000);
    } catch (e) {
      if (e.name !== "AbortError") setGenError("文字起こしエラー：" + e.message);
      setProgress(null);
    }
    setLoading(false);
    setChunkProgress("");
    setLoadingOp(null);
  };

  const runTranscriptAiEdit = async () => {
    if (!transcriptAiInstruction.trim()) return;
    setTranscriptAiEditLoading(true); setTranscriptAiEditError("");
    try {
      const revised = await callClaude({
        system: "あなたは文字起こし編集の専門家です。ユーザーの指示に従って文字起こし内容を修正してください。修正後の文字起こし全文のみを出力してください。",
        messages: [{ role: "user", content: `以下の文字起こしを指示に従って修正してください。\n\n【修正指示】\n${transcriptAiInstruction}\n\n【文字起こし】\n${transcript}` }],
      });
      if (revised) { setTranscriptAiDiff({ original: transcript, revised }); setShowTranscriptAiEdit(false); setTranscriptAiInstruction(""); }
    } catch (e) { setTranscriptAiEditError(e.message); }
    setTranscriptAiEditLoading(false);
  };

  const continueTranscript = async () => {
    const audioAttachment = attachedFiles.find(f => f.isAudio);
    if (!audioAttachment && !uploadedAudioFileUri) return;
    setTranscriptContinueLoading(true);
    try {
      let fileUri = uploadedAudioFileUri;
      if (!fileUri) {
        // 再アップロード
        const fileBytes = new Uint8Array(await audioAttachment.file.arrayBuffer());
        const { uri, name } = await uploadAudioToGemini(fileBytes, audioAttachment.mimeType, audioAttachment.name);
        fileUri = uri;
        setUploadedAudioFileUri(fileUri);
        await waitGeminiFileActive(name);
      }

      const tail = transcript.slice(-800);
      const continuePrompt = `以下の音声の文字起こしを行っています。すでに書き起こされた末尾部分を参考に、その続きから文字起こしを続けてください。重複しないように、末尾の直後から続けてください。\n\n【ここまでの末尾】\n${tail}\n\n【続きの文字起こし（末尾の直後から）】`;
      const { text: continuation } = await callClaudePartial({
        messages: [{ role: "user", content: continuePrompt }],
        temperature: 0,
        audioFileUri: fileUri,
        audioMimeType: audioAttachment?.mimeType || "audio/m4a",
      });
      if (continuation) setTranscript(prev => removeLoopedLines(prev + "\n" + cleanTranscriptChunk(continuation)));
    } catch (e) {
      setGenError("続き生成エラー：" + e.message);
    }
    setTranscriptContinueLoading(false);
  };

  const generateMinutes = async (isRegen = false, transcriptText = null) => {
    abortControllerRef.current = new AbortController();
    setLoading(true); setGenError(""); setLoadingOp("minutes");

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
    const infer = v => v || "（入力テキストから推測。不明な場合は空欄）";
    const attendeesValue = members.length === 0
      ? "（出席者情報なし）"
      : orgLines.map((line, i) => i === 0 ? line : "　　　　" + line).join("\n");
    const displayDate = meetingDate ? meetingDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1/$2/$3") : date;
    const dateTimeStr = timeRange ? `${displayDate} ${timeRange}` : displayDate;
    const phaseValue = phase === "その他" ? phaseCustom : phase;
    const filledTemplate = TEMPLATE
      .replace("{projName}", latestProj?.name || "会議名")
      .replace("{gaiyou}", gaiyou || "（入力テキストから推測。不明な場合は空欄）")
      .replace("{date}", dateTimeStr)
      .replace("{place}", "（入力テキストから推測。不明な場合は空欄）")
      .replace("{attendees}", attendeesValue)
      .replace("{bunseki}", bunsekiText)
      .replace("{created}", date)
      .replace("{teishutsushiryo}", teishutsushiryo ? teishutsushiryo : infer(teishutsushiryo))
      .replace("{juryoshiryo}", juryoshiryo ? juryoshiryo : infer(juryoshiryo))
      .replace("{phase}", phaseValue ? phaseValue : infer(phaseValue));
    const headerNote = [
      gaiyou ? `名称は「${gaiyou}」で確定` : null,
      teishutsushiryo ? `提出資料は「${teishutsushiryo}」で確定` : null,
      juryoshiryo ? `受領資料は「${juryoshiryo}」で確定` : null,
      phase ? `フェーズは「${phase}」で確定` : null,
    ].filter(Boolean).join("、");
    const learningPatterns = (latestProj?.minutesLearning || []).slice(-5);
    const learningNote = learningPatterns.length > 0
      ? `\n\n【過去の修正パターン（参考にして議事録の質を向上させてください）】\n${learningPatterns.map((l, i) => `${i+1}. ${l.instruction}`).join("\n")}`
      : "";
    const audioAttachment = transcriptText ? null : attachedFiles.find(f => f.isAudio);
    const combinedText = transcriptText || [
      ...attachedFiles.filter(f => !f.isAudio).map((f, i) => `【ファイル${i + 1}：${f.name}】\n${f.content}`),
      text.trim() ? text : null,
    ].filter(Boolean).join("\n\n");
    setGeneratedSourceText(combinedText);

    setProgress({ steps: audioAttachment ? ["音声アップロード", "議事録生成", "完了"] : ["議事録生成", "完了"], idx: 0, detail: "", startedAt: Date.now() });
    // 音声ファイルをアップロード（署名付きURLをサーバーから取得し、本体はブラウザから直接送る）
    let audioFileUri = undefined;
    if (audioAttachment) {
      try {
        const fileBytes = new Uint8Array(await audioAttachment.file.arrayBuffer());
        const uploaded = await uploadAudioToGemini(fileBytes, audioAttachment.mimeType, audioAttachment.name, abortControllerRef.current?.signal);
        audioFileUri = uploaded.uri;
        await waitGeminiFileActive(uploaded.name, abortControllerRef.current?.signal);
        // バックグラウンドで文字起こしを並行実行（fire-and-forget）
        const bgMemberInfo = (latestProj?.members || []).length > 0
          ? (latestProj.members || []).map(m => `${m.name}（${m.isAndto ? "andto" : m.org || "参加者"}）`).join("、")
          : "不明";
        bgStateRef.current.selProj = selProj;
        runBgTranscript(audioFileUri, audioAttachment.mimeType, bgMemberInfo);
        setProgress(p => p && { ...p, idx: 1 });
      } catch (e) {
        setLoading(false);
        setGenError("音声アップロードエラー: " + e.message);
        setProgress(null);
        return;
      }
    }

    const audioNote = audioAttachment ? `\n\n【音声ファイル】「${audioAttachment.name}」が添付されています。音声を文字起こしし、議事録に反映してください。` : "";
    const userContent = `プロジェクト「${latestProj?.name}」の議事録を作成してください。\n\n【絶対に守るルール】\n- テンプレートの見出しを一字一句変えずすべて使用\n- だ・である調で統一し、受動態（「〜された」「〜される」）は使わず「〜した」「〜する」の能動表現で記載（発言者名は文末に付くため文中の主語不要）\n- テンプレートのヘッダー行（打合せ概要・日時・場所・出席者・文責・作成日・提出資料・受領資料・フェーズ）は必ず全て出力し、値を変更しないこと\n- 「文責　：」欄には「${bunsekiText}」を使用し変更しない\n- 「作成日：」欄には「${date}」を使用し変更しない\n- 「出席者：」欄にはテンプレートの値をそのまま使用し変更しない\n${headerNote ? `- ${headerNote}\n` : ""}- ヘッダーの「（入力テキストから推測。不明な場合は空欄）」は入力テキストから推測して記入。推測できない場合は空欄にする\n\n【メンバー情報】\n${memberInfo}\n\n${attendeeRule}${learningNote}\n\n【テンプレート】\n${filledTemplate}\n\n【入力テキスト】\n${combinedText}${audioNote}\n\n必ず「■ 次回会議予定」まで出力を完了すること。`;
    try {
      const result = await callClaude({
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
        audioFileUri,
        audioMimeType: audioAttachment?.mimeType,
        signal: abortControllerRef.current?.signal,
      });
      let hasAiComp = false;
      if (result.includes("※AI補完") || result.includes("※AI要約")) {
        setPendingMinutes(result);
        setPendingMinutesOriginal(minutes);
        setShowAiCompDialog(true);
        hasAiComp = true;
      } else {
        setMinutes(result);
      }
      const firstLine = result.split("\n").find(l=>l.trim().length>0)||"";
      setMinutesTitle(firstLine.replace(/^#\s*【(.+?)】.*/, "$1").replace(/^#\s*/,"").trim()||"会議");
      if (!isRegen) {
        const existingNames = (latestProj?.members||[]).map(m=>m.name);
        try {
          const raw = await callClaude({ max_tokens: 500, messages: [{ role: "user", content: `以下のテキストに登場する人物名（苗字のみ）を抽出し、既存メンバーにない人物をJSONで返してください。\n既存メンバー：${existingNames.join("、")||"なし"}\n形式：[{"name":"苗字","org":""}]\nJSONのみ出力。\n\n${combinedText}` }] });
          const candidates = JSON.parse(raw.replace(/```json|```/g,"").trim());
          const filtered = candidates.filter(c=>c.name&&!existingNames.includes(c.name));
          setNewMemberCandidates(filtered.map(c=>({...c,id:"cand_"+Math.random().toString(36).slice(2),isAndto:false,selected:true})));
          if (filtered.length>0) setShowMemberConfirm(true);
        } catch { setNewMemberCandidates([]); }
      }
      if (!hasAiComp) setStep("minutes");
      setProgress(p => p && { ...p, idx: p.steps.length - 1, detail: "" });
      setTimeout(() => setProgress(null), 3000);
    } catch(e) {
      setGenError("エラー："+e.message);
      setStep("minutes");
      setProgress(null);
    }
    setLoading(false);
    setLoadingOp(null);
  };


  const buildMinutesEntry = (srcText) => {
    const dateStr = new Date().toLocaleDateString("ja-JP");
    return { id:"min_"+Date.now(), title:`${dateStr}　${minutesTitle||"議事録"}`, content:minutes, sourceText: srcText||"", createdAt:new Date().toISOString() };
  };

  const saveToProject = () => {
    const latestProj = projects.find(p=>p.id===selProj);
    if (!latestProj||!minutes) return null;
    const entry = buildMinutesEntry(generatedSourceText);
    onUpdateProject({...latestProj, minutes:[...(latestProj.minutes||[]),entry]});
    setSaveMsg("議事録を保存しました");
    setMinutesSaved(true);
    setSavedMinutesId(entry.id);
    bgStateRef.current.savedMinutesId = entry.id;
    bgStateRef.current.selProj = selProj;
    return {...entry, projName: latestProj.name, projColor: latestProj.color, projId: latestProj.id};
  };

  const extractBoth = async () => {
    if (!minutesSaved) saveToProject();
    abortControllerRef.current = new AbortController();
    setLoading(true);
    try {
      const _td = new Date();
      const todayStr = `${_td.getFullYear()}年${_td.getMonth()+1}月${_td.getDate()}日（${'日月火水木金土'[_td.getDay()]}）`;
      const sig = abortControllerRef.current?.signal;
      const [rawTasks, rawDecs] = await Promise.all([
        callClaude({ max_tokens: 8000, signal: sig, messages: [{ role: "user", content: `今日の日付：${todayStr}\n\n以下の議事録からアクションアイテムをJSON配列で抽出してください。\n\n【期限抽出ルール】\n・「〇月〇日」「〇日まで」→ YYYY-MM-DD形式に変換\n・「来週」→ 今日から7〜13日後の該当曜日\n・「月末」→ 今月末日\n・「次回まで」「次回会議まで」→ null\n・「至急」「できるだけ早く」→ dueDate: null、priority: "high"\n・期限が明示されていない場合 → null\n\n形式: [{"title":"タスク名","assignee":"担当者名または空文字","dueDate":"YYYY-MM-DDまたはnull","priority":"high|medium|low"}]\nJSONのみ出力。\n\n${minutes}` }] }),
        callClaude({ max_tokens: 4000, signal: sig, messages: [{ role: "user", content: `以下の議事録から【決定事項】の項目をJSON配列で抽出してください。各決定事項を1件ずつ配列に含めてください。\n形式: [{"text":"決定事項の内容"}]\nJSONのみ出力。\n\n${minutes}` }] })
      ]);
      try {
        const members = projects.find(p=>p.id===selProj)?.members || [];
        const resolveIds = (assignee) => {
          if (!assignee) return [];
          const m = members.find(m => m.name===assignee || assignee.includes(m.name) || m.name.includes(assignee));
          return m ? [m.id] : [];
        };
        setExtracted(extractJsonArray(rawTasks).map(t=>({...t, id:uid(), status:"todo", desc:"", selected:true, assigneeIds: resolveIds(t.assignee), subtasks:[], relatedDecisionIds:[], createdAt:new Date().toISOString()})));
      }
      catch { setGenError("タスクのJSON解析に失敗しました。再度お試しください。"); setExtracted([]); }
      try { setExtractedDecisions(extractJsonArray(rawDecs).map(d=>({...d,id:uid(),selected:true,addAsTask:false}))); }
      catch { setExtractedDecisions([]); }
    } catch(e) {
      setGenError("抽出に失敗しました：" + e.message);
      setExtracted([]);
      setExtractedDecisions([]);
    }
    setLoading(false); setStep("tasks");
  };

  const approveBoth = () => {
    const latestProj = projects.find(p=>p.id===selProj);
    if (!latestProj) return;
    const tasksToAdd = extracted.filter(t=>t.selected).filter(t=>t.title !== "タスク抽出に失敗しました").map(({selected,assignee,...t}) => ({...t}));
    const _meetingDateMatch = minutes.match(/日時[　\s]*：[　\s]*(\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2})/);
    const _meetingDateStr = _meetingDateMatch ? (() => { const d=new Date(_meetingDateMatch[1].replace(/[年月]/g,"/").replace(/-/g,"/")); return isNaN(d)?null:d.toISOString().slice(0,10); })() : null;
    const newDecisions = extractedDecisions.filter(d=>d.selected).map(d=>({
      id: d.id, text: d.text, source: minutesTitle||"議事録", createdAt: new Date().toISOString(), date: _meetingDateStr||undefined
    }));
    const decisionTasks = extractedDecisions.filter(d=>d.selected && d.addAsTask).map(d=>({
      id: uid(), title: d.text, status: "todo", dueDate: "", priority: "medium", desc: "", subtasks: [], assigneeIds: []
    }));
    const allNewTaskIds = [...tasksToAdd.map(t=>t.id), ...decisionTasks.map(t=>t.id)];
    let newMinutes;
    if (minutesSaved) {
      newMinutes = (latestProj.minutes||[]).map(m => m.id === savedMinutesId ? {...m, taskIds: [...(m.taskIds||[]), ...allNewTaskIds]} : m);
    } else {
      const entry = buildMinutesEntry(generatedSourceText);
      newMinutes = [...(latestProj.minutes||[]), {...entry, taskIds: allNewTaskIds}];
    }
    const updatedProj = {
      ...latestProj,
      tasks: [...latestProj.tasks, ...tasksToAdd, ...decisionTasks],
      decisions: [...(latestProj.decisions||[]), ...newDecisions],
      minutes: newMinutes,
    };
    onUpdateProject(updatedProj);
    if (!minutesSaved) setMinutesSaved(true);
    setSavedType("tasks");
    setPrevStep("tasks");
    setShowPdfConfirm(true);
    setStep("save");
  };

  const PDF_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; } @page { size: A4; margin: 20mm 20mm 25mm 20mm; } body { font-family: 'Yu Gothic','游ゴシック','YuGothic','Hiragino Kaku Gothic ProN','Meiryo',sans-serif; font-size: 10pt; color: #000; padding: 20mm 20mm 25mm 20mm; line-height: 1.75; width: 210mm; min-height: 297mm; } .title { font-size: 14pt; font-weight: 700; text-align: left; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #000; letter-spacing: 0.05em; } table.meta { border-collapse: collapse; margin-bottom: 8px; font-size: 9.5pt; } .mk { font-weight: 700; padding: 1px 10px 1px 0; white-space: nowrap; vertical-align: top; } .mv { padding: 1px 0; vertical-align: top; } .div { border: none; border-top: 1px solid #aaa; margin: 8px 0; } .sh { font-size: 10.5pt; font-weight: 700; margin: 14px 0 6px; padding: 3px 0; border-bottom: 1px solid #000; } .subh { font-size: 10pt; font-weight: 700; margin: 8px 0 3px; } .ul { padding-left: 0; margin: 3px 0 6px; list-style: none; } .ul li { margin: 2px 0; font-size: 9.5pt; line-height: 1.7; padding-left: 1em; text-indent: -1em; } .ul li::before { content: "・"; } .p { font-size: 9.5pt; margin: 2px 0 5px; line-height: 1.7; } .tt { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9.5pt; } .tt th { background: #f0f0f0; border: 1px solid #999; padding: 5px 8px; text-align: left; font-weight: 700; } .tt td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; line-height: 1.6; } @media print { body { padding: 0; } .sh { break-after: avoid; } .pb { page-break-before: always; height: 0; margin: 0; } }`;

  const downloadMinutesPdf = () => {
    if (!minutes) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const docTitle = `${selProjObj?.name||"議事録"} ${minutesTitle||""}`.trim();
    const proj = projects.find(p => p.id === selProj);
    let body = buildMinutesBody(minutes);
    const tasks = extracted && extracted.length > 0 ? extracted.filter(t2 => t2.selected !== false) : [];
    if (tasks.length > 0) {
      body += `<h2 class="sh" style="margin-top:20px;">■ タスク一覧</h2>\n<table class="tt"><thead><tr><th>タスク内容</th><th>担当者</th><th>期日</th></tr></thead><tbody>`;
      tasks.forEach(t2 => {
        const names = (t2.assigneeIds||[]).map(aid=>proj?.members.find(m=>m.id===aid)?.name).filter(Boolean);
        body += `<tr><td>${escapeHtml(t2.title)}</td><td>${escapeHtml(names.join("、")||t2.assignee||"—")}</td><td>${escapeHtml(t2.dueDate||"—")}</td></tr>`;
      });
      body += `</tbody></table>`;
    }
    win.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(docTitle)}</title><style>${PDF_CSS}</style></head><body>${body}</body></html>`);
    win.document.close(); win.focus(); win.print();
  };

  const reset = () => { setStep("input");setText("");setAttachedFiles([]);setMinutes("");setMinutesTitle("");setExtracted([]);setExtractedDecisions([]);setSavedType("tasks");setSaveMsg("");setAttendees([]);setBunseki("");setGaiyou("");setMeetingDate("");setTimeRange("");setTeishutsushiryo("");setJuryoshiryo("");setPhase("");setPhaseCustom("");setNewMemberCandidates([]);setShowMemberConfirm(false);setShowQuickAddMember(false);setQuickMember({name:"",org:"",isAndto:false});setMinutesSaved(false);setTranscript("");setShowTranscriptAiEdit(false);setTranscriptAiInstruction("");setTranscriptAiEditError("");setUploadedAudioFileUri(null);setTranscriptContinueLoading(false); };

  const hasAudio = attachedFiles.some(f => f.isAudio);
  const activeSteps = hasAudio ? STEPS_WITH_TRANSCRIPT : STEPS;
  const activeStepLabels = hasAudio ? STEP_LABELS_WITH_TRANSCRIPT : STEP_LABELS;
  const stepIdx = activeSteps.indexOf(step);
  const inputStyle ={ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10, padding:"8px 12px", fontSize:13, background:C.bg, color:C.text, outline:"none", boxSizing:"border-box" };

  return (
    <div style={{ overflowY:"auto", height:"calc(100dvh - 52px)", background:C.bg }}>
      {/* モーダル */}
      {showAiCompDialog && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:400 }}>
          <div style={{ background:C.surface, borderRadius:20, padding:26, width:"80vw", maxWidth:820, maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 70px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:"0 0 6px", fontSize:15, fontWeight:900, color:C.text }}>⚠️ AI補完・要約が発生しました</h3>
            <p style={{ fontSize:12, color:C.muted, marginBottom:14, lineHeight:1.7 }}>
              AIが一部を補完または要約しました（⚠マーク箇所）。変更前後を確認して反映するか選んでください。
            </p>
            <div style={{ display:"flex", gap:12, flex:1, minHeight:0, marginBottom:14 }}>
              <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5 }}>変更前</div>
                <textarea readOnly value={pendingMinutesOriginal} style={{ flex:1, width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 10px", fontSize:11, background:"#fff", color:C.muted, resize:"none", boxSizing:"border-box", fontFamily:"'Courier New',monospace", lineHeight:1.6, minHeight:260 }} />
              </div>
              <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#D97706", marginBottom:5 }}>変更後（⚠ = AI補完・要約箇所）</div>
                <textarea readOnly value={pendingMinutes} style={{ flex:1, width:"100%", border:`1.5px solid #D97706`, borderRadius:8, padding:"8px 10px", fontSize:11, background:"#FFFBEB", color:C.text, resize:"none", boxSizing:"border-box", fontFamily:"'Courier New',monospace", lineHeight:1.6, minHeight:260 }} />
              </div>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>{
                const replaced = pendingMinutes.replace(/※AI補完/g,"※要確認（原文を参照してください）").replace(/※AI要約/g,"※要確認（原文を参照してください）");
                setMinutes(replaced); setPendingMinutes(""); setPendingMinutesOriginal(""); setShowAiCompDialog(false); setStep("minutes");
              }} style={btn({padding:"9px 16px",borderRadius:10,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:13,fontWeight:700})}>いいえ（原文に戻す）</button>
              <button onClick={()=>{
                setMinutes(pendingMinutes); setPendingMinutes(""); setPendingMinutesOriginal(""); setShowAiCompDialog(false); setStep("minutes");
              }} style={btn({padding:"9px 20px",borderRadius:10,background:C.accent,color:"#fff",fontSize:13,fontWeight:800})}>はい（反映する）</button>
            </div>
          </div>
        </div>
      )}
      {templateModal !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:600 }} onClick={()=>setTemplateModal(null)}>
          <div style={{ background:C.surface, borderRadius:16, padding:24, width:520, maxWidth:"92vw", maxHeight:"85vh", overflowY:"auto", boxShadow:"0 16px 50px rgba(0,0,0,0.18)" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:900, color:C.text }}>📋 テンプレートを編集</h3>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:4 }}>ボタン名</div>
              <input autoFocus value={templateModal.name} onChange={e=>setTemplateModal(m=>({...m,name:e.target.value}))}
                placeholder="例：定例打合せ、消防協議、施主確認"
                style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
            </div>
            {selProjObj && (selProjObj.members||[]).length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:6 }}>👥 出席者</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {(selProjObj.members||[]).map(m => {
                    const sel = (templateModal.attendees||[]).includes(m.id);
                    return (
                      <button key={m.id} onClick={()=>setTemplateModal(tm=>({ ...tm, attendees: sel ? tm.attendees.filter(id=>id!==m.id) : [...(tm.attendees||[]), m.id] }))}
                        style={btn({ padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:700,
                          background:sel?(m.isAndto?C.accent:C.sage):"transparent",
                          color:sel?"#fff":C.muted,
                          border:`1.5px solid ${sel?(m.isAndto?C.accent:C.sage):C.border}` })}>
                        {m.name}{m.org?` ${m.org}`:""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {selProjObj && (selProjObj.members||[]).length > 0 && (
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:6 }}>✍️ 文責</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {(selProjObj.members||[]).map(m => {
                    const sel = templateModal.bunseki === m.id;
                    return (
                      <button key={m.id} onClick={()=>setTemplateModal(tm=>({ ...tm, bunseki: sel ? "" : m.id }))}
                        style={btn({ padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:700,
                          background:sel?(m.isAndto?C.accent:C.sage):"transparent",
                          color:sel?"#fff":C.muted,
                          border:`1.5px solid ${sel?(m.isAndto?C.accent:C.sage):C.border}` })}>
                        {m.name}{m.org?` ${m.org}`:""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              {templateModal.name ? (
                <button onClick={()=>{ deleteTemplate(templateModal.idx); setTemplateModal(null); }} style={BTN.danger}>削除</button>
              ) : <div />}
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setTemplateModal(null)} style={BTN.ghost}>キャンセル</button>
                <button onClick={()=>{ if(templateModal.name.trim()){ saveTemplate(templateModal.idx, templateModal.name.trim(), templateModal.attendees||[], templateModal.bunseki||""); setTemplateModal(null); }}} style={BTN.primary}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPdfConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:350 }} onClick={()=>setShowPdfConfirm(false)}>
          <div style={{ background:C.surface, borderRadius:20, padding:26, width:360, maxWidth:"90vw", boxShadow:"0 24px 70px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:"0 0 12px", fontSize:15, fontWeight:900, color:C.text }}>議事録をPDFでダウンロードしますか？</h3>
            <p style={{ fontSize:12, color:C.muted, marginBottom:18 }}>議事録の全文をPDFとして保存できます。必要に応じてダウンロードしてください。</p>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowPdfConfirm(false)} style={btn({padding:"9px 16px",borderRadius:10,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:13,fontWeight:700})}>スキップ</button>
              <button onClick={()=>{downloadMinutesPdf();setShowPdfConfirm(false);}} style={btn({padding:"9px 20px",borderRadius:10,background:C.accent,color:"#fff",fontSize:13,fontWeight:800})}>ダウンロード</button>
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
                setShowMemberConfirm(false);
              }} style={btn({padding:"9px 22px",borderRadius:10,background:C.sage,color:"#fff",fontSize:13,fontWeight:800})}>追加する</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding:24, maxWidth:760, margin:"0 auto" }}>
            <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
              {activeStepLabels.map((lbl,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", flex:i<activeStepLabels.length-1?1:"none" }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, background:i<stepIdx?C.sage:i===stepIdx?C.accent:C.border, color:i<=stepIdx?"#fff":C.muted }}>{i<stepIdx?"✓":i+1}</div>
                    <span style={{ fontSize:10, fontWeight:700, color:i===stepIdx?C.accent:i<stepIdx?C.sage:C.muted, whiteSpace:"nowrap" }}>{lbl}</span>
                  </div>
                  {i<activeStepLabels.length-1&&<div style={{ flex:1, height:2, background:i<stepIdx?C.sage:C.border, margin:"0 6px", marginBottom:18 }} />}
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
                {selProjObj && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                      <label style={{ fontSize:12, fontWeight:700, color:C.muted }}>📋 テンプレート</label>
                      <span style={{ fontSize:11, color:C.muted }}>（クリックで挿入 / ✎で編集・登録）</span>
                    </div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {tplSlots.map((tpl, idx) => {
                        const isSel = selectedTplIdx === idx;
                        return (
                          <div key={idx} style={{ display:"flex", alignItems:"center", gap:4 }}>
                            {tpl.name ? (
                              <button onClick={()=>{
                                if (isSel) { setSelectedTplIdx(null); setAttendees([]); setBunseki(""); }
                                else { setSelectedTplIdx(idx); setAttendees(tpl.attendees||[]); setBunseki(tpl.bunseki||""); }
                              }}
                                style={btn({ padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:700,
                                  background:isSel?C.accent:"transparent", color:isSel?"#fff":C.muted,
                                  border:`1.5px solid ${isSel?C.accent:C.border}` })}>
                                {tpl.name}
                              </button>
                            ) : (
                              <span style={{ fontSize:11, color:C.muted, padding:"6px 4px" }}>テンプレート{idx+1}</span>
                            )}
                            <button aria-label="テンプレートを編集" onClick={()=>setTemplateModal({ idx, name:tpl.name||"", attendees:tpl.attendees||[], bunseki:tpl.bunseki||"" })}
                              style={btn({ padding:"4px 8px", borderRadius:20, fontSize:12, color:tpl.name?C.muted:"#aaa", background:"transparent", border:`1px solid ${C.border}` })}>✎</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                        {attendees.length>0&&<div style={{ marginTop:8, fontSize:11, color:C.muted, background:C.bg, borderRadius:8, padding:"6px 10px", whiteSpace:"pre-line" }}>{(()=>{const sel=(selProjObj.members||[]).filter(m=>attendees.includes(m.id));const nonA=sel.filter(m=>!m.isAndto);const andtoMs=sel.filter(m=>m.isAndto);const groups={};nonA.forEach(m=>{const k=m.org||"所属未設定";if(!groups[k])groups[k]=[];groups[k].push(m.name+"様");});const lines=Object.entries(groups).map(([org,names])=>org+"："+names.join("、"));if(andtoMs.length>0)lines.push("andto："+andtoMs.map(m=>m.name).join("、"));return lines.join("\n");})()}</div>}
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
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                    <div>
                      <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:"block", marginBottom:4 }}>名称</label>
                      <input value={gaiyou} onChange={e=>setGaiyou(e.target.value)} placeholder="会議の名称（空欄時はAIが推測）"
                        style={{ ...inputStyle, fontSize:12, padding:"7px 10px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:"block", marginBottom:4 }}>日時</label>
                      <div style={{ display:"flex", gap:6 }}>
                        <input type="date" value={meetingDate} onChange={e=>setMeetingDate(e.target.value)}
                          className={`date-muted${meetingDate ? " has-value" : ""}`}
                          style={{ ...inputStyle, fontSize:12, padding:"7px 8px", flex:"0 0 auto", width:130 }} />
                        <input value={timeRange} onChange={e=>setTimeRange(e.target.value)} placeholder="16:00-17:00"
                          style={{ ...inputStyle, fontSize:12, padding:"7px 8px", flex:1, minWidth:0 }} />
                      </div>
                    </div>
                    {[["提出資料", "こちらが提出・画面共有した資料名（空欄時はAIが推測）", teishutsushiryo, setTeishutsushiryo],
                      ["受領資料", "先方から受領・先方が画面共有した資料名（空欄時はAIが推測）", juryoshiryo, setJuryoshiryo],
                    ].map(([lbl, ph, val, setter]) => (
                      <div key={lbl}>
                        <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:"block", marginBottom:4 }}>{lbl}</label>
                        <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
                          style={{ ...inputStyle, fontSize:12, padding:"7px 10px" }} />
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:"block", marginBottom:4 }}>フェーズ</label>
                      <select value={phase} onChange={e=>{ setPhase(e.target.value); if(e.target.value !== "その他") setPhaseCustom(""); }}
                        style={{ ...inputStyle, fontSize:12, padding:"7px 10px", color: phase ? C.text : C.muted }}>
                        <option value="">（空欄時はAIが推測）</option>
                        {PHASE_LABELS.map(pl => <option key={pl} value={pl}>{pl}</option>)}
                        <option value="その他">その他（自由入力）</option>
                      </select>
                      {phase === "その他" && (
                        <input value={phaseCustom} onChange={e=>setPhaseCustom(e.target.value)} placeholder="フェーズ名を入力"
                          style={{ ...inputStyle, fontSize:12, padding:"7px 10px", marginTop:6 }} />
                      )}
                    </div>
                  </div>
                  <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:8 }}>📎 ファイル添付またはテキスト入力</label>
                  <div onClick={()=>fileRef.current?.click()}
                    onDragOver={e=>{e.preventDefault();setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)}
                    onDrop={e=>{e.preventDefault();setIsDragging(false);const fs=Array.from(e.dataTransfer.files);if(fs.length)handleFile({target:{files:fs}});}}
                    style={{ border:`2px dashed ${isDragging?C.sage:C.border}`, borderRadius:12, padding:"20px 24px", textAlign:"center", cursor:"pointer", marginBottom:8, background:isDragging?C.sageLight:C.bg }}>
                    <div style={{ fontSize:28, marginBottom:6 }}>{isDragging?"📂":"📎"}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:isDragging?C.sage:C.text }}>{isDragging?"ここにドロップ":"クリックまたはドラッグ＆ドロップ（複数可）"}</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>.txt / .md / .mp3 / .m4a 対応</div>
                    <input ref={fileRef} type="file" style={{ display:"none" }} accept=".txt,.md,.mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a" multiple onChange={handleFile} />
                  </div>
                  {fileError && (
                    <div style={{ marginBottom:8, background:"#FEE2E2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#DC2626", fontWeight:600 }}>
                      ⚠️ {fileError}
                    </div>
                  )}
                  {attachedFiles.length > 0 && (
                    <div style={{ marginBottom:10, display:"flex", flexDirection:"column", gap:5 }}>
                      {attachedFiles.map((f, i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"6px 10px" }}>
                          <span style={{ fontSize:11, color:C.accent, flexShrink:0 }}>{f.isAudio ? "🎙" : "📄"}</span>
                          <span style={{ flex:1, fontSize:12, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                          <button aria-label="添付ファイルを削除" onClick={()=>setAttachedFiles(prev=>prev.filter((_,j)=>j!==i))}
                            style={btn({padding:"2px 8px",borderRadius:6,fontSize:11,color:C.muted,background:"transparent",border:`1px solid ${C.border}`})}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea value={text} onChange={e=>setText(e.target.value)} rows={8} placeholder="または会議メモ・発言内容を直接ペースト..."
                    style={{ ...inputStyle, resize:"vertical", lineHeight:1.7, fontFamily:"inherit" }} />
                </div>
                <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                  {hasAudio && (
                    <button onClick={generateTranscript} disabled={!selProj||loading}
                      style={{ background: loading||!selProj ? "#B0B0B0" : "#4A9B8E", border:"none", color:"#fff", borderRadius:6, padding:"10px 24px", fontSize:14, fontWeight:600, cursor: loading||!selProj ? "default" : "pointer", opacity: loading&&loadingOp==="transcript" ? 0.7 : 1 }}>
                      {loadingOp==="transcript" ? (chunkProgress ? `🎙 ${chunkProgress}` : "🎙 文字起こし中...") : "🎙 文字起こしを開始する"}
                    </button>
                  )}
                  <button onClick={() => generateMinutes(false)} disabled={(!text.trim()&&attachedFiles.length===0)||!selProj||loading}
                    onMouseEnter={()=>setHoveredGenBtn(true)} onMouseLeave={()=>setHoveredGenBtn(false)}
                    style={{ background: loading||(!text.trim()&&attachedFiles.length===0)||!selProj ? "#B0B0B0" : hoveredGenBtn ? "#3D8579" : "#4A9B8E", border:"none", color:"#fff", borderRadius:6, padding:"10px 24px", fontSize:14, fontWeight:600, cursor: loading||(!text.trim()&&attachedFiles.length===0)||!selProj ? "default" : "pointer", opacity: loading&&loadingOp==="minutes" ? 0.7 : 1 }}>
                    {loadingOp==="minutes" ? "⏳ 議事録生成中..." : "✨ 議事録を生成する"}
                  </button>
                  {loading && <button onClick={cancelGenerate} style={{ background:"transparent", border:"1.5px solid #9E9E9E", color:"#616161", borderRadius:6, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>キャンセル</button>}
                </div>
                {progress && <div style={{marginTop:14}}><ProgressPanel steps={progress.steps} idx={progress.idx} detail={progress.detail} startedAt={progress.startedAt} /></div>}
                {genError&&<div style={{ marginTop:14, background:"#FEE2E2", border:"1.5px solid #FCA5A5", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#DC2626", fontWeight:600 }}>⚠️ {genError}</div>}
              </div>
            )}

            {step==="transcript"&&(
              <div style={{ background:C.surface, borderRadius:16, padding:24, border:`1.5px solid ${C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontWeight:800, color:C.text, fontSize:15 }}>🎙 文字起こし確認</span>
                  <button onClick={()=>setStep("input")} style={btn({fontSize:12,color:C.muted,background:"transparent"})}>← 戻る</button>
                </div>
                <p style={{ fontSize:12, color:C.muted, marginBottom:14, lineHeight:1.7 }}>内容を確認・修正してから議事録を生成してください。話者名の修正などはAI修正をご利用ください。</p>
                <textarea value={transcript} onChange={e=>setTranscript(e.target.value)} rows={18}
                  style={{ ...inputStyle, resize:"vertical", lineHeight:1.8, fontFamily:"'Courier New',monospace", fontSize:12, marginBottom:16 }} />
                {showTranscriptAiEdit && (
                  <div style={{ marginBottom:16, background:C.accentLight, border:`1.5px solid ${C.accent}`, borderRadius:12, padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:8 }}>✨ AI修正指示</div>
                    <textarea value={transcriptAiInstruction} onChange={e=>setTranscriptAiInstruction(e.target.value)} rows={3}
                      placeholder="例：話者Aを「田中様」に修正してください"
                      style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 11px", fontSize:12, background:"#fff", color:C.text, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }} />
                    {transcriptAiEditError && <div style={{ fontSize:12, color:C.accent, marginTop:6 }}>⚠️ {transcriptAiEditError}</div>}
                    <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"flex-end" }}>
                      <button onClick={()=>{setShowTranscriptAiEdit(false);setTranscriptAiInstruction("");setTranscriptAiEditError("");}} style={BTN.ghost}>キャンセル</button>
                      <button onClick={runTranscriptAiEdit} disabled={transcriptAiEditLoading||!transcriptAiInstruction.trim()} style={{...BTN.primary, opacity:transcriptAiEditLoading||!transcriptAiInstruction.trim()?0.5:1, cursor:transcriptAiEditLoading||!transcriptAiInstruction.trim()?"default":"pointer"}}>{transcriptAiEditLoading?"修正中...":"修正する"}</button>
                    </div>
                  </div>
                )}
                {transcriptAiDiff && (
                  <div style={{ marginBottom:16, background:"#F0FDF4", border:`1.5px solid ${C.sage}`, borderRadius:12, padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.sage, marginBottom:10 }}>✨ AI修正プレビュー — 内容を確認して適用してください</div>
                    <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:4 }}>修正前</div>
                        <textarea readOnly value={transcriptAiDiff.original} rows={8} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 10px", fontSize:11, background:"#fff", color:C.muted, resize:"vertical", boxSizing:"border-box", fontFamily:"'Courier New',monospace", lineHeight:1.6 }} />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:C.sage, marginBottom:4 }}>修正後</div>
                        <textarea readOnly value={transcriptAiDiff.revised} rows={8} style={{ width:"100%", border:`1.5px solid ${C.sage}`, borderRadius:8, padding:"8px 10px", fontSize:11, background:C.sageLight, color:C.text, resize:"vertical", boxSizing:"border-box", fontFamily:"'Courier New',monospace", lineHeight:1.6 }} />
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                      <button onClick={()=>setTranscriptAiDiff(null)} style={BTN.ghost}>キャンセル</button>
                      <button onClick={()=>{ setTranscript(transcriptAiDiff.revised); setTranscriptAiDiff(null); }} style={BTN.primary}>適用する</button>
                    </div>
                  </div>
                )}
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                  <button onClick={()=>{setShowTranscriptAiEdit(v=>!v);setTranscriptAiInstruction("");setTranscriptAiEditError("");setTranscriptAiDiff(null);}}
                    style={btn({padding:"10px 18px",borderRadius:12,background:showTranscriptAiEdit?C.accent:C.accentLight,color:showTranscriptAiEdit?"#fff":C.accent,fontSize:13,fontWeight:800,border:`1.5px solid ${C.accent}`})}>✨ AI修正</button>
                  {!isChunked && (
                  <button onClick={continueTranscript} disabled={transcriptContinueLoading||loading}
                    style={btn({padding:"10px 18px",borderRadius:12,background:transcriptContinueLoading||loading?C.border:C.doing+"cc",color:"#fff",fontSize:13,fontWeight:800})}>
                    {transcriptContinueLoading?"⏳ 続き生成中...":"⏩ 続きを生成"}
                  </button>
                  )}
                  <button onClick={()=>generateMinutes(false, transcript)} disabled={loading||!transcript}
                    style={btn({padding:"10px 18px",borderRadius:12,background:loading||!transcript?C.border:C.sage,color:"#fff",fontSize:13,fontWeight:800})}>
                    {loading?"⏳ 生成中...":"✨ 議事録を生成する →"}
                  </button>
                  {loading && <button onClick={cancelGenerate} style={{ padding:"10px 18px", borderRadius:12, background:"transparent", border:"1.5px solid #9E9E9E", color:"#616161", fontSize:13, fontWeight:600, cursor:"pointer" }}>キャンセル</button>}
                </div>
                {progress && <div style={{marginTop:14}}><ProgressPanel steps={progress.steps} idx={progress.idx} detail={progress.detail} startedAt={progress.startedAt} /></div>}
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
                {progress && <div style={{marginTop:14}}><ProgressPanel steps={progress.steps} idx={progress.idx} detail={progress.detail} startedAt={progress.startedAt} /></div>}
                {genError&&<div style={{ marginBottom:14, background:"#FEE2E2", border:"1.5px solid #FCA5A5", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#DC2626", fontWeight:600 }}>⚠️ {genError}</div>}
                {bgTranscriptStatus && (
                  <div style={{ marginBottom:14, padding:"10px 14px", background: bgTranscriptStatus.error ? "#FEF2F2" : "#F0FDF4", border:`1.5px solid ${bgTranscriptStatus.error ? "#FCA5A5" : "#86EFAC"}`, borderRadius:10 }}>
                    {bgTranscriptStatus.error ? (
                      <div style={{ fontSize:12, color:"#DC2626", fontWeight:600 }}>⚠️ {bgTranscriptStatus.error}</div>
                    ) : (
                      <>
                        <div style={{ fontSize:12, color:"#16A34A", fontWeight:700, marginBottom:6 }}>
                          {bgTranscriptStatus.pct < 100 ? `バックグラウンドで文字起こし中... ${bgTranscriptStatus.pct}%` : "✓ 文字起こし完了"}
                        </div>
                        <div style={{ height:4, background:"#D1FAE5", borderRadius:2, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${bgTranscriptStatus.pct}%`, background:"#22C55E", borderRadius:2, transition:"width 0.5s ease" }} />
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:4 }}>
                  <button onClick={() => {
                    const el = minutesTextareaRef.current;
                    if (!el) return;
                    const s = el.selectionStart, e2 = el.selectionEnd;
                    const marker = "\n[改ページ]\n";
                    const next = minutes.slice(0, s) + marker + minutes.slice(e2);
                    setMinutes(next); setMinutesSaved(false);
                    setTimeout(() => { el.selectionStart = el.selectionEnd = s + marker.length; el.focus(); }, 0);
                  }} style={btn({ fontSize:11, fontWeight:700, color:C.muted, border:`1px solid ${C.border}`, borderRadius:6, padding:"3px 10px", background:C.surface })}>
                    ✂ 改ページ挿入
                  </button>
                </div>
                <textarea ref={minutesTextareaRef} value={minutes} onChange={e=>{ setMinutes(e.target.value); setMinutesSaved(false); }} rows={16}
                  style={{ ...inputStyle, resize:"vertical", lineHeight:1.8, fontFamily:"'Courier New',monospace", fontSize:12, marginBottom:16 }} />
                {showAiEdit && (
                  <div style={{ marginBottom:16, background:C.accentLight, border:`1.5px solid ${C.accent}`, borderRadius:12, padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:8 }}>✨ AI編集</div>
                    {(aiChatMessages.length > 0 || aiEditLoading) && (
                      <div style={{ maxHeight:200, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
                        {aiChatMessages.map((msg, i) => (
                          <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start" }}>
                            <div style={{ maxWidth:"85%", padding:"8px 12px", borderRadius:msg.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",
                              background:msg.role==="user"?C.accent:"#fff", color:msg.role==="user"?"#fff":C.text,
                              fontSize:12, lineHeight:1.6, border:msg.role==="assistant"?`1px solid ${C.border}`:"none", whiteSpace:"pre-wrap" }}>
                              {msg.content}
                            </div>
                          </div>
                        ))}
                        {aiEditLoading && (
                          <div style={{ display:"flex", justifyContent:"flex-start" }}>
                            <div style={{ padding:"8px 14px", borderRadius:"12px 12px 12px 4px", background:"#fff", border:`1px solid ${C.border}`, fontSize:12, color:C.muted }}>考え中...</div>
                          </div>
                        )}
                        <div ref={aiChatBottomRef} />
                      </div>
                    )}
                    <textarea value={aiInstruction} onChange={e=>setAiInstruction(e.target.value)} rows={3}
                      placeholder="質問や編集指示を記入してください。"
                      style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 11px", fontSize:12, background:"#fff", color:C.text, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }} />
                    {aiEditError && <div style={{ fontSize:12, color:C.accent, marginTop:6 }}>⚠️ {aiEditError}</div>}
                    <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"space-between", alignItems:"center" }}>
                      <button onClick={()=>{setShowAiEdit(false);setAiInstruction("");setAiEditError("");}} style={BTN.ghost}>キャンセル</button>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={runAiChatMinutes} disabled={aiEditLoading||!aiInstruction.trim()} style={{...BTN.ghost, opacity:aiEditLoading||!aiInstruction.trim()?0.5:1, cursor:aiEditLoading||!aiInstruction.trim()?"default":"pointer"}}>{aiEditLoading?"処理中...":"💬 質問する"}</button>
                        <button onClick={runAiEdit} disabled={aiEditLoading||!aiInstruction.trim()} style={{...BTN.primary, opacity:aiEditLoading||!aiInstruction.trim()?0.5:1, cursor:aiEditLoading||!aiInstruction.trim()?"default":"pointer"}}>{aiEditLoading?"処理中...":"✨ 編集する"}</button>
                      </div>
                    </div>
                  </div>
                )}
                {aiDiff && (
                  <div style={{ marginBottom:16, background:"#F0FDF4", border:`1.5px solid ${C.sage}`, borderRadius:12, padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.sage, marginBottom:10 }}>✨ AI修正プレビュー — 内容を確認して適用してください</div>
                    <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:4 }}>修正前</div>
                        <textarea readOnly value={aiDiff.original} rows={8} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 10px", fontSize:11, background:"#fff", color:C.muted, resize:"vertical", boxSizing:"border-box", fontFamily:"'Courier New',monospace", lineHeight:1.6 }} />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:C.sage, marginBottom:4 }}>修正後</div>
                        <textarea readOnly value={aiDiff.revised} rows={8} style={{ width:"100%", border:`1.5px solid ${C.sage}`, borderRadius:8, padding:"8px 10px", fontSize:11, background:C.sageLight, color:C.text, resize:"vertical", boxSizing:"border-box", fontFamily:"'Courier New',monospace", lineHeight:1.6 }} />
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                      <button onClick={()=>setAiDiff(null)} style={BTN.ghost}>キャンセル</button>
                      <button onClick={()=>{ setMinutes(aiDiff.revised); setAiDiff(null); setMinutesSaved(false); }} style={BTN.primary}>適用する</button>
                    </div>
                  </div>
                )}
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                  <button onClick={()=>{setShowAiEdit(v=>!v);setAiInstruction("");setAiEditError("");setAiDiff(null);}}
                    style={btn({padding:"10px 18px",borderRadius:12,background:showAiEdit?C.accent:C.accentLight,color:showAiEdit?"#fff":C.accent,fontSize:13,fontWeight:800,border:`1.5px solid ${C.accent}`})}>✨ AI編集</button>
                  <button onClick={()=>{saveToProject();}} disabled={!minutes||minutesSaved}
                    style={btn({padding:"10px 18px",borderRadius:12,background:minutesSaved?C.border:minutes?C.sage:C.border,color:"#fff",fontSize:13,fontWeight:800})}>
                    {minutesSaved?"✓ 保存済み":"💾 保存"}
                  </button>
                  <button onClick={extractBoth} disabled={loading||!minutes}
                    style={btn({padding:"10px 18px",borderRadius:12,background:loading||!minutes?C.border:C.decision,color:"#fff",fontSize:13,fontWeight:800})}>{loading?"⏳ 抽出中...":"📋 決定事項・タスク抽出"}</button>
                  {loading && <button onClick={cancelGenerate} style={{ padding:"10px 18px", borderRadius:12, background:"transparent", border:"1.5px solid #9E9E9E", color:"#616161", fontSize:13, fontWeight:600, cursor:"pointer" }}>キャンセル</button>}
                  {saveMsg&&<span style={{ fontSize:12, color:C.sage, fontWeight:700 }}>✓ {saveMsg}</span>}
                </div>
              </div>
            )}

            {step==="tasks"&&(
              <div style={{ background:C.surface, borderRadius:16, padding:24, border:`1.5px solid ${C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontWeight:800, color:C.text, fontSize:15 }}>決定事項・タスクの承認</span>
                  <button onClick={()=>setStep("minutes")} style={btn({fontSize:12,color:C.muted,background:"transparent"})}>← 戻る</button>
                </div>
                <p style={{ fontSize:12, color:C.muted, marginBottom:18 }}>承認後、<strong style={{color:selProjObj?.color}}>{selProjObj?.name}</strong> に保存されます。</p>

                {/* 決定事項セクション */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:C.decision }}>📋 決定事項</span>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>setExtractedDecisions(ds=>ds.map(d=>({...d,selected:true})))} style={btn({fontSize:11,color:C.sage,background:"transparent"})}>全選択</button>
                      <button onClick={()=>setExtractedDecisions(ds=>ds.map(d=>({...d,selected:false})))} style={btn({fontSize:11,color:C.muted,background:"transparent"})}>全解除</button>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {extractedDecisions.map(d=>(
                      <div key={d.id} style={{ background:d.selected?C.decisionLight:C.bg, border:`1.5px solid ${d.selected?C.decision:C.border}`, borderRadius:10, overflow:"hidden" }}>
                        <div onClick={()=>{ if(editingDecisionId!==d.id) setExtractedDecisions(ds=>ds.map(x=>x.id===d.id?{...x,selected:!x.selected}:x)); }}
                          style={{ padding:"10px 14px", cursor:"pointer", display:"flex", alignItems:"flex-start", gap:10 }}>
                          <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${d.selected?C.decision:C.border}`, background:d.selected?C.decision:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
                            {d.selected&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
                          </div>
                          {editingDecisionId===d.id ? (
                            <textarea value={editingDecisionText} onChange={e=>setEditingDecisionText(e.target.value)} rows={2} onClick={e=>e.stopPropagation()}
                              style={{ flex:1, border:`1.5px solid #5B7EC9`, borderRadius:7, padding:"5px 8px", fontSize:12, background:"#fff", color:C.text, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }} />
                          ) : (
                            <span style={{ flex:1, fontSize:12, color:C.text, lineHeight:1.6 }}>{d.text}</span>
                          )}
                          <div onClick={e=>e.stopPropagation()} style={{ display:"flex", gap:4, flexShrink:0 }}>
                            {editingDecisionId===d.id ? (
                              <>
                                <button onClick={()=>{ setExtractedDecisions(ds=>ds.map(x=>x.id===d.id?{...x,text:editingDecisionText}:x)); setEditingDecisionId(null); }}
                                  style={btn({padding:"3px 8px",borderRadius:6,background:C.decision,color:"#fff",fontSize:11,fontWeight:700})}>保存</button>
                                <button onClick={()=>setEditingDecisionId(null)}
                                  style={btn({padding:"3px 7px",borderRadius:6,background:"transparent",color:C.muted,fontSize:11,border:`1px solid ${C.border}`})}>取消</button>
                              </>
                            ) : (
                              <button aria-label="決定事項を編集" onClick={()=>{ setEditingDecisionId(d.id); setEditingDecisionText(d.text); }}
                                style={btn({padding:"3px 7px",borderRadius:6,background:"transparent",color:C.muted,fontSize:11})}>✏️</button>
                            )}
                          </div>
                        </div>
                        <div onClick={e=>e.stopPropagation()} style={{ padding:"0 14px 8px 42px" }}>
                          <button onClick={()=>setExtractedDecisions(ds=>ds.map(x=>x.id===d.id?{...x,addAsTask:!x.addAsTask}:x))}
                            style={btn({padding:"3px 9px",borderRadius:6,background:d.addAsTask?C.sage:"transparent",color:d.addAsTask?"#fff":C.muted,fontSize:11,fontWeight:700,border:`1px solid ${d.addAsTask?C.sage:C.border}`})}>✅ タスクとしても追加</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* タスクセクション */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:C.sage }}>✅ タスク</span>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>setExtracted(ex=>ex.map(x=>({...x,selected:true})))} style={btn({fontSize:11,color:C.sage,background:"transparent"})}>全選択</button>
                      <button onClick={()=>setExtracted(ex=>ex.map(x=>({...x,selected:false})))} style={btn({fontSize:11,color:C.muted,background:"transparent"})}>全解除</button>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {extracted.map(t=>(
                      <div key={t.id} style={{ background:t.selected?C.sageLight:C.bg, border:`1.5px solid ${t.selected?C.sage:C.border}`, borderRadius:10, overflow:"hidden" }}>
                        <div onClick={()=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,selected:!x.selected}:x))}
                          style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", cursor:"pointer" }}>
                          <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${t.selected?C.sage:C.border}`, background:t.selected?C.sage:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {t.selected&&<span style={{color:"#fff",fontSize:11,fontWeight:900}}>✓</span>}
                          </div>
                          <span style={{ flex:1, fontSize:12, fontWeight:700, color:C.text }}>{t.title||"（タイトル未入力）"}</span>
                          <PriorityDot p={t.priority} />
                        </div>
                        <div onClick={e=>e.stopPropagation()} style={{ padding:"0 12px 10px 40px", display:"flex", gap:6, flexWrap:"wrap" }}>
                          <input value={t.title} onChange={e=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,title:e.target.value}:x))} placeholder="タスク名"
                            style={{ flex:"2 1 140px", minWidth:0, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }} />
                          <div style={{ flex:"1 1 80px", minWidth:0, display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
                            {(selProjObj?.members||[]).length === 0 ? (
                              <input value={t.assignee||""} onChange={e=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,assignee:e.target.value}:x))} placeholder="👤 担当者"
                                style={{ flex:1, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }} />
                            ) : (selProjObj?.members||[]).map(m => {
                              const sel = (t.assigneeIds||[]).includes(m.id);
                              return <button key={m.id} type="button" onClick={()=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,assigneeIds:sel?(x.assigneeIds||[]).filter(id=>id!==m.id):[...(x.assigneeIds||[]),m.id]}:x))}
                                style={{ padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:700, background:sel?C.sage:"transparent", color:sel?"#fff":C.muted, border:`1.5px solid ${sel?C.sage:C.border}`, cursor:"pointer", whiteSpace:"nowrap" }}>
                                {sel?"✓ ":""}{m.name}
                              </button>;
                            })}
                          </div>
                          <input type="date" value={t.dueDate} onChange={e=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,dueDate:e.target.value}:x))}
                            style={{ flex:"1 1 110px", minWidth:0, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }} />
                          <select value={t.priority} onChange={e=>setExtracted(ex=>ex.map(x=>x.id===t.id?{...x,priority:e.target.value}:x))}
                            style={{ flex:"1 1 60px", minWidth:0, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", fontSize:12, background:C.surface, color:C.text, outline:"none", boxSizing:"border-box" }}>
                            <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                  <span style={{ fontSize:12, color:C.muted }}>
                    決定事項 {extractedDecisions.filter(d=>d.selected).length}/{extractedDecisions.length}件　タスク {extracted.filter(t=>t.selected).length}/{extracted.length}件
                  </span>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>{approveBoth();}} style={{...BTN.primaryLg}}>
                      ✅ 承認して保存
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step==="save"&&(
              <div style={{ background:C.surface, borderRadius:16, padding:24, border:`1.5px solid ${C.border}` }}>
                <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
                  <button onClick={()=>setStep(prevStep)} style={btn({fontSize:12,color:C.muted,background:"transparent"})}>← 戻る</button>
                </div>
                <div style={{ textAlign:"center", marginBottom:24 }}>
                  <div style={{ fontSize:40, marginBottom:8 }}>🎉</div>
                  {savedType==="decisions" ? (
                    <>
                      <div style={{ fontSize:16, fontWeight:900, color:C.text, marginBottom:4 }}>決定事項を保存しました！</div>
                      <div style={{ fontSize:13, color:C.muted }}><strong style={{color:selProjObj?.color}}>{selProjObj?.name}</strong> の決定事項ページに追加されました。</div>
                    </>
                  ) : savedType==="tasks" ? (
                    <>
                      <div style={{ fontSize:16, fontWeight:900, color:C.text, marginBottom:4 }}>タスクを登録しました！</div>
                      <div style={{ fontSize:13, color:C.muted }}><strong style={{color:selProjObj?.color}}>{selProjObj?.name}</strong> のカンバンにタスクが追加されました。</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:16, fontWeight:900, color:C.text, marginBottom:4 }}>保存しました！</div>
                      <div style={{ fontSize:13, color:C.muted }}><strong style={{color:selProjObj?.color}}>{selProjObj?.name}</strong> に議事録を保存しました。</div>
                    </>
                  )}
                </div>
                {saveMsg&&<div style={{ background:C.sageLight, border:`1.5px solid ${C.sage}`, borderRadius:10, padding:"10px 14px", fontSize:12, color:C.sage, fontWeight:600, marginBottom:16 }}>✓ {saveMsg}</div>}
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                  <button onClick={reset} style={btn({padding:"10px 22px",borderRadius:10,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:13,fontWeight:700})}>＋ 新しい議事録を作成</button>
                </div>
              </div>
            )}
      </div>
    </div>
  );
}


export { MinutesPage, detectCurrentPhase, TRANSCRIPTION_SYSTEM_PROMPT, STEPS, STEP_LABELS, STEPS_WITH_TRANSCRIPT, STEP_LABELS_WITH_TRANSCRIPT };
