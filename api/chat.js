const TWENTY_MB = 20 * 1024 * 1024;

async function uploadToFileApi(audioBase64, mimeType, apiKey) {
  const buffer = Buffer.from(audioBase64, "base64");
  const numBytes = buffer.length;

  // 1. セッション開始
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": numBytes,
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: "audio.mp3" } }),
    }
  );
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("File API upload session failed");

  // 2. データ送信
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
      "Content-Type": mimeType,
    },
    body: buffer,
  });
  const uploadData = await uploadRes.json();
  const fileUri = uploadData?.file?.uri;
  if (!fileUri) throw new Error("File API did not return URI");
  return fileUri;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { system, messages, max_tokens, audioFile } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

  try {
    let parts = [];

    if (audioFile) {
      const { data: audioBase64, mimeType } = audioFile;
      const audioBuffer = Buffer.from(audioBase64, "base64");

      if (audioBuffer.length >= TWENTY_MB) {
        // File API 経由
        const fileUri = await uploadToFileApi(audioBase64, mimeType, apiKey);
        parts.push({ file_data: { file_uri: fileUri, mime_type: mimeType } });
      } else {
        // インライン
        parts.push({ inline_data: { mime_type: mimeType, data: audioBase64 } });
      }
    }

    const prompt = (system ? system + "\n\n" : "") + messages.map(m => m.content).join("\n");
    parts.push({ text: prompt });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: 16000 },
      }),
    });

    const rawText = await response.text();
    let data;
    try { data = JSON.parse(rawText); }
    catch (e) { return res.status(500).json({ error: { message: "Parse error: " + rawText.slice(0, 200) } }); }

    if (data.error) return res.status(500).json({ error: { message: data.error.message } });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
};
