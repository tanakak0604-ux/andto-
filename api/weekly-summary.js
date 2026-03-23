/**
 * 週次 Slack サマリー投稿 - Vercel Cron Job
 * 毎週月曜 08:30 JST (30 23 * * 0) に実行
 *
 * 使用環境変数:
 *   SLACK_BOT_TOKEN  - Slack Bot Token (xoxb-)
 *   GEMINI_API_KEY   - Gemini API キー
 *   CRON_SECRET      - Cron リクエスト認証用シークレット
 */

const DIVIDER = "━━━━━━━━━━━━━━━";

// 今週の月曜〜日曜（JST基準）の範囲を返す
function getWeekRange(offsetWeeks = 0) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // JST
  const day = now.getUTCDay(); // 0=Sun, 1=Mon ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday + offsetWeeks * 7);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

async function loadSlackSettings() {
  const res = await fetch(
    `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared&select=slack_settings`,
    {
      headers: {
        apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
      },
    }
  );
  const data = await res.json();
  return data?.[0]?.slack_settings || null;
}

async function loadTaskSummary() {
  const res = await fetch(
    `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared&select=projects`,
    {
      headers: {
        apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
      },
    }
  );
  const rows = await res.json();
  const projects = rows?.[0]?.projects || [];

  const thisWeek = getWeekRange(0);   // 今週
  const lastWeek = getWeekRange(-1);  // 先週

  const todo = [];
  const doing = [];
  const done = [];

  for (const p of projects) {
    for (const t of (p.tasks || [])) {
      const label = `・[${p.name}] ${t.title}`;

      if (t.status === "todo" && t.dueDate) {
        const due = new Date(t.dueDate + "T00:00:00+09:00");
        if (due < thisWeek.start) {
          todo.push(`${label}　⚠️期限切れ`);
        } else if (due >= thisWeek.start && due <= thisWeek.end) {
          todo.push(label);
        }
      } else if (t.status === "todo" && !t.dueDate) {
        // 期限なし未着手は省略
      } else if (t.status === "doing") {
        doing.push(label);
      } else if (t.status === "done" && t.completedAt) {
        const completedAt = new Date(t.completedAt);
        if (completedAt >= lastWeek.start && completedAt <= lastWeek.end) {
          done.push(label);
        }
      }
    }
  }

  return { todo, doing, done };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Supabase から Slack 設定を取得
  const slackSettings = await loadSlackSettings();
  const SOURCE_CHANNELS = slackSettings?.sourceChannels || [];
  const SUMMARY_CHANNEL = slackSettings?.summaryChannel || "";

  if (!SUMMARY_CHANNEL) {
    return res.status(500).json({ error: "summaryChannel is not configured in slackSettings" });
  }
  if (SOURCE_CHANNELS.length === 0) {
    return res.status(200).json({ ok: true, skipped: "no sourceChannels configured" });
  }

  const oldest = String(Date.now() / 1000 - 7 * 24 * 60 * 60);

  // ── 1. TaskFlow タスク取得 ────────────────────────────────
  const { todo, doing, done } = await loadTaskSummary().catch(() => ({ todo: [], doing: [], done: [] }));

  // ── 2. チャンネルごとにメッセージ取得 → 箇条書き要約 ───
  const slackSections = [];
  for (const { id, name } of SOURCE_CHANNELS) {
    try {
      const messages = await fetchChannelHistory(id, oldest);
      if (messages.length === 0) continue;
      const messagesText = messages.map(m => m.text || "").filter(Boolean).join("\n");
      const summary = await generateBulletSummary(messagesText);
      slackSections.push(`📌 #${name}\n${summary}`);
    } catch (e) {
      console.error(`Failed to process channel ${id}:`, e.message);
    }
  }

  // ── 3. 投稿テキスト組み立て ──────────────────────────────
  const parts = [];

  // タスクセクション
  const taskLines = [];
  const overdue = todo.filter(l => l.includes("⚠️期限切れ"));
  const thisWeekTodo = todo.filter(l => !l.includes("⚠️期限切れ"));
  if (overdue.length > 0) {
    taskLines.push(`*【未着手（期限切れ）】*\n${overdue.join("\n")}`);
  }
  if (thisWeekTodo.length > 0) {
    taskLines.push(`*【未着手（今週期限）】*\n${thisWeekTodo.join("\n")}`);
  }
  if (doing.length > 0) {
    taskLines.push(`*【進行中】*\n${doing.join("\n")}`);
  }
  if (done.length > 0) {
    taskLines.push(`*【先週の完了】*\n${done.join("\n")}`);
  }
  if (taskLines.length > 0) {
    parts.push(`${DIVIDER}\n📋 *TaskFlow タスク*\n\n${taskLines.join("\n\n")}`);
  }

  // Slackまとめセクション
  if (slackSections.length > 0) {
    parts.push(`${DIVIDER}\n💬 *先週のSlackまとめ*\n\n${slackSections.join("\n\n")}`);
  }

  if (parts.length === 0) {
    return res.status(200).json({ ok: true, skipped: "no content" });
  }

  const text = `今週の進捗サマリーです。\n\n${parts.join("\n\n")}`;
  await postToSlack(SUMMARY_CHANNEL, text);

  return res.status(200).json({ ok: true, channelsFetched: slackSections.length });
};

// ── ユーティリティ ───────────────────────────────────────────

async function fetchChannelHistory(channelId, oldest) {
  const url = `https://slack.com/api/conversations.history?channel=${channelId}&oldest=${oldest}&limit=200`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "conversations.history failed");
  return (data.messages || []).filter(m => !m.bot_id && m.subtype !== "bot_message");
}

async function generateBulletSummary(messagesText) {
  const prompt = `以下のSlackメッセージを読み、重要なトピック・出来事・連絡事項を日本語の箇条書きで簡潔にまとめてください。
冗長な説明は不要です。事実ベースで簡潔に。

出力形式:
・〇〇
・〇〇

---
${messagesText.slice(0, 50000)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 16384 },
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
