/**
 * Slack Event API - ✅リアクションでタスク自動生成
 *
 * 【Slack App 設定手順】
 * 1. https://api.slack.com/apps → Event Subscriptions を有効化
 * 2. Request URL: https://<your-domain>/api/slack-events
 * 3. Subscribe to bot events: reaction_added
 * 4. OAuth Scopes 追加: reactions:read, channels:history, groups:history, im:history
 *
 * 【動作フロー】
 * 1. Slackメッセージに ✅ をリアクション
 * 2. メッセージ本文を取得
 * 3. Gemini AIでタスクタイトル + サブタスクに変換
 * 4. slackChannelId が一致するプロジェクトにタスクを追加（needsReview: true）
 */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

async function loadProjects() {
  const res = await fetch(
    `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared&select=projects`,
    {
      headers: {
        apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
      },
    }
  );
  const data = await res.json();
  return data?.[0]?.projects || [];
}

async function saveProjects(projects) {
  await fetch(
    `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared`,
    {
      method: "PATCH",
      headers: {
        apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ projects }),
    }
  );
}

async function getSlackMessage(channel, ts) {
  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channel}&latest=${ts}&oldest=${ts}&inclusive=true&limit=1`,
    {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    }
  );
  const data = await res.json();
  return data.messages?.[0]?.text || "";
}

async function generateTask(messageText) {
  const prompt = `以下のSlackメッセージを、建築設計プロジェクト管理のタスクに変換してください。

タスクタイトル：1行で簡潔に、アクション形式で（例：「〇〇を確認する」「〇〇に連絡する」）
サブタスク：作業を細分化できる場合のみ配列で。不要な場合は空配列。

メッセージ：
${messageText}

JSONのみ出力（マークダウン不要）：
{"title":"タスクタイトル","subtasks":["サブタスク1","サブタスク2"]}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512 },
    }),
  });
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { title: messageText.slice(0, 100), subtasks: [] };
  }
}

async function processReaction(event) {
  const channel = event.item?.channel;
  const ts = event.item?.ts;
  if (!channel || !ts) return;

  const projects = await loadProjects();
  const projectIdx = projects.findIndex(p => p.slackChannelId === channel);
  if (projectIdx === -1) return;

  // 重複チェック（同じSlackメッセージからすでにタスク生成済み）
  const slackRef = `slack:${channel}:${ts}`;
  const project = projects[projectIdx];
  if ((project.tasks || []).some(t => t.slackRef === slackRef)) return;

  const messageText = await getSlackMessage(channel, ts);
  if (!messageText) return;

  const { title, subtasks } = await generateTask(messageText);

  const task = {
    id: uid(),
    title,
    status: "todo",
    dueDate: "",
    priority: "medium",
    desc: messageText,
    assigneeIds: [],
    subtasks: (subtasks || []).map(s => ({ id: uid(), title: s, done: false })),
    relatedDecisionIds: [],
    slackRef,
    needsReview: true,
  };

  const updatedProjects = projects.map((p, i) =>
    i === projectIdx ? { ...p, tasks: [...(p.tasks || []), task] } : p
  );
  await saveProjects(updatedProjects);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const body = req.body;

  // Slack URL verification
  if (body?.type === "url_verification") {
    return res.status(200).json({ challenge: body.challenge });
  }

  // 即座に200を返す（Slackの3秒タイムアウト対策）
  res.status(200).end();

  const event = body?.event;
  if (!event || event.type !== "reaction_added" || event.reaction !== "white_check_mark") return;
  if (event.item?.type !== "message") return;

  try {
    await processReaction(event);
  } catch (e) {
    console.error("slack-events error:", e.message);
  }
};
