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
 *
 * 【通知先】
 *   田中航平 (Slack user_id: U037A6QU4QY) へ DM
 */

const NOTIFY_USER_ID = "U037A6QU4QY"; // 田中航平

module.exports = async function handler(req, res) {
  // Vercel Cron からのリクエストのみ受け付ける
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
  if (!SLACK_BOT_TOKEN) {
    return res.status(500).json({ error: "SLACK_BOT_TOKEN is not set" });
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

  // 今日の日付（時刻なし）
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 通知対象タスクを収集
  const notifications = [];
  for (const project of projects) {
    for (const task of project.tasks || []) {
      if (!task.dueDate || task.status === "done") continue;
      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
      if (diffDays === 7 || diffDays === 1) {
        // 担当者名を解決
        const assigneeNames = (task.assigneeIds || [])
          .map((id) => (project.members || []).find((m) => m.id === id)?.name)
          .filter(Boolean)
          .join("・") || "（未割当）";

        notifications.push({ task, project, diffDays, assigneeNames });
      }
    }
  }

  // Slack DM 送信
  let sent = 0;
  for (const { task, project, diffDays, assigneeNames } of notifications) {
    const label = diffDays === 1 ? "⚠️ *明日が期日です*" : "📅 *1週間後が期日です*";
    const text = [
      label,
      `タスク名　: ${task.title}`,
      `期日　　　: ${task.dueDate}`,
      `プロジェクト: ${project.name}`,
      `担当者　　: ${assigneeNames}`,
    ].join("\n");

    try {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: NOTIFY_USER_ID, text }),
      });
      sent++;
    } catch (_) {
      // 送信エラーは無視して続行
    }
  }

  res.json({ ok: true, checked: notifications.length, sent });
};
