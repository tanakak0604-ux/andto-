// アプリ全体のスモークテスト：全ページモジュールが正しく読み込めて、初期画面が表示されること
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

const channelStub = {
  on() { return this; },
  subscribe() { return this; },
  send() {},
};

vi.mock("./lib/supabase", () => ({
  supabase: {
    channel: () => channelStub,
    removeChannel: () => {},
  },
  loadUpdatedAt: async () => null,
  loadProjects: async () => [
    { id: "p1", name: "テスト用プロジェクト", color: "#6B8F71", desc: "", minutes: [], members: [], tasks: [] },
  ],
  saveProjects: async () => new Date().toISOString(),
  loadSlackSettings: async () => null,
  saveSlackSettings: async () => {},
}));

describe("App", () => {
  it("起動してプロジェクト一覧が表示される", async () => {
    render(<App />);
    const matches = await screen.findAllByText("テスト用プロジェクト");
    expect(matches.length).toBeGreaterThan(0);
  });
});
