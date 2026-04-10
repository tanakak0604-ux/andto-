module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { fileSize, mimeType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(fileSize),
          "X-Goog-Upload-Header-Content-Type": mimeType,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: { display_name: "meeting_audio.mp3" } }),
      }
    );

    const uploadUrl = response.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      const text = await response.text();
      return res.status(500).json({ error: "アップロードセッション作成失敗: " + text.slice(0, 200) });
    }

    res.json({ uploadUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
