/**
 * Slack タスク期日通知 - Vercel Cron Job
 *
 * 【環境変数の設定手順】
 * Vercel ダッシュボード → プロジェクト → Settings → Environment Variables に以下を追加:
 *
 *   SLACK_BOT_TOKEN   : Slack Bot Token (xoxb-で始まるトークン)
 *                       取得場所: https://api.slack.com/apps → OAuth & Permissions → Bot User OAuth Token
 *                       必要なスコープ: chat:write, im:write
 *
 *   CRON_SECRET       : 任意の文字列 (Cron リクエストの認証用)
 *                       例: openssl rand -hex 32 で生成
 *
 *   REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY
 *                       : 既存の Supabase 設定と同じ値
 *
 * 【通知タイミング】
 *   毎日 09:00 JST (00:00 UTC) に実行
 *   - 期日の 7 日前
 *   - 期日の 1 日前
 *   - 期日当日
 *   - 期限切れ（月曜のみ）
 *
 * 【通知先】
 *   Supabase の slack_settings.notifyChannel チャンネルへ投稿
 *   担当者に slackId が設定されていれば個別メンション
 */

const FALLBACK_NOTIFY_USER_ID = "U037A6QU4QY"; // 田中航平（SlackID未設定時のフォールバック）

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

module.exports = async function handler(req, res) {
  // Vercel Cron からのリクエストのみ受け付ける
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
  if (!SLACK_BOT_TOKEN) {
    return res.status(500).json({ error: "SLACK_BOT_TOKEN is not set" });
  }

  // Supabase から Slack 設定を取得
  const slackSettings = await loadSlackSettings();
  const NOTIFY_CHANNEL = slackSettings?.notifyChannel || "";
  if (!NOTIFY_CHANNEL) {
    return res.status(500).json({ error: "notifyChannel is not configured in slackSettings" });
  }

  // Supabase からプロジェクトデータを取得
  let projects = [];
  try {
    const supaRes = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared&select=projects`,
      {
        headers: {
          apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
      }
    );
    const data = await supaRes.json();
    if (data && data[0] && data[0].projects) projects = data[0].projects;
  } catch (e) {
    return res.status(500).json({ error: "Failed to fetch projects", detail: e.message });
  }

  // 今日の日付（JST基準）
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayJst = new Date(nowJst);
  todayJst.setUTCHours(0, 0, 0, 0);
  const isMonday = todayJst.getUTCDay() === 1;

  // メンバーのSlackIDマップを全プロジェクト横断で構築
  const memberSlackIdMap = {};
  for (const project of projects) {
    for (const m of project.members || []) {
      if (m.id && m.slackId) memberSlackIdMap[m.id] = m.slackId;
    }
  }

  // 通知対象タスクを収集
  const notifications = [];
  for (const project of projects) {
    for (const task of project.tasks || []) {
      if (!task.dueDate || task.status === "done") continue;
      const due = new Date(task.dueDate + "T00:00:00+09:00");
      const diffDays = Math.round((due - todayJst) / (1000 * 60 * 60 * 24));

      const shouldNotify =
        diffDays === 7 ||
        diffDays === 1 ||
        diffDays === 0 ||
        (diffDays < 0 && isMonday);

      if (!shouldNotify) continue;

      // 担当者名とSlackIDを解決
      const assignees = (task.assigneeIds || [])
        .map((id) => {
          const member = (project.members || []).find((m) => m.id === id);
          return member ? { name: member.name, slackId: memberSlackIdMap[id] || null } : null;
        })
        .filter(Boolean);

      const assigneeNames = assignees.map(a => a.name).join("・") || "（未割当）";
      const mentionParts = assignees
        .map(a => a.slackId ? `<@${a.slackId}>` : null)
        .filter(Boolean);
      const mention = mentionParts.length > 0
        ? mentionParts.join(" ")
        : `<@${FALLBACK_NOTIFY_USER_ID}>`;

      notifications.push({ task, project, diffDays, assigneeNames, mention });
    }
  }

  // Slack チャンネル投稿
  let sent = 0;
  for (const { task, project, diffDays, assigneeNames, mention } of notifications) {
    let label;
    if (diffDays < 0) {
      label = `🚨 *期限切れ（${Math.abs(diffDays)}日経過）*`;
    } else if (diffDays === 0) {
      label = "⚠️ *本日が期日です*";
    } else if (diffDays === 1) {
      label = "⚠️ *明日が期日です*";
    } else {
      label = "📅 *1週間後が期日です*";
    }
    const relatedDecision = (project.decisions || []).find((d) => d.source && task.title && d.source.includes(task.title))?.text || "—";
    const text = [
      mention,
      label,
      `プロジェクト: ${project.name}`,
      `決定事項　　: ${relatedDecision}`,
      `タスク名　　: ${task.title}`,
      `期日　　　　: ${task.dueDate}`,
      `担当者　　　: ${assigneeNames}`,
    ].join("\n");

    try {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: NOTIFY_CHANNEL, text }),
      });
      sent++;
    } catch (_) {
      // 送信エラーは無視して続行
    }
  }

  res.json({ ok: true, checked: notifications.length, sent });
};
