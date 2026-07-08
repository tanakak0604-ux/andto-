import { cleanTranscriptChunk, removeLoopedLines } from "./text";

async function callClaude({ system, messages, max_tokens = 65536, temperature, signal, audioFile, audioFileUri, audioMimeType }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages, max_tokens, temperature, audioFile, audioFileUri, audioMimeType }),
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

// サーバーの時間制限内に取れたところまで受け取る（truncated: true なら続きがある）
async function callClaudePartial({ messages, temperature, max_tokens, signal, audioFileUri, audioMimeType }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, temperature, max_tokens, audioFileUri, audioMimeType, collectPartial: true }),
    signal,
  });
  const rawText = await response.text();
  let data;
  try { data = JSON.parse(rawText); } catch {
    throw new Error("サーバーエラー: " + rawText.slice(0, 100));
  }
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return { text: data.content?.[0]?.text || "", truncated: !!data.truncated };
}

// 長時間音声の文字起こし：短いパス（8千トークン）を自動で繰り返して最後まで取得する
// 一度に長く生成させるとループや形式崩れの劣化が起きやすいため、
// 小刻みに区切り、毎回クリーニングした末尾から仕切り直す
async function transcribeLongAudio({ audioFileUri, mimeType, firstPrompt, signal, onPass }) {
  const PASS_TOKENS = 8192;
  let full = "";
  for (let pass = 1; pass <= 30; pass++) {
    if (onPass) onPass(pass);
    const promptText = pass === 1
      ? firstPrompt
      : `以下の音声の文字起こしを行っています。すでに書き起こされた末尾部分を参考に、その続きから文字起こしを続けてください。重複しないように、末尾の直後から続けてください。タイムスタンプは必ず [分:秒] 形式（例 [45:12]）で、末尾の時刻より後から単調増加で記載してください。\n\n【ここまでの末尾】\n${full.slice(-800)}\n\n【続きの文字起こし（末尾の直後から）】`;
    const { text, truncated } = await callClaudePartial({
      messages: [{ role: "user", content: promptText }],
      temperature: 0,
      max_tokens: PASS_TOKENS,
      audioFileUri,
      audioMimeType: mimeType,
      signal,
    });
    const cleaned = cleanTranscriptChunk(text);
    const prevLen = full.length;
    full = full ? removeLoopedLines(full + "\n" + cleaned) : cleaned;
    if (!truncated || !text.trim()) break;
    if (pass > 1 && full.length <= prevLen + 10) break; // 進捗がなければ打ち切り（無限ループ防止）
  }
  return full;
}

// Gemini File API アップロード（キーはサーバー側のみ。署名付きURLを受け取り、ファイル本体はブラウザから直接送る）
async function uploadAudioToGemini(bytes, mimeType, displayName, signal) {
  const startRes = await fetch("/api/gemini-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", mimeType, numBytes: bytes.size ?? bytes.length, displayName }),
    signal,
  });
  const startData = await startRes.json();
  if (!startRes.ok || !startData.uploadUrl) throw new Error(startData?.error?.message || "アップロードセッションの開始に失敗しました");
  const uploadRes = await fetch(startData.uploadUrl, {
    method: "POST",
    headers: { "X-Goog-Upload-Command": "upload, finalize", "X-Goog-Upload-Offset": "0", "Content-Type": mimeType },
    body: bytes,
    signal,
  });
  const rawText = await uploadRes.text();
  let data;
  try { data = JSON.parse(rawText); } catch {
    throw new Error(`Gemini応答がJSONではありません (${uploadRes.status}): ${rawText.slice(0, 150)}`);
  }
  if (!uploadRes.ok) throw new Error(`Gemini upload error (${uploadRes.status}): ${data?.error?.message || rawText.slice(0, 150)}`);
  if (!data?.file?.uri) throw new Error("File URI が返されませんでした: " + JSON.stringify(data).slice(0, 150));
  return { uri: data.file.uri, name: data.file.name };
}

async function waitGeminiFileActive(fileName, signal) {
  if (!fileName) return;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch("/api/gemini-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "state", fileName }),
      signal,
    });
    const data = await res.json();
    if (data?.state === "ACTIVE") return;
    if (data?.state === "FAILED") throw new Error("音声ファイルの処理に失敗しました");
  }
}

async function uploadWavChunkToGemini(wavBlob, chunkIndex) {
  try {
    const { uri, name } = await uploadAudioToGemini(wavBlob, "audio/wav", `chunk_${chunkIndex}.wav`);
    await waitGeminiFileActive(name);
    return uri;
  } catch (e) {
    throw new Error(`チャンク${chunkIndex}: ${e.message}`);
  }
}

// タイムスタンプ逆戻り検出（安全網）

export { callClaude, callClaudePartial, transcribeLongAudio, uploadAudioToGemini, waitGeminiFileActive, uploadWavChunkToGemini };
