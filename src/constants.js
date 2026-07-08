
const BTN = {
  ghost:     { background:"transparent", border:"1.5px solid #9E9E9E", color:"#616161", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  primary:   { background:"#4A9B8E", border:"none", color:"#fff", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  pdf:       { background:"#E8412A", border:"none", color:"#fff", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  danger:    { background:"transparent", border:"1.5px solid #E53935", color:"#E53935", borderRadius:6, padding:"6px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  primaryLg: { background:"#4A9B8E", border:"none", color:"#fff", borderRadius:6, padding:"10px 24px", fontSize:14, fontWeight:600, cursor:"pointer" },
};

const C = {
  bg: "#F5F2EC", surface: "#FDFAF5", border: "#E2DDD4",
  text: "#2D2A24", muted: "#8C8880", accent: "#C8694A",
  accentLight: "#F5E6E0", sage: "#6B8F71", sageLight: "#E8F0E9",
  todo: "#C8694A", doing: "#C8A84B", done: "#6B8F71",
  todoLight: "#F5E6E0", doingLight: "#FBF5E0", doneLight: "#E8F0E9",
  hover: "#EDEBE4",
  decision: "#5B7EC9", decisionLight: "#EEF3FF",
};

const INIT_PROJECTS = [
  { id: "p1", name: "プロダクト開発", color: "#6B8F71", desc: "", minutes: [], members: [
    { id: "m1", name: "田中", org: "株式会社A", isAndto: false },
    { id: "m2", name: "鈴木", org: "株式会社A", isAndto: false },
    { id: "m3", name: "山田", org: "andto", isAndto: true },
  ], tasks: [
    { id: "t1", title: "要件定義ドキュメント作成", status: "todo", dueDate: "2025-03-10", priority: "high", desc: "" },
    { id: "t2", title: "UIモックアップ作成", status: "doing", dueDate: "2025-03-12", priority: "medium", desc: "" },
    { id: "t3", title: "バックエンドAPI設計", status: "todo", dueDate: "2025-03-15", priority: "high", desc: "" },
    { id: "t4", title: "ユーザーテスト実施", status: "done", dueDate: "2025-03-05", priority: "low", desc: "" },
  ]},
  { id: "p2", name: "マーケティング", color: "#C8A84B", desc: "", minutes: [], members: [
    { id: "m4", name: "佐藤", org: "株式会社B", isAndto: false },
    { id: "m5", name: "中村", org: "andto", isAndto: true },
  ], tasks: [
    { id: "t5", title: "SNSコンテンツ計画", status: "doing", dueDate: "2025-03-08", priority: "medium", desc: "" },
    { id: "t6", title: "ランディングページ改修", status: "todo", dueDate: "2025-03-20", priority: "high", desc: "" },
    { id: "t7", title: "メルマガ原稿", status: "done", dueDate: "2025-03-01", priority: "low", desc: "" },
  ]},
  { id: "p3", name: "インフラ", color: "#7B9EC0", desc: "", minutes: [], members: [], tasks: [
    { id: "t8", title: "サーバー移行計画", status: "todo", dueDate: "2025-03-25", priority: "high", desc: "" },
    { id: "t9", title: "監視設定レビュー", status: "doing", dueDate: "2025-03-11", priority: "medium", desc: "" },
  ]},
];


function btn(extra = {}) { return { border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", ...extra }; }


const COLOR_PALETTE = [
  // グリーン系
  "#6B8F71","#4A9B8E","#3D8B6E","#8EC07C",
  // ブルー系
  "#7B9EC0","#4A7FB5","#5B8DB8","#7BAFD4",
  // パープル系
  "#9B8EC0","#7B6BAF","#A87BC0","#C0A0C8",
  // レッド・ピンク系
  "#C8694A","#C8697A","#B85C6E","#D4826E",
  // イエロー・オレンジ系
  "#C8A84B","#D4956A","#C8873A","#B8A042",
  // グレー系
  "#8E9B4A","#7A8A6E","#9A9A9A","#6E8080",
];
const PHASE_LABELS = ["調査企画", "基本計画", "基本設計", "実施設計", "監理", "竣工"];


export { BTN, C, INIT_PROJECTS, btn, COLOR_PALETTE, PHASE_LABELS };
