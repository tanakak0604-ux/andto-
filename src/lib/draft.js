// 編集中テキストの下書きをブラウザ(localStorage)に退避する。
// 保存ボタンを押す前にブラウザを閉じた／落ちた場合の復元用。端末ローカルのみ。
const PREFIX = "andto-draft:";

export const minuteDraftKey = (minuteId) => `${PREFIX}minute:${minuteId}`;
export const agendaDraftKey = (minuteId, agendaId) => `${PREFIX}agenda:${minuteId}:${agendaId}`;

export function saveDraft(key, text) {
  try { localStorage.setItem(key, JSON.stringify({ text, savedAt: Date.now() })); } catch { /* 容量超過・無効時は諦める */ }
}

export function clearDraft(key) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

// 保存済みの内容と同じ下書きは意味がないので消して null を返す
export function loadDraft(key, savedContent) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d?.text !== "string" || d.text === (savedContent ?? "")) { localStorage.removeItem(key); return null; }
    return d;
  } catch { return null; }
}

export function formatDraftTime(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
