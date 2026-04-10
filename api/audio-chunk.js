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
        "Content-Type": mimeType,
      },
      body: buffer,
    });

    if (isLast) {
      const data = await uploadRes.json();
      const fileUri = data?.file?.uri;
      if (!fileUri) return res.status(500).json({ error: "File URI not returned" });
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
