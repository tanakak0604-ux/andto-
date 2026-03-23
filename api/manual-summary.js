/**
 * 週次サマリー手動実行エンドポイント
 * Supabase anon key で認証（フロントから呼べる）
 */

const weeklySummaryHandler = require("./weekly-summary");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Supabase anon key で認証
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // CRON_SECRET をセットして weekly-summary ハンドラに委譲
  req.method = "GET";
  req.headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
  return weeklySummaryHandler(req, res);
};
