import { describe, it, expect } from "vitest";
import { escapeHtml, uid, removeTimestampRegression, removeLoopedLines, extractJsonArray } from "./text";

describe("escapeHtml", () => {
  it("HTML特殊文字をエスケープする", () => {
    expect(escapeHtml(`<div a="b">&'</div>`)).toBe("&lt;div a=&quot;b&quot;&gt;&amp;&#039;&lt;/div&gt;");
  });
  it("通常の文字列はそのまま", () => {
    expect(escapeHtml("議事録テスト")).toBe("議事録テスト");
  });
});

describe("uid", () => {
  it("英数字のIDを生成する", () => {
    expect(uid()).toMatch(/^[a-z0-9]+$/);
  });
  it("呼ぶたびに異なる値を返す", () => {
    const ids = new Set(Array.from({ length: 50 }, () => uid()));
    expect(ids.size).toBeGreaterThan(45);
  });
});

describe("removeTimestampRegression", () => {
  it("タイムスタンプが60秒以上逆戻りしたら以降を打ち切る", () => {
    const input = "[10:00] 発言A\n[10:30] 発言B\n[00:10] ループした発言\n[00:20] これも不要";
    expect(removeTimestampRegression(input)).toBe("[10:00] 発言A\n[10:30] 発言B");
  });
  it("60秒未満の逆戻りは許容する", () => {
    const input = "[10:00] 発言A\n[09:30] 少し戻る発言";
    expect(removeTimestampRegression(input)).toBe(input);
  });
  it("タイムスタンプのない行はそのまま残す", () => {
    const input = "見出し\n[01:00] 発言A\n備考";
    expect(removeTimestampRegression(input)).toBe(input);
  });
});

describe("removeLoopedLines", () => {
  it("同じ内容の連続は1回だけ残し、3回以上続いたら打ち切る", () => {
    const input = "同じ発言\n同じ発言\n同じ発言\n後続の発言";
    expect(removeLoopedLines(input)).toBe("同じ発言");
  });
  it("タイムスタンプ違いでも内容が同じならループと判定する", () => {
    const input = "[00:01] 繰り返し\n[00:05] 繰り返し\n[00:09] 繰り返し\n[00:13] 別の発言";
    expect(removeLoopedLines(input)).toBe("[00:01] 繰り返し");
  });
  it("異なる内容の行はすべて残す", () => {
    const input = "発言A\n発言B\n発言C";
    expect(removeLoopedLines(input)).toBe(input);
  });
});

describe("extractJsonArray", () => {
  it("素のJSON配列をパースする", () => {
    expect(extractJsonArray('[{"name":"田中"}]')).toEqual([{ name: "田中" }]);
  });
  it("コードフェンス付きJSONをパースする", () => {
    expect(extractJsonArray('```json\n[{"name":"佐藤"}]\n```')).toEqual([{ name: "佐藤" }]);
  });
  it("前後に文章があっても配列部分を抽出する", () => {
    expect(extractJsonArray('結果は以下です。\n[1, 2, 3]\n以上。')).toEqual([1, 2, 3]);
  });
  it("配列がなければエラーを投げる", () => {
    expect(() => extractJsonArray("配列はありません")).toThrow("JSON配列が見つかりません");
  });
});
