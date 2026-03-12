/**
 * Slack → TaskFlow タスク自動登録 Webhook
 *
 * 【概要】
 * Slack のメッセージに ✅ (white_check_mark) リアクションをつけると、
 * Gemini AI がメッセージからタスク情報を抽出し、紐づくプロジェクトに自動登録します。
 *
 * ─────────────────────────────────────────────────────────────
 * 【Vercel 環境変数の設定手順】
 * Vercel ダッシュボード → プロジェクト → Settings → Environment Variables に追加:
 *
 *   SLACK_BOT_TOKEN
 *     Slack Bot Token (xoxb- で始まるトークン)
 *     取得: https://api.slack.com/apps → OAuth & Permissions → Bot User OAuth Token
 *     必要スコープ: reactions:read, channels:history, groups:history,
 *                   im:history, mpim:history, chat:write
 *
 *   SLACK_SIGNING_SECRET
 *     Slack App の署名検証用シークレット
 *     取得: https://api.slack.com/apps → Basic Information → App Credentials → Signing Secret
 *
 *   GEMINI_API_KEY / REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY
 *     既存の設定と同じ値を使用
 *
 * ─────────────────────────────────────────────────────────────
 * 【Slack App の設定手順】
 * 1. https://api.slack.com/apps でアプリを作成
 * 2. Event Subscriptions → Enable Events: ON
 *    Request URL: https://<your-vercel-domain>/api/slack-webhook
 * 3. Subscribe to bot events に追加: reaction_added
 * 4. OAuth & Permissions → Scopes に上記スコープを追加してインストール
 * ─────────────────────────────────────────────────────────────
 */

const crypto = require("crypto");

// 処理済み event_id を記録（重複イベント処理防止）
const processedEventIds = new Set();

// Vercel のボディパーサーを無効化（署名検証のために生の body が必要）
async function handler(req, res) {
  // GET は無視
  if (req.method === "GET") return res.status(200).json({ ok: true, service: "TaskFlow Slack Webhook" });

  if (req.method !== "POST") return res.status(405).end();

  // ── 1. 生の body を取得 ────────────────────────────────────
  const rawBody = await getRawBody(req);
  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }

  // ── 2. Slack URL Verification チャレンジ ──────────────────
  if (payload.type === "url_verification") {
    return res.status(200).json({ challenge: payload.challenge });
  }

  // ── 3. リクエスト署名の検証 ───────────────────────────────
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (signingSecret) {
    const timestamp = req.headers["x-slack-request-timestamp"] || "";
    const slackSig = req.headers["x-slack-signature"] || "";
    // リプレイ攻撃防止: 5分以上古いリクエストを拒否
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
      return res.status(403).json({ error: "Request too old" });
    }
    const baseString = `v0:${timestamp}:${rawBody}`;
    const myHmac = "v0=" + crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(myHmac), Buffer.from(slackSig))) {
      return res.status(403).json({ error: "Invalid signature" });
    }
  }

  // ── 3.5. 重複イベント処理防止 ─────────────────────────────
  const eventId = payload.event_id;
  if (eventId) {
    if (processedEventIds.has(eventId)) {
      return res.status(200).json({ ok: true, skipped: "duplicate" });
    }
    processedEventIds.add(eventId);
  }

  // ── 4. reaction_added イベントのみ処理 ────────────────────
  const event = payload.event;
  if (!event || event.type !== "reaction_added" || event.reaction !== "white_check_mark") {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const channelId = event.item?.channel;
  const messageTs = event.item?.ts;
  if (!channelId || !messageTs) return res.status(200).json({ ok: true });

  try {
    // ── 5. 元のメッセージを取得 ────────────────────────────
    const messageText = await fetchSlackMessage(channelId, messageTs);
    if (!messageText) return res.status(200).json({ ok: true, skipped: "no message text" });

    // ── 6. Supabase からプロジェクトデータを取得 ──────────
    const projects = await loadProjects();
    if (!projects) return res.status(200).json({ ok: true, skipped: "no projects" });

    // ── 7. チャンネルに紐づくプロジェクトを検索 ──────────
    const project = projects.find(p => p.slackChannelId === channelId);
    if (!project) {
      console.log(`No project linked to channel ${channelId}`);
      return res.status(200).json({ ok: true, skipped: `channel ${channelId} not linked` });
    }

    // ── 8. Gemini でタスク情報を抽出 ──────────────────────
    const taskInfo = await extractTaskFromMessage(messageText, project.members || []);

    // ── 9. タスクをプロジェクトに追加して Supabase に保存 ──
    const newTask = {
      id: "t" + Date.now() + Math.random().toString(36).slice(2, 6),
      title: taskInfo.title || messageText.slice(0, 60),
      status: "todo",
      priority: taskInfo.priority || "medium",
      dueDate: taskInfo.dueDate || "",
      assigneeIds: resolveAssigneeIds(taskInfo.assignee, project.members || []),
      desc: `Slackから自動登録\n元メッセージ: ${messageText.slice(0, 200)}`,
      subtasks: [],
      relatedDecisionIds: [],
      source: "slack",
      slackChannel: channelId,
      slackTs: messageTs,
    };

    const updatedProject = { ...project, tasks: [...(project.tasks || []), newTask] };
    const updatedProjects = projects.map(p => p.id === project.id ? updatedProject : p);
    await saveProjects(updatedProjects);

    // ── 10. Slack に登録完了を通知（スレッドに返信） ───────
    await postSlackReply(channelId, messageTs, project, newTask);

    return res.status(200).json({ ok: true, taskId: newTask.id, projectId: project.id });
  } catch (e) {
    console.error("slack-webhook error:", e);
    return res.status(200).json({ ok: true, error: e.message }); // Slack には常に200を返す
  }
}

// ── ユーティリティ関数 ───────────────────────────────────────

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function fetchSlackMessage(channelId, ts) {
  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channelId}&latest=${ts}&limit=1&inclusive=true`,
    { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } }
  );
  const data = await res.json();
  if (!data.ok || !data.messages?.[0]) return null;
  return data.messages[0].text || null;
}

async function loadProjects() {
  try {
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
    return data?.[0]?.projects || null;
  } catch { return null; }
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
      body: JSON.stringify({ projects, updated_at: new Date().toISOString() }),
    }
  );
}

async function extractTaskFromMessage(messageText, members) {
  const memberNames = members.map(m => m.name).join("、") || "なし";
  const prompt = `以下のSlackメッセージからタスク情報を抽出し、JSON形式のみで返してください（コードブロック不要）。

メッセージ: "${messageText}"

プロジェクトメンバー（担当者候補）: ${memberNames}

出力形式:
{
  "title": "タスク名（具体的なアクションを表す簡潔な日本語、最大40文字）",
  "assignee": "担当者名（メンバーリストから一致する名前、なければnull）",
  "dueDate": "YYYY-MM-DD形式の期日（言及があれば、なければnull）",
  "priority": "high/medium/low（緊急・至急ならhigh、デフォルトはmedium）"
}`;

  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 512 },
      }),
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    // JSON部分だけを抽出（```json ... ``` も考慮）
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  } catch {
    return { title: messageText.slice(0, 40), priority: "medium" };
  }
}

function resolveAssigneeIds(assigneeName, members) {
  if (!assigneeName) return [];
  const m = members.find(m => m.name === assigneeName || assigneeName.includes(m.name));
  return m ? [m.id] : [];
}

async function postSlackReply(channelId, ts, project, task) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  const text = [
    `✅ *TaskFlow にタスクを登録しました*`,
    `プロジェクト: *${project.name}*`,
    `タスク名: ${task.title}`,
    task.dueDate ? `期日: ${task.dueDate}` : null,
  ].filter(Boolean).join("\n");

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: channelId, thread_ts: ts, text }),
  });
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
