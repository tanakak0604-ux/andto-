// 削除Undo用の簡易イベントバス
// App がリスナーを登録し、各ページは pushUndoToast(メッセージ, 復元関数) を呼ぶだけでよい
let listener = null;

function onUndoToast(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

function pushUndoToast(message, undo) {
  if (listener) listener(message, undo);
}

export { onUndoToast, pushUndoToast };
