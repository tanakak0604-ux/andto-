// Gemini File API のアップロードセッション開始と状態確認を代行する
// （APIキーをブラウザに渡さないため。ファイル本体はブラウザから直接アップロードURLに送る）
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.GEMINI_API_KEY;
  const { action, mimeType, numBytes, displayName, fileName } = req.body || {};

  try {
    if (action === "start") {
      // ブラウザのOriginをセッション開始時に伝えることで、発行されるアップロードURLが
      // そのOriginからのブラウザ直接アップロード（CORS）を許可するようになる
      const browserOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
      const startRes = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": String(numBytes || 0),
            "X-Goog-Upload-Header-Content-Type": mimeType,
            "Content-Type": "application/json",
            ...(browserOrigin ? { "Origin": browserOrigin } : {}),
          },
          body: JSON.stringify({ file: { display_name: displayName || "audio" } }),
        }
      );
      const uploadUrl = startRes.headers.get("x-goog-upload-url");
      if (!uploadUrl) {
        const errText = await startRes.text();
        return res.status(500).json({ error: { message: `アップロードセッションの開始に失敗しました (${startRes.status}): ${errText.slice(0, 200)}` } });
      }
      return res.status(200).json({ uploadUrl });
    }

    if (action === "state") {
      if (!/^files\/[A-Za-z0-9._-]+$/.test(fileName || "")) {
        return res.status(400).json({ error: { message: "不正なファイル名です" } });
      }
      const stateRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
      );
      const data = await stateRes.json();
      return res.status(200).json({ state: data?.state || null });
    }

    return res.status(400).json({ error: { message: "不正なactionです" } });
  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}

module.exports = handler;
