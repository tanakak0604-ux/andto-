import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
});

async function loadUpdatedAt() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared&select=updated_at`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    return data?.[0]?.updated_at || null;
  } catch { return null; }
}

async function loadProjects() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared&select=projects`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    });
    const data = await res.json();
    if (data && data[0] && data[0].projects) return data[0].projects;
  } catch (e) {
    console.error("loadProjects エラー:", e);
    throw e;
  }
  return null;
}

async function saveProjects(projects) {
  const now = new Date().toISOString();
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ projects, updated_at: now })
    });
  } catch (e) {
    console.error("saveProjects エラー:", e);
    throw e;
  }
  return now;
}

async function loadSlackSettings() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared&select=slack_settings`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    const settings = data?.[0]?.slack_settings || { summaryChannel: "", notifyChannel: "", sourceChannels: [] };
    return settings;
  } catch (_) {}
  return null;
}

async function saveSlackSettings(slackSettings) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.shared`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ slack_settings: slackSettings, updated_at: new Date().toISOString() })
    });
    const result = await res.json();
    console.log("保存結果", res.status, result);
  } catch (e) {
    console.error("保存エラー", e);
  }
}


// ── 日次バックアップ ─────────────────────────────────────────
// 同じテーブルに backup_YYYYMMDD というidの行としてスナップショットを保存する
// （サーバーAPIはすべて id=eq.shared で絞っているため既存処理に影響しない）
const BACKUP_KEEP = 14; // 直近14日分を保持
const sbHeaders = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };

async function listBackups() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=like.backup*&select=id,updated_at&order=id.desc`, { headers: sbHeaders });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function loadBackup(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.${encodeURIComponent(id)}&select=projects`, { headers: sbHeaders });
  const data = await res.json();
  return data?.[0]?.projects || null;
}

async function deleteBackup(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: sbHeaders });
}

// その日最初の起動時に、読み込んだ時点のデータをスナップショットとして残す
async function ensureDailyBackup(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return { ok: false, skipped: true };
  const t = new Date();
  const key = `backup_${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, "0")}${String(t.getDate()).padStart(2, "0")}`;
  try {
    const existing = await (await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data?id=eq.${key}&select=id`, { headers: sbHeaders })).json();
    if (Array.isArray(existing) && existing.length > 0) return { ok: true, existed: true };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/taskflow_data`, {
      method: "POST",
      headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ id: key, projects, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 200)}` };
    // 保持数を超えた古いバックアップを削除
    const all = await listBackups();
    for (const b of all.slice(BACKUP_KEEP)) await deleteBackup(b.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export { supabase, loadUpdatedAt, loadProjects, saveProjects, loadSlackSettings, saveSlackSettings, listBackups, loadBackup, ensureDailyBackup };
