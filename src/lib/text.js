
function escapeHtml(str = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
  return str.replace(/[&<>"']/g, m => map[m]);
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// 文字起こしのループ（同一行の連続繰り返し）を検出して打ち切る
// 音声チャンク分割ユーティリティ

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
  const recent = []; // 直近の内容行（交互ループ検出用）
  const WINDOW = 10;
  const stripTs = (s) => s.trim().replace(/^\[\d+:\d+\]\s*/, "");
  for (const line of lines) {
    const content = stripTs(line);
    if (content === lastContent && content !== "") {
      repeatCount++;
      if (repeatCount >= 3) break; // 同じ内容が3回以上続いたら打ち切り
    } else {
      repeatCount = 1;
      lastContent = content;
      result.push(line);
    }
    if (content !== "") {
      recent.push(content);
      if (recent.length > WINDOW) recent.shift();
      // 直近10行の内容が2種類以下 → 「あー。」「そうそう。」のような交互ループとみなし、
      // ループ開始位置まで巻き戻して打ち切り
      if (recent.length === WINDOW && new Set(recent).size <= 2) {
        const loopSet = new Set(recent);
        let cut = result.length;
        while (cut > 0) {
          const c = stripTs(result[cut - 1]);
          if (c === "" || loopSet.has(c)) cut--;
          else break;
        }
        return result.slice(0, cut).join("\n");
      }
    }
  }
  return result.join("\n");
}

// 劣化時に出る崩れたタイムスタンプ（[ 31m23s700ms ] 等）を [31:23] 形式に正規化
function normalizeTimestamps(text) {
  return text.replace(/\[\s*(?:(\d+)h)?(\d+)m(\d+)s(?:\d+ms)?\s*\]/g, (_, h, m, s) => {
    const min = (h ? parseInt(h) * 60 : 0) + parseInt(m);
    return `[${String(min).padStart(2, "0")}:${String(parseInt(s)).padStart(2, "0")}]`;
  });
}

// 文字起こしテキストの一括クリーニング（正規化 → ループ除去 → 逆戻り除去）
function cleanTranscriptChunk(text) {
  return removeTimestampRegression(removeLoopedLines(normalizeTimestamps(text)));
}
function extractJsonArray(raw) {
  const s = raw.replace(/```json|```/g, "").trim();
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error("JSON配列が見つかりません");
}

export { escapeHtml, uid, removeTimestampRegression, removeLoopedLines, normalizeTimestamps, cleanTranscriptChunk, extractJsonArray };
