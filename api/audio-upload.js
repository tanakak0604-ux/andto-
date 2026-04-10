export const config = { runtime: "edge" };

const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB (Google required granularity)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Mime-Type, X-File-Size",
  "Content-Type": "application/json",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  try {
    const mimeType = req.headers.get("x-mime-type") || "audio/mpeg";
    const fileSize = parseInt(req.headers.get("x-file-size") || "0");
    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Gemini resumable upload セッション開始
    const sessionRes = await fetch(
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
        body: JSON.stringify({ file: { display_name: "audio.mp3" } }),
      }
    );
    const uploadUrl = sessionRes.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      const t = await sessionRes.text();
      return new Response(JSON.stringify({ error: "セッション作成失敗: " + t.slice(0, 200) }), { status: 500, headers: cors });
    }

    // 2. リクエストボディ（バイナリ）を全部読み込む
    const bodyBytes = new Uint8Array(await req.arrayBuffer());
    const totalSize = bodyBytes.length;

    // 3. 8MB チャンクで Gemini にアップロード
    let offset = 0;
    let fileUri = null;

    while (offset < totalSize) {
      const end = Math.min(offset + CHUNK_SIZE, totalSize);
      const chunk = bodyBytes.slice(offset, end);
      const isLast = end >= totalSize;

      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "X-Goog-Upload-Command": isLast ? "upload, finalize" : "upload",
          "X-Goog-Upload-Offset": String(offset),
          "Content-Length": String(chunk.length),
          "Content-Type": mimeType,
        },
        body: chunk,
      });

      if (!uploadRes.ok) {
        const t = await uploadRes.text();
        return new Response(JSON.stringify({ error: `Google upload error (${uploadRes.status}): ${t.slice(0, 300)}` }), { status: 500, headers: cors });
      }

      if (isLast) {
        const data = await uploadRes.json();
        fileUri = data?.file?.uri;
        if (!fileUri) return new Response(JSON.stringify({ error: "File URI not returned: " + JSON.stringify(data).slice(0, 200) }), { status: 500, headers: cors });
        break;
      } else {
        const received = uploadRes.headers.get("x-goog-upload-size-received");
        offset = received ? parseInt(received) : end;
      }
    }

    return new Response(JSON.stringify({ fileUri }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
}
