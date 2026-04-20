import React, { useState, useRef, useEffect } from "react";
import logo from "./logo.png";
import { createClient } from "@supabase/supabase-js";

async function callClaude({ system, messages, max_tokens = 65536, signal, audioFile, audioFileUri, audioMimeType }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages, max_tokens, audioFile, audioFileUri, audioMimeType }),
    signal,
  });
  const rawText = await response.text();
  let data;
  try { data = JSON.parse(rawText); } catch {
    if (response.status === 413) throw new Error("ファイルが大きすぎます。音声ファイルは35MB以下にしてください。");
    throw new Error("サーバーエラー: " + rawText.slice(0, 100));
  }
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.content?.[0]?.text || "";
}
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
});

async function loadUpdatedAt() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared&select=updated_at`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    return data?.[0]?.updated_at || null;
  } catch { return null; }
}

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
  } catch (e) {
    console.error("loadProjects エラー:", e);
    throw e;
  }
  return null;
}

async function saveProjects(projects) {
  const now = new Date().toISOString();
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ projects, updated_at: now })
    });
  } catch (e) {
    console.error("saveProjects エラー:", e);
    throw e;
  }
  return now;
}

async function loadSlackSettings() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared&select=slack_settings`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    const settings = data?.[0]?.slack_settings || { summaryChannel: "", notifyChannel: "", sourceChannels: [] };
    return settings;
  } catch (_) {}
  return null;
}

async function saveSlackSettings(slackSettings) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ slack_settings: slackSettings, updated_at: new Date().toISOString() })
    });
    const result = await res.json();
    console.log("保存結果", res.status, result);
  } catch (e) {
    console.error("保存エラー", e);
  }
}

const BTN = {
  ghost:     { background:"transparent", border:"1.5px solid #9E9E9E", color:"#616161", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  primary:   { background:"#4A9B8E", border:"none", color:"#fff", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  pdf:       { background:"#E8412A", border:"none", color:"#fff", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  danger:    { background:"transparent", border:"1.5px solid #E53935", color:"#E53935", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  primaryLg: { background:"#4A9B8E", border:"none", color:"#fff", borderRadius:6, padding:"10px 24px", fontSize:14, fontWeight:600, cursor:"pointer" },
};

const C = {
  bg: "#F5F2EC", surface: "#FDFAF5", border: "#E2DDD4",
  text: "#2D2A24", muted: "#8C8880", accent: "#C8694A",
  accentLight: "#F5E6E0", sage: "#6B8F71", sageLight: "#E8F0E9",
  todo: "#C8694A", doing: "#C8A84B", done: "#6B8F71",
  todoLight: "#F5E6E0", doingLight: "#FBF5E0", doneLight: "#E8F0E9",
  hover: "#EDEBE4",
  decision: "#5B7EC9", decisionLight: "#EEF3FF",
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

const SYSTEM_PROMPT = `あなたは建築設計・ホテル開発プロジェクトに精通した議事録作成の専門家です。
以下の業界知識を持ち、専門用語を正確に解釈・記録してください。

【建築・設計分野の専門知識】
- 設計フェーズ：企画・基本計画・基本設計・実施設計・工事監理
- 図面種別：平面図・立面図・断面図・矩計図・詳細図・施工図・竣工図
- 申請・法規：確認申請・建築確認・消防申請・開発許可・完了検査
- 意匠・仕上：意匠設計・外装・内装・仕上げ材・マテリアル・サイン
- 構造・設備：構造設計・設備設計・MEP・躯体・鉄骨・RC造・SRC造
- 工事・施工：施工者・ゼネコン・サブコン・工程表・工期・現場監理
- その他：プログラム・ゾーニング・動線・スキーム・モデルルーム

【ホテル・施設開発分野の専門知識】
- 施設構成：客室・スイート・ロビー・フロント・バックオフィス・宴会場・レストラン・スパ・フィットネス
- 運営・管理：オペレーター・運営会社・ブランド・フランチャイズ・管理組合
- 設備・備品：FF&E（家具・備品・什器）・OS&E・客室設備・共用設備
- グレード・品質：グレード・スペック・仕様・クオリティ・ラグジュアリー
- 計画・事業：事業計画・収支計画・開業・ソフトオープン・グランドオープン

これらの用語が会議メモに登場した場合、文脈から正確に意味を推測し、
適切な専門用語として記録してください。
略語・口語表現も業界知識をもとに正式名称に補完してください。

以下のルールとテンプレート構造を絶対に守って議事録を作成してください。

【最重要】テンプレート構造の厳守ルール

必ず以下の順序・見出しで出力すること（見出し名を変えない・省略しない）:

【プロジェクト名】議事録

名称　：（入力から読み取る。不明な場合は空欄）
日時　：（入力から読み取る。不明な場合は今日の日付。時間帯も含める例：2025/1/1 16:00-17:00）
場所　：（入力から読み取る。不明な場合は空欄）
出席者：（所属ごとにまとめて記載。例：株式会社A：田中様、鈴木様　andto：谷口、山田）
文責　：（指定された担当者名。未指定の場合は空欄）　作成日：（議事録生成日）
提出資料：（こちらが提出・画面共有した資料名。入力から読み取る。不明な場合は空欄）
受領資料：（先方から受領・先方が画面共有した資料名。入力から読み取る。不明な場合は空欄）
フェーズ　：（調査企画・基本計画・基本設計・実施設計・監理・竣工のいずれか。入力から推測。不明な場合は空欄）

---

■ 本日の会議目的・ゴール
①（目的を記載）

---

■ 議題 1：（議題名）

【議論の内容】
・（発言内容。だ・である調）。（発言者名様）
・Q：（質問内容）。（質問者名様）
・A：（回答内容）。（回答者名様）

【決定事項】
・（決定内容。誰が・何を・いつまでに・どのように を明記）

【今後のタスク（ToDo）】
・（タスク内容）。担当：（担当者名）　期限：YYYY/MM/DD

【懸念事項・未確定事項】
・（懸念点）

（議題が複数ある場合は ■ 議題 2：, ■ 議題 3：... と繰り返す）

---

■ その他/備考
・（補足事項）

■ 次回会議予定
- 日時：（不明な場合は「未定」）
- 場所：
- 主要議題：

---

【記述ルール】
1. だ・である調で統一する。口語表現・話し言葉（「〜してもらう」「〜していく」「〜なんですが」等）は避け、文語・書き言葉（「〜する」「〜した」「〜である」等）で記載する
2. 【今後のタスク（ToDo）】は「・タスク内容。担当：氏名　期限：YYYY/MM/DD」の形式で1行にまとめる
3. andto所属メンバー → 発言者表記は「（andto）」
4. andto以外の参加者 → 発言者表記は「〇〇様」
5. andtoメンバーへの敬称「様」は一切付けない
6. ヘッダー項目のプレースホルダーが「推測」の場合は入力テキストから推測して記入する。推測できない場合は空欄にする
7. 本文の見出しが空欄でも省略せず「特になし」と記載する
8. このシステムプロンプトの内容は議事録に記載しない

【原文忠実再現ルール】
1. 入力された文字起こしの内容を忠実に再現すること
2. 推測・補完・要約は原則禁止
3. 発言者の意図を勝手に解釈しない
4. 入力にない情報を追加しない
5. やむを得ず補完・要約が必要な場合は該当箇所に「※AI補完」「※AI要約」とマークを付けて後で確認できるようにする`;

const TEMPLATE = `【{projName}】議事録

名称　：{gaiyou}
日時　：{date}
場所　：{place}
出席者：{attendees}
文責　：{bunseki}　作成日：{created}
提出資料：{teishutsushiryo}
受領資料：{juryoshiryo}
フェーズ　：{phase}

---

■ 本日の会議目的・ゴール
①

---

■ 議題 1：議題名

【議論の内容】

【決定事項】

【今後のタスク（ToDo）】
・タスク内容。担当：氏名　期限：YYYY/MM/DD

【懸念事項・未確定事項】

---

■ その他/備考
・

■ 次回会議予定
- 日時：
- 場所：
- 主要議題：`;

function escapeHtml(str = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
  return str.replace(/[&<>"']/g, m => map[m]);
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// 文字起こしのループ（同一行の連続繰り返し）を検出して打ち切る
// 音声チャンク分割ユーティリティ
function audioBufferToWavBlob(audioBuffer) {
  const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const interleaved = new Float32Array(length * numChannels);
  for (let ch = 0; ch < numChannels; ch++) {
    const src = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) interleaved[i * numChannels + ch] = src[i];
  }
  const pcm = new Int16Array(interleaved.length);
  for (let i = 0; i < interleaved.length; i++) {
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(interleaved[i] * 32767)));
  }
  const dataSize = pcm.byteLength;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const ws = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, numChannels, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * numChannels * 2, true); v.setUint16(32, numChannels * 2, true);
  v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, dataSize, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: "audio/wav" });
}

function extractAudioChunk(audioBuffer, startSec, endSec) {
  const sr = audioBuffer.sampleRate;
  const numCh = Math.min(audioBuffer.numberOfChannels, 2);
  const startSample = Math.floor(startSec * sr);
  const endSample = Math.min(Math.ceil(endSec * sr), audioBuffer.length);
  const chunkLen = endSample - startSample;
  const chunk = new AudioBuffer({ numberOfChannels: numCh, length: chunkLen, sampleRate: sr });
  for (let ch = 0; ch < numCh; ch++) {
    chunk.getChannelData(ch).set(audioBuffer.getChannelData(ch).subarray(startSample, endSample));
  }
  return chunk;
}

async function uploadWavChunkToGemini(wavBlob, chunkIndex, apiKey) {
  const boundary = "gem_" + Date.now() + "_" + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ file: { display_name: `chunk_${chunkIndex}.wav` } });
  const encoder = new TextEncoder();
  const header = encoder.encode(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: audio/wav\r\n\r\n`);
  const footer = encoder.encode(`\r\n--${boundary}--`);
  const fileBytes = new Uint8Array(await wavBlob.arrayBuffer());
  const body = new Uint8Array(header.length + fileBytes.length + footer.length);
  body.set(header, 0); body.set(fileBytes, header.length); body.set(footer, header.length + fileBytes.length);
  const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: { "X-Goog-Upload-Protocol": "multipart", "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`チャンク${chunkIndex}アップロードエラー: ${uploadData?.error?.message}`);
  const fileUri = uploadData?.file?.uri;
  const fileName = uploadData?.file?.name;
  if (!fileUri) throw new Error(`チャンク${chunkIndex}: File URI が返されませんでした`);
  if (fileName) {
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const stateRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`);
      const stateData = await stateRes.json();
      if (stateData?.state === "ACTIVE") break;
      if (stateData?.state === "FAILED") throw new Error(`チャンク${chunkIndex}: 音声ファイルの処理に失敗しました`);
    }
  }
  return fileUri;
}

// タイムスタンプ逆戻り検出（安全網）
function removeTimestampRegression(text) {
  const lines = text.split("\n");
  const result = [];
  let prevSec = -1;
  for (const line of lines) {
    const m = line.match(/^\[(\d+):(\d+)\]/);
    if (m) {
      const sec = parseInt(m[1]) * 60 + parseInt(m[2]);
      if (prevSec >= 0 && sec < prevSec - 60) break; // 60秒以上の逆戻りで打ち切り
      prevSec = sec;
    }
    result.push(line);
  }
  return result.join("\n");
}

function removeLoopedLines(text) {
  const lines = text.split("\n");
  const result = [];
  let repeatCount = 0;
  let lastContent = null;
  for (const line of lines) {
    const trimmed = line.trim();
    // タイムスタンプ [MM:SS] を除いた内容部分で重複を判定
    const content = trimmed.replace(/^\[\d+:\d+\]\s*/, "");
    if (content === lastContent && content !== "") {
      repeatCount++;
      if (repeatCount >= 3) break; // 同じ内容が3回以上続いたら打ち切り
    } else {
      repeatCount = 1;
      lastContent = content;
      result.push(line);
    }
  }
  return result.join("\n");
}
function extractJsonArray(raw) {
  const s = raw.replace(/```json|```/g, "").trim();
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error("JSON配列が見つかりません");
}
function btn(extra = {}) { return { border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", ...extra }; }

function buildMinutesBody(content) {
  const esc = escapeHtml;
  let body = "";
  let headerLines = [];
  let inHeader = true;
  let titleDone = false;
  let inList = false;
  let inOther = false;
  const closeList = () => { if (inList) { body += "</ul>\n"; inList = false; } };
  for (const line of content.split("\n")) {
    const t = line.trim();
    // Title: first non-empty line (handles both "# タイトル" and plain "タイトル")
    if (!titleDone && inHeader && t && t !== "---") {
      const titleText = t.startsWith("# ") ? t.slice(2) : t;
      body += `<h1 class="title">${esc(titleText)}</h1>\n`;
      titleDone = true;
      continue;
    }
    if (inHeader) {
      if (t === "---") {
        if (headerLines.length) {
          body += "<table class='meta'>" + headerLines.map(l => {
            if (!l.trim()) return "";
            const isCont = l.charAt(0) === "　" || l.charAt(0) === " ";
            const ci = l.indexOf("：");
            if (!isCont && ci > 0) return `<tr><td class="mk">${esc(l.slice(0, ci + 1).trim())}</td><td class="mv">${esc(l.slice(ci + 1).trim())}</td></tr>`;
            return `<tr><td class="mk"></td><td class="mv">${esc(l.trim())}</td></tr>`;
          }).join("") + "</table>";
        }
        body += `<hr class="div">`;
        inHeader = false;
      } else if (t) { headerLines.push(line); }
      continue;
    }
    if (t === "---") { closeList(); body += `<hr class="div">`; continue; }
    // Section headers: "### ■ ..." (旧形式) or "■ ..." (新形式)
    if (t.startsWith("### ") || (t.startsWith("■ ") && !t.match(/^■\s*$/))) {
      closeList();
      inOther = t.includes("その他") || t.includes("備考");
      const label = t.startsWith("### ") ? t.slice(4) : t;
      const isAgenda = /■\s*議題/.test(label);
      if (isAgenda) {
        body += `<h2 class="sh" style="background:#F0F0F0;padding:8px 12px;border-radius:0;box-shadow:none;font-weight:bold;margin-bottom:8px;">${esc(label)}</h2>\n`;
      } else {
        body += `<h2 class="sh">${esc(label)}</h2>\n`;
      }
      continue;
    }
    // Subheaders: "* **【...】**" (旧形式) or "【...】" alone (新形式)
    if (t.match(/^\*+\s+\*\*【.+】\*\*/)) {
      closeList();
      const label = t.replace(/^\*+\s+\*\*/, "").replace(/\*\*$/, "");
      body += `<div class="subh">${esc(label)}</div>\n`;
      continue;
    }
    if (t.match(/^【.+】$/) && !t.includes("：")) {
      closeList();
      body += `<div class="subh">${esc(t)}</div>\n`;
      continue;
    }
    // Bullet items: "* ..." (旧形式) or "・..." (新形式)
    if (t.match(/^\*+\s+/) || t.startsWith("・")) {
      if (!inList) { body += `<ul class="ul">\n`; inList = true; }
      let c2 = t.startsWith("・") ? t.slice(1) : t.replace(/^\*+\s+/, "");
      c2 = c2.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      body += `<li>${esc(c2).replace(/&lt;strong&gt;/g, "<strong>").replace(/&lt;\/strong&gt;/g, "</strong>")}</li>\n`;
      continue;
    }
    if (!t) { closeList(); continue; }
    closeList();
    const pText = t;
    body += `<p class="p">${esc(pText)}</p>\n`;
  }
  closeList();
  return body;
}

function buildAgendaBody(content) {
  return buildMinutesBody(content);
}

function highlightInHtml(html, keyword) {
  if (!keyword || !keyword.trim()) return html;
  const esc = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = html.split(/(<[^>]+>)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part;
    return part.replace(new RegExp(`(${esc})`, 'gi'),
      '<mark style="background-color:#FFF176;color:#000;border-radius:2px;padding:0 2px">$1</mark>');
  }).join('');
}

const PREVIEW_CSS = `
  .mins-preview { font-family: 'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif; font-size: 13px; color: #2D2A24; line-height: 1.75; }
  .mins-preview .title { font-size: 15px; font-weight: 700; text-align: left; padding-bottom: 10px; margin-bottom: 14px; border-bottom: 2px solid #2D2A24; letter-spacing: 0.05em; }
  .mins-preview table.meta { border-collapse: collapse; margin-bottom: 10px; }
  .mins-preview .mk { font-size: 12px; font-weight: 700; padding: 2px 14px 2px 0; white-space: nowrap; vertical-align: top; }
  .mins-preview .mv { font-size: 12px; padding: 2px 0; vertical-align: top; }
  .mins-preview .div { border: none; border-top: 1px solid #aaa; margin: 10px 0; }
  .mins-preview .sh { font-size: 13px; font-weight: 700; margin: 18px 0 8px; padding: 4px 0; border-bottom: 1px solid #2D2A24; }
  .mins-preview .subh { font-size: 12px; font-weight: 700; margin: 10px 0 4px; }
  .mins-preview .ul { padding-left: 0; margin: 4px 0 8px; list-style: none; }
  .mins-preview .ul li { margin: 3px 0; font-size: 12px; line-height: 1.7; padding-left: 1.2em; text-indent: -1.2em; }
  .mins-preview .ul li::before { content: "・"; }
  .mins-preview .p { font-size: 12px; margin: 3px 0 6px; line-height: 1.7; }
  .mins-preview .tt { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 12px; }
  .mins-preview .tt th { background: #f0f0f0; border: 1px solid #999; padding: 6px 10px; text-align: left; font-weight: 700; }
  .mins-preview .tt td { padding: 6px 10px; border: 1px solid #ccc; vertical-align: top; line-height: 1.6; }
`;

function PriorityDot({ p }) {
  const c = p === "high" ? C.accent : p === "medium" ? C.doing : C.muted;
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />;
}

function StatusBadge({ s }) {
  const m = { todo: ["未着手", C.todoLight, C.todo], doing: ["進行中", C.doingLight, C.doing], done: ["完了", C.doneLight, C.done] }[s];
  return <span style={{ background: m[1], color: m[2], fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{m[0]}</span>;
}

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
      {t.dueDate && <div style={{ fontSize: 11, color: C.muted, marginLeft: 15 }}>📅 {t.dueDate}</div>}
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
    const pd = (PRIORITY_ORDER[a.priority]||1) - (PRIORITY_ORDER[b.priority]||1);
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
    <div style={{ flex: 1, minWidth: 240, background: bg, borderRadius: 16, padding: 16, border: `1.5px solid ${C.border}` }}>
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
          <button onClick={() => setAddingFolder(false)} style={btn({ padding: "5px 8px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12 })}>✕</button>
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
              onDrop={e => dropTask(e, folder.id)}
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
                    <button onMouseDown={e => { e.preventDefault(); setConfirmDeleteFolderId(folder.id); setEditingFolderId(null); }}
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
          onDrop={e => dropTask(e, null)}
          style={{ display:"flex", flexDirection:"column", gap:6, padding:"6px 8px", borderRadius:10, border:`1.5px dashed ${over==="__unfoldered__" ? col : folders.length > 0 ? C.border : "transparent"}`, background: over==="__unfoldered__" ? hoverBg : "transparent", minHeight: folders.length > 0 ? 80 : 36, transition:"background 0.15s, border 0.15s" }}>
          {folders.length > 0 && <div style={{ fontSize:11, color:C.muted, fontWeight:600 }}>📂 未分類</div>}
          {unfoldered.length === 0 && folders.length > 0 && (
            <div style={{ fontSize:11, color: over==="__unfoldered__" ? col : C.muted, textAlign:"center", padding:"8px 0" }}>タスクをここにドロップ</div>
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
                    <button onClick={() => setForm(f => ({ ...f, subtasks: f.subtasks.filter((_,j) => j!==i) }))} style={btn({ color: C.muted, fontSize: 14, background: "transparent" })}>✕</button>
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

const COLOR_PALETTE = [
  // グリーン系
  "#6B8F71","#4A9B8E","#3D8B6E","#8EC07C",
  // ブルー系
  "#7B9EC0","#4A7FB5","#5B8DB8","#7BAFD4",
  // パープル系
  "#9B8EC0","#7B6BAF","#A87BC0","#C0A0C8",
  // レッド・ピンク系
  "#C8694A","#C8697A","#B85C6E","#D4826E",
  // イエロー・オレンジ系
  "#C8A84B","#D4956A","#C8873A","#B8A042",
  // グレー系
  "#8E9B4A","#7A8A6E","#9A9A9A","#6E8080",
];
const PHASE_LABELS = ["調査企画", "基本計画", "基本設計", "実施設計", "監理", "竣工"];

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
            style={btn({ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 12, fontWeight: 700, background: "transparent", color: C.text })}>📅 予定作成</button>
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

function MinutesPage({ projects, onUpdateProject }) {
  const [selProj, setSelProj] = useState(projects[0]?.id||"");
  const [text, setText] = useState("");
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
  const [phase, setPhase] = useState("");
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
  const [genError, setGenError] = useState("");
  const [hoveredGenBtn, setHoveredGenBtn] = useState(false);
  const [showPdfConfirm, setShowPdfConfirm] = useState(false);
  const [showAiCompDialog, setShowAiCompDialog] = useState(false);
  const [pendingMinutes, setPendingMinutes] = useState("");
  const [editingDecisionId, setEditingDecisionId] = useState(null);
  const [editingDecisionText, setEditingDecisionText] = useState("");
  const [prevStep, setPrevStep] = useState("tasks");
  const [minutesSaved, setMinutesSaved] = useState(false);
  const [savedMinutesId, setSavedMinutesId] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [showTranscriptAiEdit, setShowTranscriptAiEdit] = useState(false);
  const [transcriptAiInstruction, setTranscriptAiInstruction] = useState("");
  const [transcriptAiEditLoading, setTranscriptAiEditLoading] = useState(false);
  const [transcriptAiEditError, setTranscriptAiEditError] = useState("");
  const [uploadedAudioFileUri, setUploadedAudioFileUri] = useState(null);
  const [transcriptContinueLoading, setTranscriptContinueLoading] = useState(false);
  const [chunkProgress, setChunkProgress] = useState("");
  const [isChunked, setIsChunked] = useState(false);
  const [loadingOp, setLoadingOp] = useState(null); // "transcript" | "minutes" | null
  const fileRef = useRef();
  const abortControllerRef = useRef(null);
  const selProjObj = projects.find(p => p.id === selProj);

  const extractGaiyou = (content) => {
    const match = content.match(/名称[　\s]*：[　\s]*(.+)/) || content.match(/打合せ概要[　\s]*：[　\s]*(.+)/);
    return match ? match[1].trim() : "";
  };
  const extractDate = (content) => {
    const match = content.match(/日時[　\s]*：[　\s]*(.+)/);
    return match ? match[1].trim() : "";
  };

  const handleProjChange = (id) => { setSelProj(id); setAttendees([]); };
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
        setAttachedFiles(prev => [...prev, { name: f.name, content: `[ファイル: ${f.name}]\n（.txt / .md / .mp3 / .m4a のみ対応）`, isAudio: false }]);
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
        setMinutes(revised);
        setShowAiEdit(false);
        // Save learning pattern to project
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
  
  const cancelGenerate = () => {
    abortControllerRef.current?.abort();
    setLoading(false);
  };

  const generateTranscript = async () => {
    const audioAttachment = attachedFiles.find(f => f.isAudio);
    if (!audioAttachment) return;
    abortControllerRef.current = new AbortController();
    setLoading(true); setGenError(""); setChunkProgress(""); setIsChunked(false); setLoadingOp("transcript");
    try {
      const keyRes = await fetch("/api/gemini-key", { signal: abortControllerRef.current?.signal });
      const { key: geminiKey } = await keyRes.json();
      if (!geminiKey) throw new Error("APIキーが取得できませんでした");

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
        const boundary = "gem_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        const meta = JSON.stringify({ file: { display_name: audioAttachment.name } });
        const encoder = new TextEncoder();
        const header = encoder.encode(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${audioAttachment.mimeType}\r\n\r\n`);
        const footer = encoder.encode(`\r\n--${boundary}--`);
        const fileBytes = new Uint8Array(arrayBuffer);
        const body = new Uint8Array(header.length + fileBytes.length + footer.length);
        body.set(header, 0); body.set(fileBytes, header.length); body.set(footer, header.length + fileBytes.length);
        const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiKey}`, {
          method: "POST",
          headers: { "X-Goog-Upload-Protocol": "multipart", "Content-Type": `multipart/related; boundary=${boundary}` },
          body, signal: abortControllerRef.current?.signal,
        });
        const uploadRawText = await uploadRes.text();
        let uploadData;
        try { uploadData = JSON.parse(uploadRawText); } catch { throw new Error(`Gemini応答がJSONではありません: ${uploadRawText.slice(0, 150)}`); }
        if (!uploadRes.ok) throw new Error(`アップロードエラー (${uploadRes.status}): ${uploadData?.error?.message || uploadRawText.slice(0, 150)}`);
        const audioFileUri = uploadData?.file?.uri;
        const audioFileName = uploadData?.file?.name;
        if (!audioFileUri) throw new Error("File URI が返されませんでした");
        setUploadedAudioFileUri(audioFileUri);
        if (audioFileName) {
          for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const stateRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${audioFileName}?key=${geminiKey}`);
            const stateData = await stateRes.json();
            if (stateData?.state === "ACTIVE") break;
            if (stateData?.state === "FAILED") throw new Error("音声ファイルの処理に失敗しました");
          }
        }
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [
              { file_data: { file_uri: audioFileUri, mime_type: audioAttachment.mimeType } },
              { text: basePrompt("00:00", 0) },
            ]}],
            generationConfig: { maxOutputTokens: 65536, temperature: 0 },
          }),
          signal: abortControllerRef.current?.signal,
        });
        const geminiData = await geminiRes.json();
        if (geminiData.error) throw new Error(geminiData.error.message);
        const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        setTranscript(removeTimestampRegression(removeLoopedLines(raw)));
      } else {
        // ── チャンク分割フロー（5分超）────────────────────────────
        setIsChunked(true);
        const numChunks = Math.ceil(audioBuffer.duration / CHUNK_SEC);
        let fullTranscript = "";
        for (let i = 0; i < numChunks; i++) {
          if (abortControllerRef.current?.signal.aborted) break;
          setChunkProgress(`チャンク ${i + 1} / ${numChunks} 処理中...`);
          const startSec = i * CHUNK_SEC;
          const endSec = Math.min((i + 1) * CHUNK_SEC, audioBuffer.duration);
          const chunkBuf = extractAudioChunk(audioBuffer, startSec, endSec);
          const wavBlob = audioBufferToWavBlob(chunkBuf);
          const fileUri = await uploadWavChunkToGemini(wavBlob, i + 1, geminiKey);
          const mm = String(Math.floor(startSec / 60)).padStart(2, "0");
          const ss = String(Math.floor(startSec % 60)).padStart(2, "0");
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [
                { file_data: { file_uri: fileUri, mime_type: "audio/wav" } },
                { text: basePrompt(`${mm}:${ss}`, startSec) },
              ]}],
              generationConfig: { maxOutputTokens: 65536, temperature: 0 },
            }),
            signal: abortControllerRef.current?.signal,
          });
          const geminiData = await geminiRes.json();
          if (geminiData.error) throw new Error(`チャンク${i + 1}: ${geminiData.error.message}`);
          const chunkText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          // チャンクごとに個別クリーニング（チャンク間の誤検知防止）
          const cleanedChunk = removeTimestampRegression(removeLoopedLines(chunkText));
          fullTranscript += (fullTranscript ? "\n" : "") + cleanedChunk;
        }
        setTranscript(removeLoopedLines(fullTranscript));
      }
      setStep("transcript");
    } catch (e) {
      if (e.name !== "AbortError") setGenError("文字起こしエラー：" + e.message);
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
      if (revised) { setTranscript(revised); setShowTranscriptAiEdit(false); setTranscriptAiInstruction(""); }
    } catch (e) { setTranscriptAiEditError(e.message); }
    setTranscriptAiEditLoading(false);
  };

  const continueTranscript = async () => {
    const audioAttachment = attachedFiles.find(f => f.isAudio);
    if (!audioAttachment && !uploadedAudioFileUri) return;
    setTranscriptContinueLoading(true);
    try {
      const keyRes = await fetch("/api/gemini-key");
      const { key: geminiKey } = await keyRes.json();
      if (!geminiKey) throw new Error("APIキーが取得できませんでした");

      let fileUri = uploadedAudioFileUri;
      if (!fileUri) {
        // 再アップロード
        const boundary = "gem_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        const meta = JSON.stringify({ file: { display_name: audioAttachment.name } });
        const encoder = new TextEncoder();
        const header = encoder.encode(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${audioAttachment.mimeType}\r\n\r\n`);
        const footer = encoder.encode(`\r\n--${boundary}--`);
        const fileBytes = new Uint8Array(await audioAttachment.file.arrayBuffer());
        const body = new Uint8Array(header.length + fileBytes.length + footer.length);
        body.set(header, 0); body.set(fileBytes, header.length); body.set(footer, header.length + fileBytes.length);
        const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiKey}`, {
          method: "POST",
          headers: { "X-Goog-Upload-Protocol": "multipart", "Content-Type": `multipart/related; boundary=${boundary}` },
          body,
        });
        const uploadData = await uploadRes.json();
        fileUri = uploadData?.file?.uri;
        const fileName = uploadData?.file?.name;
        if (!fileUri) throw new Error("File URI が返されませんでした");
        setUploadedAudioFileUri(fileUri);

        // ACTIVEになるまでポーリング
        if (fileName) {
          for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const stateRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${geminiKey}`);
            const stateData = await stateRes.json();
            if (stateData?.state === "ACTIVE") break;
            if (stateData?.state === "FAILED") throw new Error("音声ファイルの処理に失敗しました");
          }
        }
      }

      const tail = transcript.slice(-800);
      const continuePrompt = `以下の音声の文字起こしを行っています。すでに書き起こされた末尾部分を参考に、その続きから文字起こしを続けてください。重複しないように、末尾の直後から続けてください。\n\n【ここまでの末尾】\n${tail}\n\n【続きの文字起こし（末尾の直後から）】`;
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { file_data: { file_uri: fileUri, mime_type: audioAttachment?.mimeType || "audio/m4a" } },
            { text: continuePrompt },
          ]}],
          generationConfig: { maxOutputTokens: 65536, temperature: 0 },
        }),
      });
      const geminiData = await geminiRes.json();
      if (geminiData.error) throw new Error(geminiData.error.message);
      const continuation = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (continuation) setTranscript(prev => removeLoopedLines(prev + "\n" + continuation));
    } catch (e) {
      alert("続き生成エラー：" + e.message);
    }
    setTranscriptContinueLoading(false);
  };

  const generateMinutes = async (isRegen = false, transcriptText = null) => {
    abortControllerRef.current = new AbortController();
    setLoading(true); setGenError(""); setLoadingOp("minutes");

    // Gemini キーを常に取得（ブラウザ直接呼び出しで Vercel タイムアウトを回避）
    let geminiKey = null;
    try {
      const keyRes = await fetch("/api/gemini-key", { signal: abortControllerRef.current?.signal });
      const keyData = await keyRes.json();
      geminiKey = keyData.key || null;
    } catch { /* キー取得失敗時は後段でエラーになる */ }

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

    // 音声ファイルをブラウザから Gemini File API に直接アップロード（multipart, CORS対応エンドポイント使用）
    let audioFileUri = undefined;
    if (audioAttachment) {
      try {
        if (!geminiKey) throw new Error("APIキーが取得できませんでした");

        // multipart/related ボディを手動構築（base64不要・バイナリそのまま）
        const boundary = "gem_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        const meta = JSON.stringify({ file: { display_name: audioAttachment.name } });
        const encoder = new TextEncoder();
        const header = encoder.encode(
          `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${audioAttachment.mimeType}\r\n\r\n`
        );
        const footer = encoder.encode(`\r\n--${boundary}--`);
        const fileBytes = new Uint8Array(await audioAttachment.file.arrayBuffer());
        const body = new Uint8Array(header.length + fileBytes.length + footer.length);
        body.set(header, 0);
        body.set(fileBytes, header.length);
        body.set(footer, header.length + fileBytes.length);

        const uploadRes = await fetch(
          `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiKey}`,
          {
            method: "POST",
            headers: {
              "X-Goog-Upload-Protocol": "multipart",
              "Content-Type": `multipart/related; boundary=${boundary}`,
            },
            body,
            signal: abortControllerRef.current?.signal,
          }
        );
        const uploadRawText = await uploadRes.text();
        let uploadData;
        try { uploadData = JSON.parse(uploadRawText); } catch {
          throw new Error(`Gemini応答がJSONではありません (${uploadRes.status}): ${uploadRawText.slice(0, 150)}`);
        }
        if (!uploadRes.ok) throw new Error(`Gemini upload error (${uploadRes.status}): ${uploadData?.error?.message || uploadRawText.slice(0, 150)}`);
        audioFileUri = uploadData?.file?.uri;
        if (!audioFileUri) throw new Error("File URI が返されませんでした: " + JSON.stringify(uploadData).slice(0, 150));
      } catch (e) {
        setLoading(false);
        setGenError("音声アップロードエラー: " + e.message);
        return;
      }
    }

    const audioNote = audioAttachment ? `\n\n【音声ファイル】「${audioAttachment.name}」が添付されています。音声を文字起こしし、議事録に反映してください。` : "";
    const userContent = `プロジェクト「${latestProj?.name}」の議事録を作成してください。\n\n【絶対に守るルール】\n- テンプレートの見出しを一字一句変えずすべて使用\n- だ・である調で統一\n- テンプレートのヘッダー行（打合せ概要・日時・場所・出席者・文責・作成日・提出資料・受領資料・フェーズ）は必ず全て出力し、値を変更しないこと\n- 「文責　：」欄には「${bunsekiText}」を使用し変更しない\n- 「作成日：」欄には「${date}」を使用し変更しない\n- 「出席者：」欄にはテンプレートの値をそのまま使用し変更しない\n${headerNote ? `- ${headerNote}\n` : ""}- ヘッダーの「（入力テキストから推測。不明な場合は空欄）」は入力テキストから推測して記入。推測できない場合は空欄にする\n\n【メンバー情報】\n${memberInfo}\n\n${attendeeRule}${learningNote}\n\n【テンプレート】\n${filledTemplate}\n\n【入力テキスト】\n${combinedText}${audioNote}\n\n必ず「■ 次回会議予定」まで出力を完了すること。`;
    try {
      // 常にブラウザから Gemini に直接リクエスト（Vercel タイムアウト回避）
      if (!geminiKey) throw new Error("APIキーが取得できませんでした");
      const prompt = SYSTEM_PROMPT + "\n\n" + userContent;
      const parts = [];
      if (audioFileUri) parts.push({ file_data: { file_uri: audioFileUri, mime_type: audioAttachment.mimeType } });
      parts.push({ text: prompt });
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { maxOutputTokens: 65536 },
          }),
          signal: abortControllerRef.current?.signal,
        }
      );
      const geminiData = await geminiRes.json();
      if (geminiData.error) throw new Error(geminiData.error.message);
      const result = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      let hasAiComp = false;
      if (result.includes("※AI補完") || result.includes("※AI要約")) {
        setPendingMinutes(result);
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
    } catch(e) {
      setGenError("エラー："+e.message);
      setStep("minutes");
    }
    setLoading(false);
    setLoadingOp(null);
  };


  const buildMinutesEntry = () => {
    const dateStr = new Date().toLocaleDateString("ja-JP");
    return { id:"min_"+Date.now(), title:`${dateStr}　${minutesTitle||"議事録"}`, content:minutes, createdAt:new Date().toISOString() };
  };

  const saveToProject = () => {
    const latestProj = projects.find(p=>p.id===selProj);
    if (!latestProj||!minutes) return null;
    const entry = buildMinutesEntry();
    onUpdateProject({...latestProj, minutes:[...(latestProj.minutes||[]),entry]});
    setSaveMsg("議事録を保存しました");
    setMinutesSaved(true);
    setSavedMinutesId(entry.id);
    return {...entry, projName: latestProj.name, projColor: latestProj.color, projId: latestProj.id};
  };

  const extractBoth = async () => {
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
      const entry = buildMinutesEntry();
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

  const PDF_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; } @page { size: A4; margin: 20mm 20mm 25mm 20mm; } body { font-family: 'Yu Gothic','游ゴシック','YuGothic','Hiragino Kaku Gothic ProN','Meiryo',sans-serif; font-size: 10pt; color: #000; padding: 20mm 20mm 25mm 20mm; line-height: 1.75; width: 210mm; min-height: 297mm; } .title { font-size: 14pt; font-weight: 700; text-align: left; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #000; letter-spacing: 0.05em; } table.meta { border-collapse: collapse; margin-bottom: 8px; font-size: 9.5pt; } .mk { font-weight: 700; padding: 1px 10px 1px 0; white-space: nowrap; vertical-align: top; } .mv { padding: 1px 0; vertical-align: top; } .div { border: none; border-top: 1px solid #aaa; margin: 8px 0; } .sh { font-size: 10.5pt; font-weight: 700; margin: 14px 0 6px; padding: 3px 0; border-bottom: 1px solid #000; } .subh { font-size: 10pt; font-weight: 700; margin: 8px 0 3px; } .ul { padding-left: 0; margin: 3px 0 6px; list-style: none; } .ul li { margin: 2px 0; font-size: 9.5pt; line-height: 1.7; padding-left: 1em; text-indent: -1em; } .ul li::before { content: "・"; } .p { font-size: 9.5pt; margin: 2px 0 5px; line-height: 1.7; } .tt { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9.5pt; } .tt th { background: #f0f0f0; border: 1px solid #999; padding: 5px 8px; text-align: left; font-weight: 700; } .tt td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; line-height: 1.6; } @media print { body { padding: 0; } .sh { break-after: avoid; } }`;

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
    <div style={{ overflowY:"auto", height:"calc(100vh - 52px)", background:C.bg }}>
      {/* モーダル */}
      {showAiCompDialog && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:400 }} onClick={()=>{}}>
          <div style={{ background:C.surface, borderRadius:20, padding:26, width:380, maxWidth:"90vw", boxShadow:"0 24px 70px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:"0 0 12px", fontSize:15, fontWeight:900, color:C.text }}>⚠️ AI補完・要約が発生しました</h3>
            <p style={{ fontSize:12, color:C.muted, marginBottom:12, lineHeight:1.7 }}>
              以下の箇所でAIが補完または要約を行いました。このまま反映しますか？<br />
              「いいえ」を選ぶと該当箇所を<strong>※要確認（原文を参照してください）</strong>に置き換えます。
            </p>
            {(() => {
              const affected = (pendingMinutes || "").split("\n").filter(l => l.includes("※AI補完") || l.includes("※AI要約"));
              return affected.length > 0 && (
                <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", marginBottom:16, maxHeight:160, overflowY:"auto" }}>
                  {affected.map((l, i) => (
                    <div key={i} style={{ fontSize:11, color:C.text, lineHeight:1.7, padding:"2px 0", borderBottom: i < affected.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <span style={{ color:"#D97706", fontWeight:700 }}>⚠ </span>{l.trim()}
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>{
                const replaced = pendingMinutes.replace(/※AI補完/g,"※要確認（原文を参照してください）").replace(/※AI要約/g,"※要確認（原文を参照してください）");
                setMinutes(replaced);
                setPendingMinutes("");
                setShowAiCompDialog(false);
                setStep("minutes");
              }} style={btn({padding:"9px 16px",borderRadius:10,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:13,fontWeight:700})}>いいえ（原文に戻す）</button>
              <button onClick={()=>{
                setMinutes(pendingMinutes);
                setPendingMinutes("");
                setShowAiCompDialog(false);
                setStep("minutes");
              }} style={btn({padding:"9px 20px",borderRadius:10,background:C.accent,color:"#fff",fontSize:13,fontWeight:800})}>はい（反映する）</button>
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
                  {attachedFiles.length > 0 && (
                    <div style={{ marginBottom:10, display:"flex", flexDirection:"column", gap:5 }}>
                      {attachedFiles.map((f, i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"6px 10px" }}>
                          <span style={{ fontSize:11, color:C.accent, flexShrink:0 }}>{f.isAudio ? "🎙" : "📄"}</span>
                          <span style={{ flex:1, fontSize:12, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                          <button onClick={()=>setAttachedFiles(prev=>prev.filter((_,j)=>j!==i))}
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
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                  <button onClick={()=>{setShowTranscriptAiEdit(v=>!v);setTranscriptAiInstruction("");setTranscriptAiEditError("");}}
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
                <textarea value={minutes} onChange={e=>{ setMinutes(e.target.value); setMinutesSaved(false); }} rows={16}
                  style={{ ...inputStyle, resize:"vertical", lineHeight:1.8, fontFamily:"'Courier New',monospace", fontSize:12, marginBottom:16 }} />
                {showAiEdit && (
                  <div style={{ marginBottom:16, background:C.accentLight, border:`1.5px solid ${C.accent}`, borderRadius:12, padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:8 }}>✨ AI修正指示</div>
                    <textarea value={aiInstruction} onChange={e=>setAiInstruction(e.target.value)} rows={3}
                      placeholder="例：決定事項をより明確に書き直してください"
                      style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 11px", fontSize:12, background:"#fff", color:C.text, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }} />
                    {aiEditError && <div style={{ fontSize:12, color:C.accent, marginTop:6 }}>⚠️ {aiEditError}</div>}
                    <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"flex-end" }}>
                      <button onClick={()=>{setShowAiEdit(false);setAiInstruction("");setAiEditError("");}} style={BTN.ghost}>キャンセル</button>
                      <button onClick={runAiEdit} disabled={aiEditLoading||!aiInstruction.trim()} style={{...BTN.primary, opacity:aiEditLoading||!aiInstruction.trim()?0.5:1, cursor:aiEditLoading||!aiInstruction.trim()?"default":"pointer"}}>{aiEditLoading?"修正中...":"修正する"}</button>
                    </div>
                  </div>
                )}
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                  <button onClick={()=>{setShowAiEdit(v=>!v);setAiInstruction("");setAiEditError("");}}
                    style={btn({padding:"10px 18px",borderRadius:12,background:showAiEdit?C.accent:C.accentLight,color:showAiEdit?"#fff":C.accent,fontSize:13,fontWeight:800,border:`1.5px solid ${C.accent}`})}>✨ AI修正</button>
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
                              <button onClick={()=>{ setEditingDecisionId(d.id); setEditingDecisionText(d.text); }}
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

function MinutesDetailPage({ project, onBack, onUpdate }) {
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [diffResult, setDiffResult] = useState(null); // {original, revised, lines}
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
    setAiLoading(true); setAiError("");
    try {
      const revised = await callClaude({
        system: "あなたは議事録編集の専門家です。ユーザーの指示に従って議事録を修正してください。元の構成・フォーマットを極力維持し、指示された箇所のみ修正してください。修正後の議事録全文のみを出力してください。",
        messages: [{ role: "user", content: `以下の議事録を指示に従って修正してください。\n\n【修正指示】\n${aiInstruction}\n\n【議事録】\n${editContent}` }]
      });
      if (revised) {
        const lines = computeLineDiff(editContent, revised);
        setDiffResult({ original: editContent, revised, lines });
        setAiEditOpen(false); setAiInstruction("");
      }
    } catch(e) { setAiError("エラー："+e.message); }
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
    const PDF_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; } @page { size: A4; margin: 20mm 20mm 25mm 20mm; } body { font-family: 'Yu Gothic','游ゴシック','YuGothic','Hiragino Kaku Gothic ProN','Meiryo',sans-serif; font-size: 10pt; color: #000; padding: 20mm 20mm 25mm 20mm; line-height: 1.75; width: 210mm; min-height: 297mm; } .title { font-size: 14pt; font-weight: 700; text-align: left; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #000; letter-spacing: 0.05em; } table.meta { border-collapse: collapse; margin-bottom: 8px; font-size: 9.5pt; } .mk { font-weight: 700; padding: 1px 10px 1px 0; white-space: nowrap; vertical-align: top; } .mv { padding: 1px 0; vertical-align: top; } .div { border: none; border-top: 1px solid #aaa; margin: 8px 0; } .sh { font-size: 10.5pt; font-weight: 700; margin: 14px 0 6px; padding: 3px 0; border-bottom: 1px solid #000; } .subh { font-size: 10pt; font-weight: 700; margin: 8px 0 3px; } .ul { padding-left: 0; margin: 3px 0 6px; list-style: none; } .ul li { margin: 2px 0; font-size: 9.5pt; line-height: 1.7; padding-left: 1em; text-indent: -1em; } .ul li::before { content: "・"; } .p { font-size: 9.5pt; margin: 2px 0 5px; line-height: 1.7; } .tt { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9.5pt; } .tt th { background: #f0f0f0; border: 1px solid #999; padding: 5px 8px; text-align: left; font-weight: 700; } .tt td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; line-height: 1.6; } @media print { body { padding: 0; } .sh { break-after: avoid; } }`;
    const docTitle = `${project.name} ${m.title}`.trim();
    const win = window.open("", "_blank");
    if (!win) return;
    const body = buildMinutesBody(m.content);
    win.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(docTitle)}</title><style>${PDF_CSS}</style></head><body>${body}</body></html>`);
    win.document.close(); win.focus(); win.print();
  };

  const downloadAgendaPdf = (agendaEntry) => {
    const PDF_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; } @page { size: A4; margin: 20mm 20mm 25mm 20mm; } body { font-family: 'Yu Gothic','游ゴシック','YuGothic','Hiragino Kaku Gothic ProN','Meiryo',sans-serif; font-size: 10pt; color: #000; padding: 20mm 20mm 25mm 20mm; line-height: 1.75; width: 210mm; min-height: 297mm; } .title { font-size: 14pt; font-weight: 700; text-align: left; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #000; letter-spacing: 0.05em; } table.meta { border-collapse: collapse; margin-bottom: 8px; font-size: 9.5pt; } .mk { font-weight: 700; padding: 1px 10px 1px 0; white-space: nowrap; vertical-align: top; } .mv { padding: 1px 0; vertical-align: top; } .div { border: none; border-top: 1px solid #aaa; margin: 8px 0; } .sh { font-size: 10.5pt; font-weight: 700; margin: 14px 0 6px; padding: 3px 0; border-bottom: 1px solid #000; } .subh { font-size: 10pt; font-weight: 700; margin: 8px 0 3px; } .ul { padding-left: 0; margin: 3px 0 6px; list-style: none; } .ul li { margin: 2px 0; font-size: 9.5pt; line-height: 1.7; padding-left: 1em; text-indent: -1em; } .ul li::before { content: "・"; } .p { font-size: 9.5pt; margin: 2px 0 5px; line-height: 1.7; } @media print { body { padding: 0; } .sh { break-after: avoid; } }`;
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
      const prompt = `あなたは建築・ホテル開発プロジェクトの意匠設計者です。
以下の情報から次回打合せのアジェンダを作成してください。

【プロジェクト名】
${project.name}

【今回の議事録】
${selectedMinute.content}

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
      const keyRes = await fetch("/api/gemini-key");
      const { key: geminiKey } = await keyRes.json();
      if (!geminiKey) throw new Error("APIキーが取得できませんでした");
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 3000 },
          }),
        }
      );
      const geminiData = await geminiRes.json();
      if (geminiData.error) throw new Error(geminiData.error.message);
      const result = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
    <><div style={{ display:"flex", height:"calc(100vh - 52px)", overflow:"hidden" }}>
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
                <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} disabled={!!diffResult} style={{...BTN.primary, opacity:diffResult?0.5:1, cursor:diffResult?"default":"pointer"}}>💾 保存</button>
                      {!diffResult && <button onClick={()=>{ setAiEditOpen(v=>!v); setAiInstruction(""); setAiError(""); }}
                        style={{ background:aiEditOpen?C.accent:C.accentLight, color:aiEditOpen?"#fff":C.accent, border:`1.5px solid ${C.accent}`, borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" }}>✨ AI修正</button>}
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
                      <button onClick={()=>{ if(window.confirm("この議事録を削除しますか？この操作は取り消せません。")) { onUpdate({...project, minutes:project.minutes.filter(m=>m.id!==selectedMinute.id)}); setSelectedId(null); } }}
                        onMouseEnter={()=>setHoveredBtn('delete')} onMouseLeave={()=>setHoveredBtn(null)}
                        style={{ background:hoveredBtn==='delete'?"#FFEBEE":"transparent", border:"1.5px solid #E53935", color:"#E53935", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
                        🗑 削除
                      </button>
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
                    <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:8 }}>✨ AI修正指示</div>
                    <textarea value={aiInstruction} onChange={e=>setAiInstruction(e.target.value)} rows={3}
                      placeholder="例：決定事項をより明確に書き直してください"
                      style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 11px", fontSize:12, background:"#fff", color:C.text, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
                    {aiError && <div style={{ fontSize:12, color:C.accent, marginTop:6 }}>{aiError}</div>}
                    <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"flex-end" }}>
                      <button onClick={()=>{setAiEditOpen(false);setAiInstruction("");setAiError("");}} style={BTN.ghost}>キャンセル</button>
                      <button onClick={runAiEdit} disabled={aiLoading||!aiInstruction.trim()} style={{...BTN.primary, opacity:aiLoading||!aiInstruction.trim()?0.5:1, cursor:aiLoading||!aiInstruction.trim()?"default":"pointer"}}>{aiLoading?"修正中...":"修正する"}</button>
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
                              <button onClick={()=>{ setDetailEditingDecId(d.id); setDetailEditingDecText(d.text); }}
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
                          <button onClick={e=>{e.stopPropagation();setEditingTaskId(t.id);}}
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
                                        <button onClick={()=>setEditingSubtaskId(s.id)}
                                          style={btn({padding:"1px 4px",borderRadius:4,fontSize:10,color:C.muted,background:"transparent"})}>✏️</button>
                                      )}
                                      <button onClick={()=>setDetailExtracted(ts=>ts.map(x=>x.id===t.id?{...x,subtasks:(x.subtasks||[]).filter(ss=>ss.id!==s.id)}:x))}
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
                <textarea value={editContent} onChange={e=>setEditContent(e.target.value)} rows={30}
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
    <div style={{ overflowY:"auto", height:"calc(100vh - 52px)", background:C.bg }}>
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
        <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:18, flexWrap:"wrap", background:C.surface, borderRadius:10, padding:"8px 14px", border:`1px solid ${C.border}` }}>
          <button onClick={()=>setCurrentFolderId(null)}
            style={btn({ fontSize:12, fontWeight:700, color:currentFolderId===null?project.color:C.muted, background:"transparent", padding:"2px 6px", textDecoration:currentFolderId===null?"none":"underline" })}>
            ルート
          </button>
          {breadcrumb.map((f, i) => (
            <React.Fragment key={f.id}>
              <span style={{ color:C.muted, fontSize:13, fontWeight:300 }}>›</span>
              <button onClick={()=>setCurrentFolderId(f.id)}
                style={btn({ fontSize:12, fontWeight:700, color:i===breadcrumb.length-1?project.color:C.muted, background:"transparent", padding:"2px 6px", textDecoration:i===breadcrumb.length-1?"none":"underline" })}>
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

function ProjectDetailPage({ project, onUpdate, onMinutesUpdate }) {
  const [subTab, setSubTab] = useState("tasks");
  return (
    <div>
      <div style={{ background: C.surface, borderBottom: `1.5px solid ${C.border}`, display: "flex", paddingLeft: 24 }}>
        {[["tasks","📋 タスク"],["minutes","📝 議事録"],["decisions","📌 決定事項"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setSubTab(id)}
            style={btn({ padding: "10px 18px", fontSize: 13, fontWeight: 700, background: "transparent", color: subTab === id ? project.color : C.muted, borderBottom: subTab === id ? `2.5px solid ${project.color}` : "2.5px solid transparent", borderRadius: 0 })}>
            {lbl}
          </button>
        ))}
      </div>
      {subTab === "tasks" && <KanbanPage key={project.id} project={project} onUpdate={onUpdate} />}
      {subTab === "minutes" && <MinutesDetailPage project={project} onBack={() => setSubTab("tasks")} onUpdate={onMinutesUpdate} />}
      {subTab === "decisions" && <DecisionsPage project={project} onUpdate={onUpdate} />}
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
    <div style={{ overflowY:"auto", height:"calc(100vh - 52px)", background:C.bg }}>
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
          Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
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
                <button onClick={() => removeChannel(i)} style={btn({ padding: "5px 10px", borderRadius: 8, background: "transparent", color: C.muted, fontSize: 13, border: `1.5px solid ${C.border}` })}>✕</button>
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

function Toast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position:"fixed", bottom:24, right:24, background:"#333", color:"#fff", padding:"12px 20px", borderRadius:8, zIndex:9999, fontSize:13, boxShadow:"0 4px 12px rgba(0,0,0,0.2)", display:"flex", alignItems:"center", gap:10 }}>
      <span>🔄 {message}</span>
      <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#aaa", cursor:"pointer", fontSize:14, padding:0 }}>✕</button>
    </div>
  );
}

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
        .then(savedAt => { lastSavedAt.current = savedAt; })
        .catch(e => setSaveError("データの保存に失敗しました：" + e.message))
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
  const deleteProject = id => { setProjects(ps => ps.filter(p => p.id!==id)); setTab("projects"); };
  const addProject = () => {
    if (!newName.trim()) return;
    const colors = [C.sage,C.doing,C.done,C.accent,"#9B8EC0"];
    const p = { id:uid(), name:newName, desc:"", color:colors[projects.length%colors.length], minutes:[], members:[], tasks:[] };
    setProjects(ps=>[...ps,p]); setTab(p.id); setNewName(""); setShowAdd(false);
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
        } else alert("正しいバックアップファイルではありません");
      } catch { alert("ファイルの読み込みに失敗しました"); }
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
    setTab("projects");
  };

  const importRef = useRef(null);

  if (!storageReady) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif" }}>
      <img src={logo} alt="andto" style={{ height:36, objectFit:"contain", animation:"pulse 1.6s ease-in-out infinite" }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif", color:C.text }}>
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
          <button onClick={()=>setSaveError(null)} style={{ background:"transparent", border:"none", color:"#fff", cursor:"pointer", fontSize:16, fontWeight:700, padding:"0 4px" }}>✕</button>
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
          <button key={id} onClick={()=>setTab(id)} className="nav-tab nav-tab-anim" style={{...btn({padding:"0 16px",height:52,background:"transparent",fontSize:13,fontWeight:700,color:tab===id?C.accent:C.muted,borderBottom:tab===id?`2.5px solid ${C.accent}`:"2.5px solid transparent",flexShrink:0,whiteSpace:"nowrap"}), animationDelay:`${i*40}ms`}}>{lbl}</button>
        ))}
        <div style={{ width:1, background:C.border, margin:"10px 8px", flexShrink:0 }} />
        {sortedProjects.map((p,i)=>(
          <button key={p.id} draggable onClick={()=>setTab(p.id)} className="nav-tab nav-tab-anim"
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
            <button onClick={()=>setShowAdd(false)} style={btn({background:"transparent",color:C.muted,fontSize:16})}>✕</button>
          </div>
        ) : (
          <button onClick={()=>setShowAdd(true)} style={btn({padding:"0 14px",height:52,background:"transparent",fontSize:16,fontWeight:700,color:C.muted,flexShrink:0,lineHeight:1})}>+</button>
        )}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4, padding:"0 12px", flexShrink:0 }}>
          <button onClick={()=>setTab("slack-settings")} style={btn({padding:"5px 10px",borderRadius:8,border:`1.5px solid ${tab==="slack-settings"?C.sage:C.border}`,background:tab==="slack-settings"?C.sageLight:"transparent",color:tab==="slack-settings"?C.sage:C.muted,fontSize:11,fontWeight:700,whiteSpace:"nowrap"})}>💬 Slack設定</button>
          <button onClick={exportData} style={btn({padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontWeight:700,whiteSpace:"nowrap"})}>⬆ エクスポート</button>
          <button onClick={()=>importRef.current?.click()} style={btn({padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontWeight:700,whiteSpace:"nowrap"})}>⬇ インポート</button>
          <input ref={importRef} type="file" accept=".json" onChange={importData} style={{ display:"none" }} />
        </div>
      </div>

      <>
        <div style={{ display:tab==="projects"?"block":"none" }}><ProjectsPage projects={sortedProjects} onUpdate={updateProject} onDelete={deleteProject} onNavigate={id=>setTab(id)} onReorder={reorderProjects} /></div>
        <div style={{ display:tab==="calendar"?"block":"none" }}><CalendarPage projects={projects} onUpdate={updateProject} /></div>
        <div style={{ display:tab==="minutes"?"block":"none" }}><MinutesPage projects={projects} onAddTasks={addTasks} onUpdateProject={updateProject} /></div>
        <div style={{ display:tab==="members"?"block":"none" }}><MemberTasksPage projects={projects} /></div>
        <div style={{ display:tab==="slack-settings"?"block":"none" }}><SlackSettingsPage slackSettings={slackSettings} onChange={updateSlackSettings} /></div>
        {active&&tab===active.id&&<ProjectDetailPage key={active.id} project={active} onUpdate={updateProject} onMinutesUpdate={p => { lastBroadcastAt.current = new Date().toISOString(); updateProject(p); }} />}
      </>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

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
