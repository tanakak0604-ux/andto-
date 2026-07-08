import { describe, it, expect, vi, beforeEach } from "vitest";
import { callClaude, transcribeLongAudio } from "./gemini";

const jsonResponse = (obj, status = 200) => ({
  status,
  text: async () => JSON.stringify(obj),
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("callClaude", () => {
  it("成功時はテキストを返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "こんにちは" }] })));
    await expect(callClaude({ messages: [{ role: "user", content: "hi" }] })).resolves.toBe("こんにちは");
  });

  it("APIエラー時はメッセージ付きで例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { message: "クォータ超過" } })));
    await expect(callClaude({ messages: [] })).rejects.toThrow("クォータ超過");
  });

  it("413（サイズ超過）はわかりやすいエラーにする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 413, text: async () => "Request Entity Too Large" }));
    await expect(callClaude({ messages: [] })).rejects.toThrow("ファイルが大きすぎます");
  });
});

describe("transcribeLongAudio", () => {
  it("truncatedの間は自動で続きを取得して結合する", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ content: [{ text: "[00:01] 発言A\n[00:05] 発言B" }], truncated: true }))
      .mockResolvedValueOnce(jsonResponse({ content: [{ text: "[00:09] 発言C" }], truncated: false }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeLongAudio({
      audioFileUri: "files/test123",
      mimeType: "audio/m4a",
      firstPrompt: "文字起こしして",
    });

    expect(result).toBe("[00:01] 発言A\n[00:05] 発言B\n[00:09] 発言C");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 2回目のリクエストは「続きから」プロンプトになっている
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.messages[0].content).toContain("続きから");
    expect(secondBody.messages[0].content).toContain("発言B");
    expect(secondBody.collectPartial).toBe(true);
  });

  it("truncatedでなければ1回で終わる", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ content: [{ text: "[00:01] 完結した発言" }], truncated: false }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await transcribeLongAudio({ audioFileUri: "files/x", mimeType: "audio/wav", firstPrompt: "p" });
    expect(result).toBe("[00:01] 完結した発言");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("進捗コールバックが呼ばれる", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ content: [{ text: "前半" }], truncated: true }))
      .mockResolvedValueOnce(jsonResponse({ content: [{ text: "後半" }], truncated: false }));
    vi.stubGlobal("fetch", fetchMock);
    const passes = [];
    await transcribeLongAudio({ audioFileUri: "files/x", mimeType: "audio/wav", firstPrompt: "p", onPass: n => passes.push(n) });
    expect(passes).toEqual([1, 2]);
  });
});
