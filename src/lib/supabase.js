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


export { supabase, loadUpdatedAt, loadProjects, saveProjects, loadSlackSettings, saveSlackSettings };
