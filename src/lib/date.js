// 期日の危険度を判定して表示用ラベル・色を返す
// 完了タスクや期日なしは null（従来表示のまま）
function dueDateInfo(dueDate, status) {
  if (!dueDate || status === "done") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  if (isNaN(due)) return null;
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) return { label: `${-diff}日超過`, color: "#DC2626", bg: "#FEE2E2" };
  if (diff === 0) return { label: "今日まで", color: "#DC2626", bg: "#FEE2E2" };
  if (diff <= 3) return { label: `あと${diff}日`, color: "#B45309", bg: "#FEF3C7" };
  return null;
}

export { dueDateInfo };
