async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { uploadUrl, chunkData, offset, isLast, mimeType } = req.body;
    const buffer = Buffer.from(chunkData, "base64");
    const command = isLast ? "upload, finalize" : "upload";

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Command": command,
        "X-Goog-Upload-Offset": String(offset),
        "Content-Length": String(buffer.length),
        "Content-Type": mimeType,
      },
      body: buffer,
    });

    // Google が非JSONエラーを返す場合に対応
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return res.status(500).json({
        error: `Google upload error (${uploadRes.status}): ${errText.slice(0, 300)}`,
      });
    }

    if (isLast) {
      const text = await uploadRes.text();
      let data;
      try { data = JSON.parse(text); } catch {
        return res.status(500).json({ error: `Googleの最終応答がJSONではありません: ${text.slice(0, 300)}` });
      }
      const fileUri = data?.file?.uri;
      if (!fileUri) return res.status(500).json({ error: `File URI なし。応答: ${text.slice(0, 200)}` });
      return res.json({ fileUri });
    } else {
      const sizeReceived = uploadRes.headers.get("x-goog-upload-size-received");
      const nextOffset = parseInt(sizeReceived || String(offset + buffer.length));
      return res.json({ nextOffset });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

handler.config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

module.exports = handler;
