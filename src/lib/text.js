
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

export { escapeHtml, uid, removeTimestampRegression, removeLoopedLines, extractJsonArray };
