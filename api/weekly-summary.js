/**
 * 週次 Slack サマリー投稿 - Vercel Cron Job
 * 毎週月曜 09:00 JST (0 0 * * 1) に実行
 *
 * 使用環境変数:
 *   SLACK_BOT_TOKEN  - Slack Bot Token (xoxb-)
 *   GEMINI_API_KEY   - Gemini API キー
 *   CRON_SECRET      - Cron リクエスト認証用シークレット
 */

const SOURCE_CHANNELS = [
  { id: "C0466A8FAP8", name: "KAM" },
  { id: "C08PRV56NSF", name: "Pine" },
  { id: "C08LNGU4U10", name: "代田YK邸" },
];
const SUMMARY_CHANNEL = "C06UAGYA1L2";
const NOTIFY_USER = "U037A6QU4QY";
const DIVIDER = "━━━━━━━━━━━━━━━";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const oldest = String(Date.now() / 1000 - 7 * 24 * 60 * 60);

  // ── 1. チャンネルごとにメッセージ取得 → 個別要約 ───────
  const sections = [];
  for (const { id, name } of SOURCE_CHANNELS) {
    try {
      const messages = await fetchChannelHistory(id, oldest);
      if (messages.length === 0) continue;
      const messagesText = messages.map(m => m.text || "").filter(Boolean).join("\n");
      const summary = await generateSummary(messagesText);
      sections.push(`${DIVIDER}\n📌 #${name}（${id}）\n${summary}`);
    } catch (e) {
      console.error(`Failed to process channel ${id}:`, e.message);
      // エラーがあっても他チャンネルの処理を継続
    }
  }

  if (sections.length === 0) {
    return res.status(200).json({ ok: true, skipped: "no messages" });
  }

  // ── 2. サマリーを Slack に投稿 ───────────────────────────
  const text = `<@${NOTIFY_USER}> 今週の進捗サマリーです。\n\n${sections.join("\n\n")}`;
  await postToSlack(SUMMARY_CHANNEL, text);

  return res.status(200).json({ ok: true, channelsFetched: sections.length });
};

// ── ユーティリティ ───────────────────────────────────────────

async function fetchChannelHistory(channelId, oldest) {
  const url = `https://slack.com/api/conversations.history?channel=${channelId}&oldest=${oldest}&limit=200`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "conversations.history failed");
  return data.messages || [];
}

async function generateSummary(messagesText) {
  const prompt = `以下のSlackメッセージから、今週の決定事項とタスクを抽出して日本語で簡潔にまとめてください。
決定事項と未完了タスクを分けて箇条書きで出力してください。

出力形式:
【決定事項】
・〇〇
・〇〇

【タスク】
・〇〇
・〇〇

---
${messagesText.slice(0, 12000)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "（要約を生成できませんでした）";
}

async function postToSlack(channel, text) {
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });
}
