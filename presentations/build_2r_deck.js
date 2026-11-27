// 강사잇다 — 모두의 창업 2R 발표 자료 (사업계획서 v3 기반)
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");
const { applyTheme } = require("/root/.claude/skills/synced/0e85ab50-9851-44e5-91f6-d948d396ff1c_79f9315a-5332-4003-8526-17928ca6516f/pptx/scripts/apply_theme.js");

const OUT = process.argv[2] || "deck.pptx";
const FONT = "맑은 고딕";
const THEME = {
  name: "Gangsaitda",
  headFontFace: FONT,
  bodyFontFace: FONT,
  colors: {
    dk1: "1F2430", lt1: "FFFFFF", dk2: "163072", lt2: "F3F5FA",
    accent1: "163072", accent2: "E76310", accent3: "E3E8F3", accent4: "FDECE0",
    accent5: "5B6FA8", accent6: "8B95A1", hlink: "163072", folHlink: "5B6FA8",
  },
};
const HEX = { navy: "163072", orange: "E76310", tint: "E3E8F3", otint: "FDECE0", mid: "5B6FA8", muted: "8B95A1", ink: "1F2430", ink2: "4E5968", line: "D7DCE3", bg: "F3F5FA", soft: "A9B6D6", red: "D9434E" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
pres.title = "강사잇다 모두의 창업 2R 발표";
pres.author = "강사잇다";
const C = pres.SchemeColor;
const NAVY = C.accent1, ORANGE = C.accent2, TINT = C.accent3, OTINT = C.accent4, MID = C.accent5, MUTED = C.accent6, INK = C.text1, WHITE = C.background1, BG = C.background2;
const INK2 = HEX.ink2, LINE = HEX.line;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: "FFFFFF" },
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: 0.6, y: 0.36, w: 9, h: 0.34, fontSize: 13, bold: true, color: ORANGE, margin: 0, valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.7, w: 12.13, h: 0.78, fontSize: 28, bold: true, color: NAVY, margin: 0, valign: "middle", align: "left" }, text: "" } },
    { text: { text: "강사잇다 · 모두의 창업 2R", options: { x: 0.6, y: 7.02, w: 5, h: 0.3, fontSize: 10, color: MUTED, margin: 0 } } },
  ],
  slideNumber: { x: 12.23, y: 7.02, w: 0.5, h: 0.3, fontSize: 10, color: MUTED, align: "right", margin: 0 },
});
pres.defineSlideMaster({
  title: "COVER",
  background: { color: "163072" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.55, w: 7.2, h: 1.2, fontSize: 60, bold: true, color: WHITE, margin: 0, valign: "middle", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.85, w: 7.2, h: 1.0, fontSize: 22, color: WHITE, margin: 0, valign: "top", align: "left" }, text: "" } },
  ],
});

// ---------- helpers ----------
let N = 0;
const oid = (p) => `${p}-${++N}`;
function T(s, text, o) {
  s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 14, color: INK, valign: "top", objectName: oid("text") }, o));
}
function R(s, o) { // rounded card
  const { x, y, w, h, fill = BG, line, r = 0.12, lw = 1, shadow } = o;
  const opt = { x, y, w, h, rectRadius: r, fill: { color: fill }, line: line ? { color: line, width: lw } : { type: "none" }, objectName: oid("card") };
  if (shadow) opt.shadow = { type: "outer", color: "1F2430", opacity: 0.12, blur: 8, offset: 2, angle: 90 };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, opt);
}
function Rect(s, o) {
  const { x, y, w, h, fill = BG, line, lw = 1 } = o;
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill }, line: line ? { color: line, width: lw } : { type: "none" }, objectName: oid("rect") });
}
function Oval(s, o) {
  const { x, y, w, h, fill, line, lw = 1.5 } = o;
  s.addShape(pres.shapes.OVAL, { x, y, w, h, fill: fill ? { color: fill } : { type: "none" }, line: line ? { color: line, width: lw } : { type: "none" }, objectName: oid("oval") });
}
function L(s, x1, y1, x2, y2, o = {}) {
  const line = { color: o.color || HEX.muted, width: o.width || 1.5 };
  if (o.arrow) line.endArrowType = "triangle";
  if (o.dash) line.dashType = o.dash;
  s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line, objectName: oid("line") });
}
function pill(s, text, x, y, w, h, fill, color, size = 12) {
  R(s, { x, y, w, h, fill, r: h / 2 });
  T(s, text, { x, y, w, h, fontSize: size, bold: true, color, align: "center", valign: "middle" });
}
const iconCache = {};
async function icon(name, hex, px = 256) {
  const key = name + hex;
  if (iconCache[key]) return iconCache[key];
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(fa[name], { color: "#" + hex, size: px }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return (iconCache[key] = "image/png;base64," + buf.toString("base64"));
}
async function iconCircle(s, name, x, y, d, fill, fg) {
  Oval(s, { x, y, w: d, h: d, fill });
  const k = d * 0.5;
  s.addImage({ data: await icon(name, fg), x: x + (d - k) / 2, y: y + (d - k) / 2, w: k, h: k, objectName: oid("icon") });
}
function content(kicker, title, section) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(kicker, { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  return s;
}
function source(s, text) { T(s, text, { x: 0.6, y: 6.6, w: 12.13, h: 0.32, fontSize: 10, color: MUTED, valign: "bottom" }); }
const chartText = { catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt", titleFontFace: "+mn-lt" };

(async () => {
  // ===== 1. 표지 =====
  pres.addSection({ title: "시작" });
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: "시작" });
    pill(s, "모두의 창업 2R 발표", 0.8, 1.85, 2.3, 0.44, ORANGE, WHITE, 14);
    s.addText("강사잇다", { placeholder: "title" });
    s.addText("공고 찾기부터 첫 출강까지,\n강사와 기관을 잇는 서비스", { placeholder: "body" });
    T(s, "박서현 대표  ·  2026.11  ·  www.gangsaitda.com", { x: 0.8, y: 6.2, w: 7, h: 0.4, fontSize: 14, color: "C9D1E6" });
    // 모티프: 강사 ● — 잇다 — ● 기관
    L(s, 10.0, 3.75, 10.9, 3.75, { color: HEX.orange, width: 5 });
    Oval(s, { x: 7.8, y: 2.65, w: 2.2, h: 2.2, fill: WHITE });
    Oval(s, { x: 10.9, y: 2.65, w: 2.2, h: 2.2, fill: "2A4489" });
    T(s, "강사", { x: 7.8, y: 3.35, w: 2.2, h: 0.5, fontSize: 24, bold: true, color: NAVY, align: "center", valign: "middle" });
    T(s, "공급", { x: 7.8, y: 3.85, w: 2.2, h: 0.4, fontSize: 14, color: INK2, align: "center" });
    T(s, "기관", { x: 10.9, y: 3.35, w: 2.2, h: 0.5, fontSize: 24, bold: true, color: WHITE, align: "center", valign: "middle" });
    T(s, "수요", { x: 10.9, y: 3.85, w: 2.2, h: 0.4, fontSize: 14, color: "C9D1E6", align: "center" });
    pill(s, "잇다", 9.9, 4.95, 1.1, 0.44, ORANGE, WHITE, 14);
    s.addNotes("안녕하십니까, 강사잇다 대표 박서현입니다. 강사잇다는 흩어진 공공 강사 공고를 모아 보여 주는 데서 시작해, 신규 강사가 첫 출강까지 갈 수 있도록 교육과 기관 연결을 함께 하는 서비스입니다.");
  }

  // ===== 2. 한눈에 보기 =====
  {
    const s = content("한눈에 보기", "1R 이후 한 달, 강사와 기관의 실제 연결이 시작됐습니다", "시작");
    const k = [["실제 강의 연결", "3", "건", "출강 2건 · 면접 합격 1건", "FaHandshake"], ["유료 데뷔 교육 결제", "10", "명", "데뷔 교육 1기", "FaGraduationCap"], ["회원 수", "500+", "명", "1R 당시 0명", "FaUsers"], ["스레드 누적 조회", "19.1", "만", "1R 당시 5.1만", "FaChartLine"]];
    const w = 2.83, g = 0.27;
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * (w + g), [lab, n, u, sub, ic] = k[i];
      R(s, { x, y: 1.75, w, h: 2.45, fill: i === 0 ? NAVY : BG });
      const fg = i === 0 ? WHITE : NAVY;
      await iconCircle(s, ic, x + 0.3, 2.0, 0.55, i === 0 ? "2A4489" : TINT, i === 0 ? "FFFFFF" : HEX.navy);
      T(s, lab, { x: x + 0.3, y: 2.68, w: w - 0.5, h: 0.35, fontSize: 14, bold: true, color: i === 0 ? "C9D1E6" : INK2 });
      T(s, [{ text: n, options: { fontSize: 44, bold: true, color: fg } }, { text: " " + u, options: { fontSize: 20, bold: true, color: fg } }], { x: x + 0.3, y: 3.0, w: w - 0.5, h: 0.75, valign: "middle" });
      T(s, sub, { x: x + 0.3, y: 3.75, w: w - 0.5, h: 0.3, fontSize: 12, color: i === 0 ? "C9D1E6" : INK2 });
    }
    const st = [["문제", "강사와 기관이 서로를 찾지 못함"], ["해결", "공고 + 데뷔 교육 + 인증 배지 + 기관 연결"], ["수익", "데뷔 교육 30만 원 · 노출·광고비"], ["성장", "2028년 회원 2,000명 · 협력 기관 30곳"]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * (w + g);
      R(s, { x, y: 4.6, w, h: 1.65, fill: "FFFFFF", line: LINE });
      pill(s, st[i][0], x + 0.3, 4.85, 0.9, 0.36, i === 1 ? ORANGE : NAVY, WHITE, 13);
      T(s, st[i][1], { x: x + 0.3, y: 5.35, w: w - 0.55, h: 0.75, fontSize: 15, bold: true, color: INK });
      if (i < 3) L(s, x + w + 0.03, 5.42, x + w + g - 0.03, 5.42, { color: HEX.muted, width: 1.5, arrow: true });
    }
    source(s, "2026.11.27 기준");
    s.addNotes("결론부터 말씀드리면, 1R 이후 한 달 동안 실제 강의 연결 3건, 유료 교육 결제 10명, 회원 500명 이상을 만들었습니다. 오늘은 문제, 해결, 수익, 성장 순서로 말씀드리겠습니다.");
  }

  // ===== 3. 착안 계기 =====
  pres.addSection({ title: "Q1 문제 인식" });
  const S1 = "Q1 문제 인식";
  {
    const s = content("Q1 문제 인식 · 착안 계기", "7년간 강사로 일하며 직접 겪은 ‘일감 찾기’와 ‘첫 경력’의 벽", S1);
    R(s, { x: 0.6, y: 1.8, w: 4.6, h: 2.1, fill: NAVY });
    T(s, "강사 경력", { x: 0.95, y: 2.05, w: 3, h: 0.35, fontSize: 14, bold: true, color: "C9D1E6" });
    T(s, [{ text: "7", options: { fontSize: 60, bold: true, color: WHITE } }, { text: " 년", options: { fontSize: 24, bold: true, color: WHITE } }], { x: 0.95, y: 2.4, w: 3.9, h: 1.0, valign: "middle" });
    T(s, "공고 사이트를 매일 직접 뒤짐", { x: 0.95, y: 3.4, w: 4, h: 0.3, fontSize: 13, color: "C9D1E6" });
    R(s, { x: 0.6, y: 4.15, w: 4.6, h: 2.1, fill: BG });
    T(s, "직접 운영하는 강사 모임", { x: 0.95, y: 4.4, w: 3.8, h: 0.35, fontSize: 14, bold: true, color: INK2 });
    T(s, [{ text: "1,000", options: { fontSize: 60, bold: true, color: NAVY } }, { text: " 명", options: { fontSize: 24, bold: true, color: NAVY } }], { x: 0.95, y: 4.75, w: 3.9, h: 1.0, valign: "middle" });
    T(s, "같은 고민을 반복해서 들음", { x: 0.95, y: 5.75, w: 4, h: 0.3, fontSize: 13, color: INK2 });
    const q = [["“공고를 못 봤어요”", "공고가 교육청·구청·평생교육원에 흩어져 있어 매일 찾아다녀야 함", "FaMagnifyingGlass"], ["“경력이 없어 지원조차 못 해요”", "공고마다 ‘최근 3년 내 강의 경력 1년 이상’ 같은 조건을 요구함", "FaLock"]];
    for (let i = 0; i < 2; i++) {
      const y = 1.8 + i * 2.35;
      R(s, { x: 5.55, y, w: 7.18, h: 2.1, fill: "FFFFFF", line: LINE });
      await iconCircle(s, q[i][2], 5.9, y + 0.35, 0.75, i === 0 ? TINT : OTINT, i === 0 ? HEX.navy : HEX.orange);
      T(s, q[i][0], { x: 6.95, y: y + 0.32, w: 5.5, h: 0.6, fontSize: 24, bold: true, color: i === 0 ? NAVY : ORANGE, valign: "middle" });
      T(s, q[i][1], { x: 6.95, y: y + 1.05, w: 5.5, h: 0.75, fontSize: 15, color: INK2 });
    }
    s.addNotes("저는 7년 동안 프리랜서 강사로 일하며 공고 사이트를 매일 뒤졌습니다. 제가 운영하는 강사 모임 1,000명에게서도 공고를 못 봤다, 경력이 없어 지원조차 못 한다는 고민을 반복해서 들었습니다. 이것이 강사잇다의 출발점입니다.");
  }

  // ===== 4. 문제 구조: 거울 구조(나비형) =====
  {
    const s = content("Q1 문제 인식 · 해결하려는 문제", "강사와 기관이 서로를 찾지 못하는 구조", S1);
    pill(s, "강사 (공급)", 0.6, 1.68, 1.6, 0.38, NAVY, WHITE, 13);
    pill(s, "기관 (수요)", 11.13, 1.68, 1.6, 0.38, INK2, WHITE, 13);
    const rows = [["탐색", ["공고를 못 봄", "교육청·구청·평생교육원에 공고가 흩어져 있음"], ["인맥·지인 추천에 의존", "기관 3곳 인터뷰 공통 답변"]],
      ["신뢰", ["실적이 없어 지원 불가", "‘최근 3년 내 강의 경력 1년 이상’ 요구"], ["새 강사를 검증할 수단 없음", "“1분 영상으로는 판단 어려움”"]],
      ["기회", ["출강 기회 없음", "인맥이 없으면 추천도 못 받음"], ["늘 아는 강사만 다시 섭외", "새로운 강사가 들어갈 틈이 없음"]]];
    rows.forEach(([k, a, b], i) => {
      const y = 2.2 + i * 1.12, h = 0.95, cy = y + h / 2;
      R(s, { x: 0.6, y, w: 4.75, h, fill: TINT });
      T(s, a[0], { x: 0.85, y: y + 0.1, w: 4.3, h: 0.4, fontSize: 16, bold: true, align: "right" });
      T(s, a[1], { x: 0.85, y: y + 0.52, w: 4.3, h: 0.32, fontSize: 12, color: INK2, align: "right" });
      R(s, { x: 7.98, y, w: 4.75, h, fill: BG });
      T(s, b[0], { x: 8.2, y: y + 0.1, w: 4.3, h: 0.4, fontSize: 16, bold: true });
      T(s, b[1], { x: 8.2, y: y + 0.52, w: 4.3, h: 0.32, fontSize: 12, color: INK2 });
      L(s, 5.37, cy, 6.12, cy, { color: HEX.red, width: 1.5, dash: "dash" });
      L(s, 7.21, cy, 7.96, cy, { color: HEX.red, width: 1.5, dash: "dash" });
      Oval(s, { x: 6.17, y: cy - 0.5, w: 1.0, h: 1.0, fill: WHITE, line: HEX.red, lw: 2 });
      T(s, k, { x: 6.17, y: cy - 0.5, w: 1.0, h: 1.0, fontSize: 16, bold: true, color: HEX.red, align: "center", valign: "middle" });
    });
    T(s, "세 지점에서 모두 연결이 끊김", { x: 4.9, y: 1.7, w: 3.53, h: 0.35, fontSize: 13, bold: true, color: HEX.red, align: "center" });
    R(s, { x: 0.6, y: 5.72, w: 12.13, h: 0.85, fill: "FFFFFF", line: HEX.orange, lw: 1.5 });
    T(s, "강사잇다가 채우는 것", { x: 0.85, y: 5.72, w: 2.6, h: 0.85, fontSize: 15, bold: true, color: ORANGE, valign: "middle" });
    [["탐색", "공고를 한 화면에"], ["신뢰", "데뷔 교육 · 인증 배지"], ["기회", "기관 의뢰 연결"]].forEach(([k, t], i) => {
      const x = 3.45 + i * 3.08;
      pill(s, k, x, 5.95, 0.75, 0.4, ORANGE, WHITE, 12);
      T(s, t, { x: x + 0.85, y: 5.95, w: 2.15, h: 0.4, fontSize: 14, bold: true, valign: "middle" });
    });
    source(s, "출처: 기관 3곳 인터뷰, 부산 남구청 공지(2026.7.8), 서대문구청 공고(2025.12.18)");
    s.addNotes("강사와 기관의 문제를 마주 보게 놓으면 세 지점에서 끊겨 있습니다. 탐색에서는 강사가 공고를 못 보고 기관은 인맥에 기댑니다. 신뢰에서는 강사는 실적이 없고 기관은 검증할 방법이 없습니다. 그래서 강사는 기회가 없고 기관은 늘 아는 강사만 부릅니다. 강사잇다는 이 세 지점을 각각 공고, 교육과 인증 배지, 기관 연결로 채웁니다.");
  }

  // ===== 5. 강사의 어려움: 픽토그램 =====
  {
    const s = content("Q1 문제 인식 · 강사가 겪는 어려움", "강사 10명 중 6명이 공고를 놓치고, 4명은 첫 경력에서 막힙니다", S1);
    const on = { o: await icon("FaPerson", HEX.orange), n: await icon("FaPerson", HEX.navy), g: await icon("FaPerson", HEX.line) };
    const rows = [["공고를 놓친 경험", "강사잇다 강사 설문 (n=100, 2026.11)", 6, "o", ORANGE, "60"], ["첫 경력 쌓기가 가장 어려움", "강사잇다 강사 설문 (n=100, 2026.11)", 4, "n", NAVY, "40"]];
    rows.forEach(([lab, src, k, c, col, v], r) => {
      const y = 1.8 + r * 1.5;
      R(s, { x: 0.6, y, w: 12.13, h: 1.3, fill: BG });
      T(s, lab, { x: 0.9, y: y + 0.28, w: 3.3, h: 0.42, fontSize: 17, bold: true });
      T(s, src, { x: 0.9, y: y + 0.72, w: 3.3, h: 0.3, fontSize: 11, color: INK2 });
      for (let i = 0; i < 10; i++) s.addImage({ data: i < k ? on[c] : on.g, x: 4.3 + i * 0.6, y: y + 0.25, w: 0.5, h: 0.8, objectName: oid("person") });
      T(s, [{ text: v, options: { fontSize: 40, bold: true, color: col } }, { text: "%", options: { fontSize: 20, bold: true, color: col } }], { x: 10.5, y, w: 2.0, h: 1.3, align: "right", valign: "middle" });
    });
    const y = 4.8;
    R(s, { x: 0.6, y, w: 12.13, h: 1.3, fill: BG });
    T(s, "정기적인 일감 없음", { x: 0.9, y: y + 0.28, w: 3.3, h: 0.42, fontSize: 17, bold: true });
    T(s, "서울시 프리랜서 1,000명 실태조사 (2018)", { x: 0.9, y: y + 0.72, w: 3.3, h: 0.3, fontSize: 11, color: INK2 });
    R(s, { x: 4.3, y: y + 0.45, w: 5.9, h: 0.4, fill: HEX.line, r: 0.2 });
    R(s, { x: 4.3, y: y + 0.45, w: 5.9 * 0.546, h: 0.4, fill: NAVY, r: 0.2 });
    T(s, [{ text: "54.6", options: { fontSize: 40, bold: true, color: NAVY } }, { text: "%", options: { fontSize: 20, bold: true, color: NAVY } }], { x: 10.5, y, w: 2.0, h: 1.3, align: "right", valign: "middle" });
    R(s, { x: 0.6, y: 6.25, w: 12.13, h: 0.42, fill: OTINT, r: 0.08 });
    T(s, "강사 402명 조사에서 ‘차별화·브랜드 마케팅’이 모든 경력 단계의 요구도 1순위 (김종현·엄우용, 2019, 교육과 학습 9(4))", { x: 0.85, y: 6.25, w: 11.7, h: 0.42, fontSize: 12, valign: "middle" });
    s.addNotes("강사잇다 강사 설문에서 10명 중 6명이 공고를 놓친 경험이 있었고, 10명 중 4명은 첫 경력 쌓기를 가장 어려운 점으로 꼽았습니다. 서울시 프리랜서 실태조사에서도 54.6%가 정기적인 일감이 없다고 답했습니다.");
  }

  // ===== 6. 목표 시장: 깔때기 =====
  {
    const s = content("Q1 문제 인식 · 목표 고객과 시장", "부울경·경북 연 1만 건의 강사 공고부터 시작합니다", S1);
    const lv = [["전체 시장", "9,557억 원", 7.0, TINT, NAVY, "방과후강사 7.4만 명에게 지급된 연간 금액", "국세청 사업소득 원천징수 신고 통계"], ["목표 시장", "연 약 1만 건", 5.4, HEX.soft, NAVY, "부울경·경북 공공기관 강사 공고", "추정: 경남 하루 평균 9.3건 × 4개 지역"], ["초기 고객", "회원 500+명", 3.8, NAVY, WHITE, "이미 모인 강사 커뮤니티", "강사 모임 1,000명 · 당근모임 260명 · 스레드 팔로워 600명"]];
    const cx = 4.1;
    lv.forEach(([t, n, w, f, c, d1, d2], i) => {
      const y = 1.8 + i * 1.5, h = 1.3;
      s.addShape(pres.shapes.TRAPEZOID, { x: cx - w / 2, y, w, h, flipV: true, fill: { color: f }, line: { type: "none" }, adjustPoint: 0.25, objectName: oid("funnel") });
      T(s, t, { x: cx - 1.6, y: y + 0.12, w: 3.2, h: 0.35, fontSize: 13, bold: true, color: c, align: "center" });
      T(s, n, { x: cx - 1.8, y: y + 0.45, w: 3.6, h: 0.6, fontSize: 26, bold: true, color: c, align: "center", valign: "middle" });
      L(s, cx + w / 2 - 0.2, y + h / 2, 8.0, y + h / 2, { color: HEX.line, width: 1, dash: "dash" });
      Oval(s, { x: 7.95, y: y + h / 2 - 0.07, w: 0.14, h: 0.14, fill: ORANGE });
      T(s, d1, { x: 8.25, y: y + 0.2, w: 4.48, h: 0.4, fontSize: 15, bold: true });
      T(s, d2, { x: 8.25, y: y + 0.62, w: 4.48, h: 0.55, fontSize: 12, color: INK2 });
    });
    R(s, { x: 0.6, y: 6.25, w: 12.13, h: 0.42, fill: OTINT, r: 0.08 });
    T(s, "잠재 강사층: 부울경 경력단절여성 16.5만 명 (KOSIS 2025)", { x: 0.85, y: 6.25, w: 11.7, h: 0.42, fontSize: 13, bold: true, valign: "middle" });
    s.addNotes("방과후 강사 7.4만 명에게 지급되는 금액만 연 9,557억 원입니다. 저희는 그중 부울경·경북 공공기관에서 나오는 연 약 1만 건의 강사 공고를 목표 시장으로 잡았고, 이미 모인 회원 500명 이상이 초기 고객입니다. 경력을 강의로 바꾸려는 부울경 경력단절여성만 16.5만 명입니다.");
  }

  // ===== 7. 기존 방식 한계: 2x2 카드 =====
  {
    const s = content("Q1 문제 인식 · 기존 해결 방식의 한계", "기존 서비스에는 ‘실제 연결’이 비어 있습니다", S1);
    const cs = [["공고 모음 서비스", "공고를 모아 보여 줌", "이미 강사인 사람에게만 유용함", "FaListUl"], ["늘봄허브 (공공)", "늘봄·방과후 프로그램 등록", "심사 연 2회, 늘봄·방과후에 한정", "FaLandmark"], ["강사 양성 학원", "60만~298만 원 교육 판매", "공고·기관 연결은 보장하지 않음", "FaUserGraduate"], ["학교 강사 매칭 앱", "강사·학교 연결", "운영 종료 (연결만으로는 지속 어려움)", "FaMobileScreen"]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + (i % 2) * 4.2, y = 1.8 + Math.floor(i / 2) * 2.25, w = 4.0, h = 2.05;
      R(s, { x, y, w, h, fill: BG });
      await iconCircle(s, cs[i][3], x + 0.25, y + 0.25, 0.6, "FFFFFF", HEX.ink2);
      T(s, cs[i][0], { x: x + 1.0, y: y + 0.25, w: 2.85, h: 0.32, fontSize: 16, bold: true });
      T(s, cs[i][1], { x: x + 1.0, y: y + 0.57, w: 2.85, h: 0.3, fontSize: 12, color: INK2 });
      R(s, { x: x + 0.25, y: y + 1.12, w: w - 0.5, h: 0.7, fill: "FFFFFF" });
      Oval(s, { x: x + 0.4, y: y + 1.32, w: 0.3, h: 0.3, fill: HEX.red });
      T(s, "✕", { x: x + 0.4, y: y + 1.32, w: 0.3, h: 0.3, fontSize: 10, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, cs[i][2], { x: x + 0.82, y: y + 1.12, w: w - 1.15, h: 0.7, fontSize: 13, bold: true, valign: "middle" });
    }
    R(s, { x: 9.15, y: 1.8, w: 3.58, h: 4.3, fill: NAVY });
    T(s, "강사잇다는 이 빈칸을 잇습니다", { x: 9.45, y: 2.05, w: 3.0, h: 0.8, fontSize: 18, bold: true, color: WHITE });
    ["공고 무료 제공", "데뷔 교육", "단계별 인증 배지", "기관 의뢰·직접 선택"].forEach((t, i) => {
      const y = 3.05 + i * 0.68;
      Oval(s, { x: 9.48, y: y + 0.08, w: 0.3, h: 0.3, fill: ORANGE });
      T(s, "✓", { x: 9.48, y: y + 0.08, w: 0.3, h: 0.3, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, t, { x: 9.95, y, w: 2.7, h: 0.46, fontSize: 15, bold: true, color: WHITE, valign: "middle" });
    });
    source(s, "출처: 서울시 보도자료(2018.4), timelyedu.kr, 각 서비스 홈페이지 직접 확인(2026.11.23), 양성 학원 가격은 기사·판매 페이지 기준");
    s.addNotes("공고 모음 서비스는 이미 강사인 사람에게만 유용하고, 양성 학원은 60만~298만 원의 교육을 팔지만 연결은 보장하지 않습니다. 강사와 학교를 연결하던 앱은 운영을 종료했습니다. 연결만으로는 지속이 어렵다는 뜻이고, 그래서 강사잇다는 교육과 인증, 연결을 함께 묶었습니다.");
  }

  // ===== 8. 서비스: 입구 + 선순환 고리 =====
  pres.addSection({ title: "Q2 실현 가능성" });
  const S2 = "Q2 실현 가능성";
  {
    const s = content("Q2 실현 가능성 · 핵심 기능", "공고 찾기부터 첫 출강까지 한 번에 이어 줍니다", S2);
    pill(s, "강사잇다만의 차별점 ②③④", 9.9, 0.92, 2.83, 0.4, ORANGE, WHITE, 13);
    const node = (x, y, w, no, name, desc, stat, fill, dark) => {
      R(s, { x, y, w, h: 1.4, fill });
      T(s, `${no} ${name}`, { x: x + 0.22, y: y + 0.14, w: w - 1.4, h: 0.4, fontSize: 16, bold: true, color: dark ? WHITE : INK });
      pill(s, stat, x + w - 1.2, y + 0.16, 1.0, 0.34, dark ? WHITE : (fill === BG ? INK2 : NAVY), dark ? NAVY : WHITE, 11);
      T(s, desc, { x: x + 0.22, y: y + 0.62, w: w - 0.44, h: 0.65, fontSize: 13, color: dark ? "DDE3F0" : INK2 });
    };
    node(0.6, 1.75, 3.45, "①", "공고 모음", "부울경·경북 공고를 매일 자동 수집 (입구 · 무료)", "운영 중", BG, false);
    node(0.6, 3.6, 3.45, "②", "데뷔 교육", "입문 특강 → 프로필 실습 → 1:1 지원서 컨설팅", "1기 완료", TINT, false);
    node(4.85, 3.6, 3.0, "③", "인증 배지", "공공기관 강의 확인 · 경력 · 실적 시간(50h+, 100h+)", "2027.2", NAVY, true);
    node(9.28, 1.75, 3.45, "④", "기관 연결", "섭외 의뢰 접수, 기관이 프로필을 보고 직접 선택", "운영 중", TINT, false);
    node(9.28, 5.1, 3.45, "⑤", "첫 출강·실적", "강의료는 기관이 강사에게 직접 지급 (수수료 없음)", "3건 연결", OTINT, false);
    L(s, 2.32, 3.18, 2.32, 3.57, { color: HEX.muted, width: 2, arrow: true });
    L(s, 4.08, 4.3, 4.82, 4.3, { color: HEX.navy, width: 2.25, arrow: true });
    L(s, 7.9, 3.85, 9.25, 2.75, { color: HEX.navy, width: 2.25, arrow: true });
    L(s, 11.0, 3.18, 11.0, 5.07, { color: HEX.navy, width: 2.25, arrow: true });
    L(s, 9.25, 5.75, 7.0, 5.03, { color: HEX.orange, width: 2.5, arrow: true });
    T(s, "선순환", { x: 9.6, y: 3.85, w: 1.3, h: 0.45, fontSize: 18, bold: true, color: NAVY, align: "right" });
    T(s, "출강 실적이 다시\n인증 배지로 쌓임", { x: 5.0, y: 5.5, w: 3.2, h: 0.7, fontSize: 14, bold: true, color: ORANGE, align: "center" });
    T(s, "입구", { x: 0.6, y: 5.15, w: 3.45, h: 0.35, fontSize: 13, bold: true, color: MUTED });
    T(s, "무료 공고로 강사를 모으고, 첫 출강이 급한 강사를 교육으로 이끎", { x: 0.6, y: 5.5, w: 3.45, h: 0.8, fontSize: 12, color: INK2 });
    s.addNotes("무료 공고 모음이 입구입니다. 첫 출강이 급한 강사는 데뷔 교육으로 들어오고, 교육을 마치면 인증 배지, 기관 연결, 첫 출강으로 이어집니다. 출강 실적은 다시 인증 배지로 쌓여 다음 공고와 의뢰에 유리해지는 선순환이 됩니다. ②③④가 기존 서비스에 없는 부분입니다.");
  }

  // ===== 9. 공고 수집: 전/후 비교 =====
  {
    const s = content("Q2 실현 가능성 · 공고 자동 수집", "흩어진 공공 강사 공고를 매일 모아 한 화면에 보여 줍니다", S2);
    R(s, { x: 0.6, y: 1.75, w: 5.6, h: 4.75, fill: BG });
    T(s, "지금까지", { x: 0.9, y: 1.95, w: 3, h: 0.32, fontSize: 13, bold: true, color: MUTED });
    T(s, "사이트 5곳 이상을 매일 따로 확인", { x: 0.9, y: 2.27, w: 5.1, h: 0.45, fontSize: 18, bold: true, color: INK2 });
    const src = [["교육청", "부산·울산·경남·경북"], ["시·군·구청", "평생학습·주민센터"], ["시설공단", "문화·체육 강좌"], ["대학 평생교육원", "강좌 강사 모집"], ["학교", "방과후·늘봄 강사"]];
    const g = await icon("FaGlobe", HEX.muted);
    src.forEach(([a, b], i) => {
      const y = 2.9 + i * 0.68;
      R(s, { x: 0.9, y, w: 5.0, h: 0.56, fill: "FFFFFF", line: LINE, r: 0.08 });
      s.addImage({ data: g, x: 1.08, y: y + 0.15, w: 0.26, h: 0.26, objectName: oid("icon") });
      T(s, a, { x: 1.5, y, w: 2.0, h: 0.56, fontSize: 14, bold: true, color: INK2, valign: "middle" });
      T(s, b, { x: 3.5, y, w: 2.3, h: 0.56, fontSize: 12, color: MUTED, valign: "middle" });
    });
    s.addShape(pres.shapes.RIGHT_ARROW, { x: 6.35, y: 3.75, w: 0.75, h: 0.7, fill: { color: HEX.orange }, line: { type: "none" }, objectName: oid("arrow") });
    R(s, { x: 7.25, y: 1.75, w: 5.48, h: 4.75, fill: NAVY });
    T(s, "강사잇다", { x: 7.55, y: 1.95, w: 3, h: 0.32, fontSize: 13, bold: true, color: "F2A06B" });
    T(s, "한 화면에서 무료로", { x: 7.55, y: 2.27, w: 5, h: 0.45, fontSize: 18, bold: true, color: WHITE });
    T(s, "지원 가능 공고", { x: 7.55, y: 2.95, w: 3, h: 0.35, fontSize: 14, color: "DDE3F0" });
    T(s, [{ text: "281", options: { fontSize: 60, bold: true, color: WHITE } }, { text: " 건", options: { fontSize: 24, bold: true, color: WHITE } }], { x: 7.55, y: 3.25, w: 4.9, h: 1.0, valign: "middle" });
    T(s, "1R 당시 228건", { x: 7.55, y: 4.25, w: 3, h: 0.3, fontSize: 12, color: "DDE3F0" });
    ["매일 자동 수집 · 정규화 · 검증", "지역 · 마감일 필터", "특허 출원 10-2026-0223988"].forEach((t, i) => {
      const y = 4.75 + i * 0.5;
      Oval(s, { x: 7.58, y: y + 0.12, w: 0.18, h: 0.18, fill: ORANGE });
      T(s, t, { x: 7.92, y, w: 4.6, h: 0.42, fontSize: 14, bold: true, color: WHITE, valign: "middle" });
    });
    s.addNotes("지금까지 강사들은 교육청, 구청, 시설공단, 대학, 학교 사이트를 매일 따로 확인해야 했습니다. 강사잇다는 이 공고를 매일 자동으로 모으고 정규화해서 한 화면에 무료로 보여 줍니다. 지원 가능한 공고는 1R 당시 228건에서 지금 281건이고, 수집 방식은 특허 출원했습니다.");
  }

  // ===== 10. 1R 심사 의견 반영 =====
  {
    const s = content("Q2 실현 가능성 · 1R 심사 의견 반영", "1R 심사 의견 4가지를 모두 서비스에 반영했습니다", S2);
    const head = [["1R 심사 의견", 0.6, 3.6], ["바꾼 점", 4.6, 4.0], ["결과", 9.0, 3.73]];
    head.forEach(([t, x, w]) => T(s, t, { x, y: 1.65, w, h: 0.35, fontSize: 14, bold: true, color: MUTED }));
    const rows = [["실제 매칭 성과가 없음", "교육 참가자를 출강까지 연결", "실제 강의 연결 3건"], ["공고 모으기로는 차별화 어려움", "데뷔 교육 + 인증 배지 + 기관 의뢰", "경쟁 서비스와 다른 위치 확보"], ["1분 영상의 효과 불분명", "단계별 인증 배지로 변경", "기관 3곳이 ‘믿을 만한 추천’ 원함"], ["월 15,000원 지불 이유 불분명", "구독료 폐지, 가입 무료", "유료 교육 10명 결제"]];
    rows.forEach(([a, b, c], i) => {
      const y = 2.1 + i * 1.08;
      R(s, { x: 0.6, y, w: 3.6, h: 0.88, fill: BG });
      T(s, a, { x: 0.85, y, w: 3.2, h: 0.88, fontSize: 15, color: INK2, valign: "middle" });
      L(s, 4.23, y + 0.44, 4.57, y + 0.44, { color: HEX.muted, width: 1.5, arrow: true });
      R(s, { x: 4.6, y, w: 4.0, h: 0.88, fill: TINT });
      T(s, b, { x: 4.85, y, w: 3.6, h: 0.88, fontSize: 15, bold: true, color: NAVY, valign: "middle" });
      L(s, 8.63, y + 0.44, 8.97, y + 0.44, { color: HEX.muted, width: 1.5, arrow: true });
      R(s, { x: 9.0, y, w: 3.73, h: 0.88, fill: OTINT });
      T(s, c, { x: 9.25, y, w: 3.35, h: 0.88, fontSize: 15, bold: true, color: INK, valign: "middle" });
    });
    s.addNotes("1R에서 받은 네 가지 의견을 모두 반영했습니다. 매칭 성과가 없다는 지적에는 교육 참가자를 실제 출강까지 연결해 3건을 만들었고, 효과가 불분명했던 1분 영상은 단계별 인증 배지로 바꿨습니다. 월 구독료는 없애고 가입을 무료로 바꾼 뒤 유료 교육으로 10명이 결제했습니다.");
  }

  // ===== 11. 추진 경과: 스윔레인 =====
  {
    const s = content("Q2 실현 가능성 · 추진 경과와 다음 일정", "신고·교육·특허를 마쳤고, 다음은 결제 연동과 인증 배지입니다", S2);
    const months = ["2026.8", "9월", "10월", "11월", "12월", "2027.1", "2월", "3월"];
    const gx = 2.55, cw = (12.73 - gx) / 8, X = (m) => gx + m * cw;
    const today = X(3.87);
    Rect(s, { x: today, y: 1.75, w: 12.73 - today, h: 4.6, fill: "FFF6F0" });
    months.forEach((m, i) => T(s, m, { x: X(i), y: 1.8, w: cw, h: 0.32, fontSize: 12, bold: true, color: i >= 4 ? ORANGE : INK2, align: "center" }));
    const lanes = ["사업·제도", "서비스·기술", "교육·고객"];
    lanes.forEach((t, i) => {
      const y = 2.25 + i * 1.35;
      L(s, 0.6, y, 12.73, y, { color: HEX.line, width: 0.75 });
      T(s, t, { x: 0.6, y, w: 1.8, h: 1.35, fontSize: 15, bold: true, color: NAVY, valign: "middle" });
      L(s, gx, y + 0.675, 12.73, y + 0.675, { color: HEX.line, width: 1.25 });
    });
    L(s, 0.6, 6.3, 12.73, 6.3, { color: HEX.line, width: 0.75 });
    const ev = [[0, 0.5, "직업정보제공사업 신고", 1, 1], [0, 2.9, "1R 통과", 0, 1], [0, 3.33, "특허 출원 (11.10)", 1, 1, 1], [1, 3.6, "기관 직접 선택 · 서버 이전", 1, 1, 1], [1, 4.5, "결제 연동", 0, 0], [2, 2.84, "데뷔 교육 1기 (10.26)", 1, 1], [2, 3.87, "회원 500+명", 0, 1, 1], [2, 5.5, "데뷔 교육 2기", 1, 0]];
    ev.forEach(([lane, m, t, up, done, left]) => {
      const cy = 2.25 + lane * 1.35 + 0.675, x = X(m);
      Oval(s, { x: x - 0.11, y: cy - 0.11, w: 0.22, h: 0.22, fill: done ? NAVY : ORANGE });
      T(s, t, { x: left ? today - 2.45 : x - 1.15, y: up ? cy - 0.55 : cy + 0.16, w: 2.3, h: 0.38, fontSize: 12, bold: true, color: done ? INK : ORANGE, align: left ? "right" : "center", valign: up ? "bottom" : "top" });
    });
    [[1, "인증 배지 부여 시작", 1], [2, "기관 파일럿 (인터뷰 기관 3곳)", 0]].forEach(([lane, t, up]) => {
      const cy = 2.25 + lane * 1.35 + 0.675;
      R(s, { x: X(6.05), y: cy - 0.17, w: X(8) - X(6.05) - 0.05, h: 0.34, fill: ORANGE, r: 0.17 });
      T(s, t, { x: X(5.6), y: up ? cy - 0.58 : cy + 0.2, w: X(8) - X(5.6), h: 0.36, fontSize: 12, bold: true, color: ORANGE, align: "center", valign: up ? "bottom" : "top" });
    });
    L(s, today, 1.75, today, 6.3, { color: HEX.orange, width: 1.5, dash: "dash" });
    pill(s, "오늘 11.27", today - 0.6, 6.35, 1.2, 0.3, ORANGE, WHITE, 11);
    source(s, "");
    s.addNotes("일을 세 갈래로 나눠 보면, 사업·제도 쪽은 8월 직업정보제공사업 신고, 10월 1R 통과, 11월 특허 출원을 마쳤습니다. 서비스 쪽은 기관 직접 선택 기능과 국내 서버 이전을 끝냈고, 12월 결제 연동이 다음입니다. 교육 쪽은 10월 데뷔 교육 1기, 지금 회원 500명 이상이고, 내년 1월 2기, 2~3월 인증 배지와 기관 파일럿을 진행합니다.");
  }

  // ===== 12. 성과: 트리 =====
  {
    const s = content("Q2 실현 가능성 · 검증 결과", "사업·서비스·커뮤니티 세 방향에서 성과가 쌓이고 있습니다", S2);
    const groups = [["사업 성과", [["실제 강의 연결 3건", "출강 2건 · 면접 합격 1건"], ["유료 데뷔 교육 1기", "10명 결제"], ["기관 섭외 의뢰 접수", "사이트로 직접 의뢰"], ["회원 500+명", "1R 당시 0명"]]], ["서비스·기술", [["특허 출원", "10-2026-0223988 (2026.11.10)"], ["직업정보제공사업 신고", "J1302020260003"], ["국내 서버 이전", "공고 자동 수집 안정화"], ["기관 강사 직접 선택", "1R 이후 기능 추가"]]], ["커뮤니티", [["스레드 누적 조회 19.1만", "1R 당시 5.1만"], ["스레드 팔로워 600명", "1R 당시 296명"], ["당근모임 260명", "1R 당시 193명"], ["강사 모임 1,000명", "대표가 직접 운영"]]]];
    const rh = 0.37, gap = 0.04, top = 1.72, ggap = 0.2;
    R(s, { x: 0.6, y: 3.45, w: 2.3, h: 1.3, fill: NAVY });
    T(s, "1R 이후 한 달", { x: 0.6, y: 3.6, w: 2.3, h: 0.5, fontSize: 17, bold: true, color: WHITE, align: "center" });
    T(s, "2026.11.27 기준", { x: 0.6, y: 4.1, w: 2.3, h: 0.35, fontSize: 12, color: "DDE3F0", align: "center" });
    const gc = [];
    groups.forEach(([g, items], gi) => {
      const gy = top + gi * (4 * (rh + gap) + ggap), cy = gy + (4 * (rh + gap) - gap) / 2;
      gc.push(cy);
      R(s, { x: 3.55, y: cy - 0.4, w: 2.2, h: 0.8, fill: TINT });
      T(s, g, { x: 3.55, y: cy - 0.4, w: 2.2, h: 0.8, fontSize: 16, bold: true, color: NAVY, align: "center", valign: "middle" });
      const ys = items.map((_, k) => gy + k * (rh + gap) + rh / 2);
      L(s, 6.1, ys[0], 6.1, ys[3], { color: HEX.soft, width: 1.25 });
      L(s, 5.75, cy, 6.1, cy, { color: HEX.soft, width: 1.25 });
      items.forEach(([a, b], k) => {
        const y = gy + k * (rh + gap);
        L(s, 6.1, y + rh / 2, 6.4, y + rh / 2, { color: HEX.soft, width: 1.25 });
        R(s, { x: 6.4, y, w: 6.33, h: rh, fill: k === 0 ? OTINT : BG, r: 0.08 });
        T(s, [{ text: a, options: { bold: true, color: INK } }, { text: "   " + b, options: { color: INK2, fontSize: 12 } }], { x: 6.6, y, w: 6.0, h: rh, fontSize: 14, valign: "middle" });
      });
    });
    L(s, 3.2, gc[0], 3.2, gc[2], { color: HEX.soft, width: 1.25 });
    L(s, 2.9, 4.1, 3.2, 4.1, { color: HEX.soft, width: 1.25 });
    gc.forEach((cy) => L(s, 3.2, cy, 3.55, cy, { color: HEX.soft, width: 1.25 }));
    s.addNotes("1R 이후 한 달의 성과를 세 갈래로 정리했습니다. 사업 쪽은 실제 강의 연결 3건과 유료 교육 10명, 서비스 쪽은 특허 출원과 사업 신고, 서버 이전, 커뮤니티 쪽은 스레드 누적 조회 19.1만과 팔로워 600명입니다.");
  }

  // ===== 13. 연결 사례 + 성장 그래프 =====
  {
    const s = content("Q2 실현 가능성 · 실제 연결 사례와 지표", "1R 이후 한 달: 회원 0 → 500+명, 스레드 조회 3.7배", S2);
    const cases = [["첫 출강", "학원 원장 → 특성화고 영어 강사", "FaChalkboardUser"], ["1:1 지원서 컨설팅", "수료생 강사 면접 합격", "FaFileSignature"], ["기관 섭외 의뢰 접수", "학교·기관이 사이트에 직접 의뢰", "FaSchool"]];
    for (let i = 0; i < 3; i++) {
      const y = 1.75 + i * 1.12;
      R(s, { x: 0.6, y, w: 5.2, h: 0.95, fill: BG });
      await iconCircle(s, cases[i][2], 0.82, y + 0.17, 0.6, TINT, HEX.navy);
      T(s, cases[i][0], { x: 1.62, y: y + 0.12, w: 4, h: 0.38, fontSize: 16, bold: true });
      T(s, cases[i][1], { x: 1.62, y: y + 0.5, w: 4, h: 0.32, fontSize: 13, color: INK2 });
    }
    R(s, { x: 0.6, y: 5.2, w: 5.2, h: 1.25, fill: NAVY });
    T(s, "1기 수료생 10명 중 2명 출강·면접 합격", { x: 0.85, y: 5.33, w: 4.8, h: 0.45, fontSize: 16, bold: true, color: WHITE });
    T(s, "60세 이상 강사 연결 1건 포함", { x: 0.85, y: 5.8, w: 4.8, h: 0.4, fontSize: 14, color: "DDE3F0" });
    T(s, "1R(2026.10 말) 대비 현재(2026.11.27)", { x: 6.2, y: 1.7, w: 6.5, h: 0.35, fontSize: 15, bold: true, color: INK2 });
    s.addChart(pres.charts.BAR, [
      { name: "1R 당시", labels: ["회원", "스레드 팔로워", "지원 가능 공고", "당근모임"], values: [0, 296, 228, 193] },
      { name: "현재", labels: ["회원", "스레드 팔로워", "지원 가능 공고", "당근모임"], values: [500, 600, 281, 260] },
    ], {
      x: 6.1, y: 2.05, w: 6.65, h: 3.3, barDir: "bar", barGrouping: "clustered", barGapWidthPct: 60,
      chartColors: [HEX.soft, HEX.navy], showLegend: true, legendPos: "t", legendFontSize: 12, legendColor: HEX.ink2,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: HEX.ink2,
      catAxisLabelColor: HEX.ink2, catAxisLabelFontSize: 12, catAxisOrientation: "maxMin", valAxisHidden: true, valAxisMaxVal: 700,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, catAxisLineShow: false, objectName: oid("chart"), ...chartText,
    });
    R(s, { x: 6.2, y: 5.5, w: 6.53, h: 0.95, fill: OTINT });
    T(s, "스레드 누적 조회", { x: 6.45, y: 5.5, w: 2.2, h: 0.95, fontSize: 15, bold: true, valign: "middle" });
    T(s, [{ text: "5.1만  →  ", options: { fontSize: 20, bold: true, color: INK2 } }, { text: "19.1만", options: { fontSize: 28, bold: true, color: ORANGE } }], { x: 8.5, y: 5.5, w: 4.1, h: 0.95, valign: "middle" });
    s.addNotes("실제 사례입니다. 학원 원장님이 특성화고 영어 강사로 첫 출강을 했고, 1:1 지원서 컨설팅을 받은 수료생이 강사 면접에 합격했습니다. 1기 수료생 10명 중 2명이 결과를 냈고, 60세 이상 강사 연결도 1건 있습니다. 1R 이후 회원은 0명에서 500명 이상으로, 스레드 조회는 3.7배로 늘었습니다.");
  }

  // ===== 14. 차별성: 단계별 커버리지 =====
  {
    const s = content("Q2 실현 가능성 · 차별성", "데뷔 교육과 기관 연결을 함께 하는 서비스는 확인되지 않았습니다", S2);
    const stages = ["공고 탐색", "데뷔 준비", "신뢰 근거", "기관 연결"];
    const gx = 3.35, cw = (12.73 - gx) / 4, X = (i) => gx + i * cw;
    stages.forEach((t, i) => {
      Rect(s, { x: X(i), y: 1.75, w: cw - 0.06, h: 4.45, fill: i % 2 ? "FFFFFF" : BG });
      T(s, t, { x: X(i), y: 1.82, w: cw - 0.06, h: 0.4, fontSize: 15, bold: true, color: INK2, align: "center" });
    });
    const rows = [["공고 모음 서비스", "공공강사·티처라인", [[0, 1, "공고를 모아 보여 줌"]]], ["강사 양성 학원", "60만~298만 원", [[1, 2, "교육 판매"]]], ["늘봄허브 (공공)", "심사 연 2회", [[3, 4, "늘봄·방과후 한정"]]], ["섭외 대행", "더알림·커넥트밸류", [[3, 4, "섭외 대행"]]]];
    rows.forEach(([n, sub, bars], i) => {
      const y = 2.4 + i * 0.75;
      T(s, n, { x: 0.6, y, w: 2.65, h: 0.36, fontSize: 15, bold: true });
      T(s, sub, { x: 0.6, y: y + 0.34, w: 2.65, h: 0.28, fontSize: 11, color: INK2 });
      bars.forEach(([a, b, t]) => {
        R(s, { x: X(a) + 0.12, y: y + 0.08, w: X(b) - X(a) - 0.3, h: 0.5, fill: HEX.soft, r: 0.25 });
        T(s, t, { x: X(a) + 0.12, y: y + 0.08, w: X(b) - X(a) - 0.3, h: 0.5, fontSize: 12, bold: true, color: NAVY, align: "center", valign: "middle" });
      });
    });
    const y = 5.45;
    L(s, 0.6, y - 0.12, 12.73, y - 0.12, { color: HEX.line, width: 1 });
    T(s, "강사잇다", { x: 0.6, y: y + 0.05, w: 2.65, h: 0.5, fontSize: 18, bold: true, color: ORANGE, valign: "middle" });
    R(s, { x: X(0) + 0.12, y: y + 0.05, w: X(4) - X(0) - 0.3, h: 0.55, fill: ORANGE, r: 0.27 });
    R(s, { x: X(2) + 0.05, y: y + 0.1, w: cw - 0.16, h: 0.45, fill: "F2A06B", r: 0.22 });
    ["공고 무료", "데뷔 교육", "인증 배지 (2027.2)", "기관 의뢰·선택"].forEach((t, i) => T(s, t, { x: X(i) + 0.1, y: y + 0.05, w: cw - 0.2, h: 0.55, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle" }));
    source(s, "비교 대상: 각 서비스 홈페이지 직접 확인(2026.11.23), 양성 학원 가격은 기사·판매 페이지 기준");
    s.addNotes("신규 강사가 첫 출강까지 가는 길을 공고 탐색, 데뷔 준비, 신뢰 근거, 기관 연결의 네 단계로 나눴습니다. 공고 모음은 첫 단계만, 양성 학원은 교육만, 섭외 대행과 늘봄허브는 연결만 합니다. 네 단계를 모두 잇는 서비스는 확인되지 않았고, 강사잇다가 그 길 전체를 맡습니다. 인증 배지는 2027년 2월에 시작합니다.");
  }

  // ===== 15. 대표 역량: 경험 → 쓰임 연결 =====
  {
    const s = content("Q2 실현 가능성 · 대표 역량", "현장을 아는 강사가 직접 만들고 운영합니다", S2);
    T(s, "대표의 경험", { x: 0.6, y: 1.7, w: 4.6, h: 0.35, fontSize: 14, bold: true, color: MUTED });
    T(s, "강사잇다에서 쓰이는 곳", { x: 7.55, y: 1.7, w: 5, h: 0.35, fontSize: 14, bold: true, color: MUTED });
    const m = [["7년", "프리랜서 강사 경력", "기관이 원하는 강사상을 앎", "FaChalkboardUser"], ["1,000명", "강사 모임 직접 운영", "초기 강사 확보 채널", "FaUsers"], ["학교", "취업·진로 캠프 사업자", "한국엑스퍼트교육원 학교 네트워크", "FaSchool"], ["1인 개발", "기획·개발·운영 직접", "특허 출원 · 서버 이전 직접 처리", "FaLaptopCode"]];
    for (let i = 0; i < 4; i++) {
      const y = 2.15 + i * 0.95, h = 0.8, cy = y + h / 2;
      R(s, { x: 0.6, y, w: 4.6, h, fill: BG });
      T(s, m[i][0], { x: 0.85, y, w: 1.65, h, fontSize: 22, bold: true, color: NAVY, valign: "middle" });
      T(s, m[i][1], { x: 2.5, y, w: 2.6, h, fontSize: 15, bold: true, valign: "middle" });
      L(s, 5.22, cy, 5.95, cy, { color: HEX.soft, width: 1.5 });
      await iconCircle(s, m[i][3], 5.97, cy - 0.33, 0.66, NAVY, "FFFFFF");
      L(s, 6.65, cy, 7.5, cy, { color: HEX.soft, width: 1.5, arrow: true });
      R(s, { x: 7.55, y, w: 5.18, h, fill: "FFFFFF", line: LINE });
      T(s, m[i][2], { x: 7.8, y, w: 4.8, h, fontSize: 15, bold: true, color: INK, valign: "middle" });
    }
    R(s, { x: 0.6, y: 6.0, w: 12.13, h: 0.6, fill: TINT });
    T(s, "MVP는 대표가 직접 개발해 운영 중이고, 고도화는 외주·개발자와 협업합니다", { x: 0.9, y: 6.0, w: 11.6, h: 0.6, fontSize: 15, bold: true, color: NAVY, valign: "middle" });
    s.addNotes("제 경험이 사업 어디에 쓰이는지 정리했습니다. 7년 강사 경력으로 기관이 원하는 강사상을 알고, 1,000명 강사 모임은 초기 강사 확보 채널입니다. 캠프 사업으로 쌓은 학교 네트워크가 있고, 서비스는 제가 직접 개발해 특허 출원과 서버 이전까지 처리했습니다.");
  }

  // ===== 16. 비즈니스 모델: 무료 영역 + 수익원 타임라인 =====
  pres.addSection({ title: "Q3 사업화 전략" });
  const S3 = "Q3 사업화 전략";
  {
    const s = content("Q3 사업화 전략 · 수익 구조", "가입은 무료, 강사가 한 단계 올라서는 시점에 수익이 생깁니다", S3);
    R(s, { x: 0.6, y: 1.75, w: 3.85, h: 4.8, fill: BG });
    T(s, "무료로 제공", { x: 0.9, y: 1.95, w: 3.3, h: 0.4, fontSize: 18, bold: true, color: NAVY });
    const fr = [["FaMagnifyingGlass", "가입 · 공고 열람", "강사 누구나"], ["FaSchool", "섭외 의뢰 · 강사 선택", "학교·기관"], ["FaHandHoldingDollar", "강의료 수수료 0원", "기관 → 강사 직접 지급"]];
    for (let i = 0; i < 3; i++) {
      const y = 2.6 + i * 1.25;
      await iconCircle(s, fr[i][0], 0.9, y, 0.65, "FFFFFF", HEX.navy);
      T(s, fr[i][1], { x: 1.7, y: y - 0.02, w: 2.6, h: 0.38, fontSize: 15, bold: true });
      T(s, fr[i][2], { x: 1.7, y: y + 0.36, w: 2.6, h: 0.3, fontSize: 12, color: INK2 });
    }
    // 수익원 타임라인 (2026.7 기준 월 단위)
    const x0 = 4.85, x1 = 12.73, M = (m) => x0 + (m / 30) * (x1 - x0);
    T(s, "수익원이 열리는 시점", { x: x0, y: 1.75, w: 5, h: 0.4, fontSize: 18, bold: true, color: ORANGE });
    [["2026", 0, 6], ["2027", 6, 18], ["2028", 18, 30]].forEach(([y, a, b], i) => {
      Rect(s, { x: M(a), y: 2.3, w: M(b) - M(a) - 0.03, h: 0.38, fill: i === 0 ? INK2 : i === 1 ? MID : NAVY });
      T(s, y, { x: M(a), y: 2.3, w: M(b) - M(a), h: 0.38, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle" });
      L(s, M(a), 2.7, M(a), 6.15, { color: HEX.line, width: 0.75, dash: "dash" });
    });
    const bars = [[3, "① 데뷔 교육 1인 30만 원", "2026.10~ · 기수제, 출강 2회 보장", HEX.orange], [14, "② 노출·광고비 월 3만 원", "2027.9~ · 프로필 노출", "F08A45"], [18, "③ 섭외 대행 건당 10만 원", "2028~ · 조건 맞춤 선별·추천", "F5B48A"]];
    bars.forEach(([m, t, d, col], i) => {
      const y = 2.95 + i * 1.08, x = M(m);
      s.addShape(pres.shapes.PENTAGON, { x, y, w: x1 - x, h: 0.9, fill: { color: col }, line: { type: "none" }, objectName: oid("bar") });
      T(s, t, { x: x + 0.2, y: y + 0.08, w: x1 - x - 0.5, h: 0.4, fontSize: 15, bold: true, color: i === 2 ? INK : WHITE });
      T(s, d, { x: x + 0.2, y: y + 0.48, w: x1 - x - 0.5, h: 0.32, fontSize: 12, color: i === 2 ? INK : WHITE });
    });
    R(s, { x: x0, y: 6.2, w: x1 - x0, h: 0.38, fill: TINT, r: 0.08 });
    T(s, "강사잇다는 성사 수수료를 받지 않음 · 광고비는 노출 비용 (고용센터 확인 후 진행)", { x: x0 + 0.2, y: 6.2, w: x1 - x0 - 0.3, h: 0.38, fontSize: 12, bold: true, color: NAVY, valign: "middle" });
    s.addNotes("가입, 공고 열람, 기관의 섭외 의뢰는 무료이고, 강의료는 기관이 강사에게 직접 지급해 저희는 수수료를 받지 않습니다. 수익원은 단계적으로 열립니다. 지금은 데뷔 교육 1인 30만 원, 2027년 9월부터 노출·광고비 월 3만 원, 2028년부터 섭외 대행 건당 10만 원입니다.");
  }

  // ===== 17. 가격 근거 + 진입 경로 =====
  {
    const s = content("Q3 사업화 전략 · 가격 근거와 시장 진입", "강의 자리 하나면 교육비 30만 원의 2.5배 이상을 돌려받습니다", S3);
    T(s, "데뷔 교육비와 한 학기 강의료 비교 (만 원)", { x: 0.6, y: 1.7, w: 5.6, h: 0.35, fontSize: 15, bold: true, color: INK2 });
    s.addChart(pres.charts.BAR, [{ name: "금액", labels: ["데뷔 교육비", "강의료(최소)", "강의료(최대)"], values: [30, 75, 105] }], {
      x: 0.5, y: 2.05, w: 5.8, h: 3.4, barDir: "col", barGapWidthPct: 55, chartColors: [HEX.orange, HEX.soft, HEX.navy],
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 14, dataLabelColor: HEX.ink, dataLabelFontBold: true,
      catAxisLabelColor: HEX.ink2, catAxisLabelFontSize: 12, valAxisHidden: true, valAxisMaxVal: 120, valAxisMinVal: 0,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, objectName: oid("chart"), ...chartText,
    });
    R(s, { x: 0.6, y: 5.6, w: 5.6, h: 0.9, fill: BG });
    T(s, [{ text: "한 학기 강의 = 주 1회 × 15주", options: { bold: true, breakLine: true } }, { text: "수료 후 12개월 안에 출강 미연결 시 다음 기수 무료", options: { fontSize: 12, color: INK2 } }], { x: 0.85, y: 5.6, w: 5.2, h: 0.9, fontSize: 14, valign: "middle" });
    T(s, "지역 진입 순서", { x: 6.85, y: 1.7, w: 4, h: 0.35, fontSize: 15, bold: true, color: INK2 });
    pill(s, "신학기 1~3월 집중", 10.9, 1.68, 1.83, 0.38, OTINT, ORANGE, 12);
    const rg = ["경남", "부산", "울산", "경북·대구", "전국"];
    L(s, 7.3, 2.75, 12.3, 2.75, { color: HEX.soft, width: 3 });
    rg.forEach((t, i) => {
      const cx = 7.3 + i * 1.25, d = i === 0 ? 0.6 : 0.46;
      Oval(s, { x: cx - d / 2, y: 2.75 - d / 2, w: d, h: d, fill: i === 0 ? ORANGE : i === 4 ? WHITE : NAVY, line: i === 4 ? HEX.navy : undefined, lw: 2 });
      T(s, String(i + 1), { x: cx - d / 2, y: 2.75 - d / 2, w: d, h: d, fontSize: 13, bold: true, color: i === 4 ? NAVY : WHITE, align: "center", valign: "middle" });
      T(s, t, { x: cx - 0.7, y: 3.12, w: 1.4, h: 0.35, fontSize: 13, bold: true, color: i === 0 ? ORANGE : INK, align: "center" });
    });
    const ch = [["강사 채널", "FaUsers", "강사 모임 1,000명 · 당근모임 260명 · 스레드에 무료 공고 → 첫 출강이 급한 강사를 데뷔 교육으로"], ["기관 채널", "FaSchool", "인터뷰 기관 3곳 + 캠프 사업의 학교 네트워크를 파일럿 기관으로"]];
    for (let i = 0; i < 2; i++) {
      const y = 3.75 + i * 1.4;
      R(s, { x: 6.85, y, w: 5.88, h: 1.25, fill: "FFFFFF", line: LINE });
      await iconCircle(s, ch[i][1], 7.08, y + 0.28, 0.68, TINT, HEX.navy);
      T(s, ch[i][0], { x: 8.0, y: y + 0.12, w: 4.5, h: 0.36, fontSize: 16, bold: true, color: NAVY });
      T(s, ch[i][2], { x: 8.0, y: y + 0.48, w: 4.55, h: 0.7, fontSize: 13 });
    }
    s.addNotes("가격 근거입니다. 한 학기 강의 자리, 즉 주 1회 15주면 강의료가 75만~105만 원입니다. 첫 자리 하나로 교육비 30만 원의 2.5배 이상을 돌려받는 구조이고, 수료 후 12개월 안에 연결되지 않으면 다음 기수를 무료로 들을 수 있습니다. 지역은 경남에서 시작해 부산, 울산, 경북·대구, 전국 순으로 넓히고, 신학기인 1~3월에 집중합니다.");
  }

  // ===== 18. 로드맵: 간트 =====
  {
    const s = content("Q3 사업화 전략 · 단계별 추진 일정 (추정)", "2027년 검증·수익화, 2028년 영남권으로 넓힙니다", S3);
    const per = [["검증", "2026.12~2027.2"], ["수익화", "2027.3~6"], ["확장", "2027.7~12"], ["영남권", "2028~"]];
    const gx = 2.65, cw = (12.73 - gx) / 4, X = (i) => gx + i * cw;
    per.forEach(([t, d], i) => {
      R(s, { x: X(i) + 0.03, y: 1.72, w: cw - 0.06, h: 0.6, fill: i === 3 ? NAVY : TINT, r: 0.08 });
      T(s, [{ text: `${i + 1}. ${t}  `, options: { bold: true, fontSize: 15 } }, { text: d, options: { fontSize: 12 } }], { x: X(i) + 0.03, y: 1.72, w: cw - 0.06, h: 0.6, color: i === 3 ? WHITE : NAVY, align: "center", valign: "middle" });
    });
    const lanes = [["제품", [[0, 1, "배지 기준 확정 · 결제 연동"], [1, 2, "인증 배지 1차 부여"]]], ["교육", [[0, 1, "데뷔 교육 2기"], [1, 2, "신학기 공고 대응"]]], ["기관·지역", [[1, 2, "공공기관 의뢰 연결"], [2, 3, "부산·울산 기관 협력"], [3, 4, "경북·대구 확대"]]], ["수익", [[2, 3, "노출·광고비 도입"], [3, 4, "섭외 대행 시작"]]]];
    lanes.forEach(([n, bars], i) => {
      const y = 2.48 + i * 0.7;
      L(s, 0.6, y + 0.66, 12.73, y + 0.66, { color: HEX.line, width: 0.5 });
      T(s, n, { x: 0.6, y, w: 1.9, h: 0.6, fontSize: 15, bold: true, color: INK2, valign: "middle" });
      bars.forEach(([a, b, t]) => {
        R(s, { x: X(a) + 0.08, y: y + 0.1, w: X(b) - X(a) - 0.16, h: 0.44, fill: n === "수익" ? OTINT : BG, line: n === "수익" ? HEX.orange : HEX.soft, r: 0.22 });
        T(s, t, { x: X(a) + 0.08, y: y + 0.1, w: X(b) - X(a) - 0.16, h: 0.44, fontSize: 13, bold: true, color: n === "수익" ? ORANGE : NAVY, align: "center", valign: "middle" });
      });
    });
    const goals = [["회원 700명", "교육 수강 20명", "기관 의뢰 5건"], ["출강 연결 10건", "교육 매출 1,200만 원", "재수강·재의뢰 30%"], ["유료 강사 30명", "협력 기관 10곳"], ["회원 2,000명", "협력 기관 30곳", "연간 연결 100건"]];
    T(s, "측정 목표", { x: 0.6, y: 5.42, w: 1.9, h: 1.15, fontSize: 15, bold: true, color: ORANGE, valign: "middle" });
    goals.forEach((g, i) => {
      R(s, { x: X(i) + 0.03, y: 5.42, w: cw - 0.06, h: 1.15, fill: i === 3 ? NAVY : OTINT });
      T(s, g.map((t, k) => ({ text: t, options: { breakLine: k < g.length - 1 } })), { x: X(i) + 0.25, y: 5.42, w: cw - 0.45, h: 1.15, fontSize: 14, bold: true, color: i === 3 ? WHITE : INK, valign: "middle", paraSpaceAfter: 2 });
    });
    s.addNotes("일정을 제품, 교육, 기관·지역, 수익의 네 줄로 나눴습니다. 내년 2월까지 배지 기준과 결제 연동, 교육 2기를 마치고 회원 700명을 목표로 합니다. 상반기에는 공공기관 의뢰 연결로 출강 10건과 교육 매출 1,200만 원, 하반기에는 노출·광고비를 도입하고 협력 기관 10곳을 만듭니다. 2028년에는 섭외 대행을 시작해 회원 2,000명, 협력 기관 30곳, 연간 연결 100건을 목표로 합니다.");
  }

  // ===== 19. 자금 소요: 트리맵 =====
  {
    const s = content("Q3 사업화 전략 · 자금 소요 (추정)", "MVP 제작비 2,000만 원 중 61%를 기능 개발과 지식재산에 씁니다", S3);
    const X0 = 0.6, Y0 = 1.75, W = 7.0, H = 4.8;
    const box = (x, y, w, h, fill, name, v, fg, size = 15) => {
      s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: "FFFFFF", width: 3 }, objectName: oid("tree") });
      T(s, [{ text: name, options: { fontSize: size, bold: true, breakLine: true } }, { text: `${v.toLocaleString()}만 원`, options: { fontSize: size + 5, bold: true, breakLine: true } }, { text: `${Math.round(v / 20)}%`, options: { fontSize: size - 2 } }], { x: x + 0.18, y: y + 0.15, w: w - 0.3, h: h - 0.3, color: fg });
    };
    const wl = W * 0.4;
    box(X0, Y0, wl, H, HEX.navy, "기능 개발", 800, WHITE, 18);
    const rx = X0 + wl, rw = W - wl, th = H * (420 / 1200);
    box(rx, Y0, rw, th, HEX.orange, "법률·지식재산", 420, WHITE, 16);
    const by = Y0 + th, bh = H - th;
    const sh = bh * (180 / 780), ch = bh - sh;
    box(rx, by, rw / 2, ch, "5B6FA8", "교육 운영", 300, WHITE, 14);
    box(rx + rw / 2, by, rw / 2, ch, "8FA0CC", "마케팅", 300, WHITE, 14);
    s.addShape(pres.shapes.RECTANGLE, { x: rx, y: by + ch, w: rw, h: sh, fill: { color: "C3CCE3" }, line: { color: "FFFFFF", width: 3 }, objectName: oid("tree") });
    T(s, [{ text: "서버·운영  ", options: { bold: true, fontSize: 13 } }, { text: "180만 원", options: { bold: true, fontSize: 16 } }, { text: "  9%", options: { fontSize: 12 } }], { x: rx + 0.18, y: by + ch, w: rw - 0.3, h: sh, color: INK, valign: "middle" });
    const items = [["기능 개발", "인증 배지, 결제, 기관 선택·추천 기능 고도화", "외주 견적 기준"], ["법률·지식재산", "광고비 구조 자문, 특허 심사청구", "심사청구 약 220만 원 + 자문 200만 원"], ["교육 운영", "데뷔 교육 교안·자료, 보조 강사비", "기수당 100만 원 × 3기"], ["마케팅", "스레드·당근 광고, 기관 홍보물", "월 25만 원 × 12개월"], ["서버·운영", "네이버 클라우드, 도메인, 알림 발송", "월 15만 원 × 12개월"]];
    T(s, "산출 근거", { x: 7.95, y: 1.75, w: 3, h: 0.3, fontSize: 12, bold: true, color: MUTED });
    items.forEach(([n, u, b], i) => {
      const y = 2.05 + i * 0.8;
      T(s, n, { x: 7.95, y, w: 4.78, h: 0.32, fontSize: 14, bold: true });
      T(s, `${u} · ${b}`, { x: 7.95, y: y + 0.32, w: 4.78, h: 0.42, fontSize: 11, color: INK2 });
    });
    R(s, { x: 7.95, y: 6.05, w: 4.78, h: 0.5, fill: TINT, r: 0.08 });
    T(s, "조달: 자기자금 300만 원 + 교육 매출 재투자", { x: 8.1, y: 6.05, w: 4.55, h: 0.5, fontSize: 12, bold: true, color: NAVY, valign: "middle" });
    s.addNotes("상자 크기가 금액 비율입니다. MVP 제작비 2,000만 원 중 기능 개발이 800만 원으로 가장 크고, 특허 심사청구와 광고비 구조 자문 등 법률·지식재산이 420만 원입니다. 둘을 합치면 61%입니다. 교육 운영과 마케팅에 각 300만 원, 서버·운영에 180만 원을 씁니다. 여기에 자기자금 300만 원과 교육 매출을 재투자합니다.");
  }

  // ===== 20. 매출 추정 =====
  {
    const s = content("Q3 사업화 전략 · 매출 추정 (추정)", "2027년 매출 약 2,160만 원, 2028년부터 운영비 자체 충당", S3);
    T(s, "2027년 매출 구성 (만 원)", { x: 0.6, y: 1.7, w: 6, h: 0.35, fontSize: 15, bold: true, color: INK2 });
    s.addChart(pres.charts.BAR, [
      { name: "온보딩 프로젝트", labels: ["2027년"], values: [1800] },
      { name: "노출·광고비", labels: ["2027년"], values: [360] },
    ], {
      x: 0.5, y: 2.05, w: 12.3, h: 1.55, barDir: "bar", barGrouping: "stacked", barGapWidthPct: 30, chartColors: [HEX.navy, HEX.orange],
      showValue: false,
      catAxisHidden: true, valAxisHidden: true, valAxisMaxVal: 2160, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: true, legendPos: "b", legendFontSize: 12, legendColor: HEX.ink2, objectName: oid("chart"), ...chartText,
    });
    const cards = [["온보딩 프로젝트", "60명 × 30만 원", "연 3기 × 20명", "1,800만 원", NAVY], ["노출·광고비", "30명 × 월 3만 원 × 4개월", "2027.9~12", "360만 원", ORANGE], ["합계", "2027년 매출 추정", "", "2,160만 원", INK]];
    cards.forEach(([t, f, d, v, col], i) => {
      const x = 0.6 + i * 4.11, w = 3.91;
      R(s, { x, y: 3.9, w, h: 1.85, fill: i === 2 ? TINT : BG });
      T(s, t, { x: x + 0.3, y: 4.05, w: w - 0.6, h: 0.35, fontSize: 15, bold: true, color: col });
      T(s, v, { x: x + 0.3, y: 4.4, w: w - 0.6, h: 0.65, fontSize: 28, bold: true, color: col === INK ? NAVY : col, valign: "middle" });
      T(s, f + (d ? `\n(${d})` : ""), { x: x + 0.3, y: 5.05, w: w - 0.6, h: 0.6, fontSize: 12, color: INK2 });
    });
    R(s, { x: 0.6, y: 5.95, w: 12.13, h: 0.6, fill: NAVY, r: 0.1 });
    T(s, "2028년부터 교육 매출과 노출·광고비로 운영비를 자체 충당", { x: 0.9, y: 5.95, w: 11.6, h: 0.6, fontSize: 16, bold: true, color: WHITE, valign: "middle" });
    s.addNotes("2027년 매출은 온보딩 프로젝트 60명 곱하기 30만 원으로 1,800만 원, 9월부터 시작하는 노출·광고비 360만 원을 더해 약 2,160만 원으로 추정합니다. 2028년부터는 교육 매출과 광고비로 운영비를 자체 충당합니다.");
  }

  // ===== 21. 중장기 목표 =====
  pres.addSection({ title: "Q4 성장 전략" });
  const S4 = "Q4 성장 전략";
  {
    const s = content("Q4 성장 전략 · 중장기 목표", "영남권 기관이 강사를 찾을 때 가장 먼저 여는 곳이 되겠습니다", S4);
    T(s, "회원 수 (명) · 2027.2 이후는 목표치(추정)", { x: 0.6, y: 1.7, w: 7, h: 0.35, fontSize: 15, bold: true, color: INK2 });
    s.addChart(pres.charts.BAR, [{ name: "회원", labels: ["1R (2026.10)", "현재 (2026.11)", "2027.2 목표", "2028 목표"], values: [0, 500, 700, 2000] }], {
      x: 0.5, y: 2.05, w: 7.1, h: 4.45, barDir: "col", barGapWidthPct: 50, chartColors: [HEX.navy, HEX.navy, HEX.orange, HEX.orange],
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 14, dataLabelFontBold: true, dataLabelColor: HEX.ink, dataLabelFormatCode: "#,##0",
      catAxisLabelColor: HEX.ink2, catAxisLabelFontSize: 12, valAxisHidden: true, valAxisMaxVal: 2300, valAxisMinVal: 0, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, objectName: oid("chart"), ...chartText,
    });
    T(s, "2028년 목표", { x: 8.0, y: 1.7, w: 4.7, h: 0.35, fontSize: 15, bold: true, color: INK2 });
    const k = [["회원", "2,000", "명", "FaUsers"], ["협력 기관", "30", "곳", "FaSchool"], ["연간 연결", "100", "건", "FaHandshake"]];
    for (let i = 0; i < 3; i++) {
      const y = 2.15 + i * 1.12;
      R(s, { x: 8.0, y, w: 4.73, h: 0.95, fill: i === 0 ? NAVY : BG });
      await iconCircle(s, k[i][3], 8.22, y + 0.18, 0.6, i === 0 ? "2A4489" : TINT, i === 0 ? "FFFFFF" : HEX.navy);
      T(s, k[i][0], { x: 9.0, y, w: 1.6, h: 0.95, fontSize: 15, bold: true, color: i === 0 ? WHITE : INK2, valign: "middle" });
      T(s, [{ text: k[i][1], options: { fontSize: 30, bold: true } }, { text: " " + k[i][2], options: { fontSize: 15, bold: true } }], { x: 10.4, y, w: 2.15, h: 0.95, color: i === 0 ? WHITE : NAVY, align: "right", valign: "middle" });
    }
    R(s, { x: 8.0, y: 5.6, w: 4.73, h: 0.9, fill: OTINT });
    T(s, "강사에게는 첫 출강부터 경력·정산·홍보까지 함께하는 곳, 기관에는 인증된 실적으로 강사를 찾는 창구", { x: 8.2, y: 5.6, w: 4.35, h: 0.9, fontSize: 12, color: INK, valign: "middle" });
    s.addNotes("중장기 목표는 영남권 기관이 강사를 찾을 때 가장 먼저 여는 곳이 되는 것입니다. 회원은 현재 500명에서 내년 2월 700명, 2028년 2,000명을 목표로 하고, 협력 기관 30곳과 연간 연결 100건을 만들겠습니다.");
  }

  // ===== 22. 성장 단계별 서비스: 계단 =====
  {
    const s = content("Q4 성장 전략 · 서비스 고도화", "강사 성장 단계마다 필요한 서비스를 붙여 나갑니다", S4);
    const stg = [["입문", "경력을 강의로"], ["첫 출강", "실적 만들기"], ["활동 강사", "꾸준한 일감·정산"], ["브랜드 강사", "나를 알리기"]];
    const cards = [[["데뷔 교육", "운영 중"], ["교육 과정 확대", "확장"]], [["인증 배지", "2027.2"], ["강의 경력 증명", "고도화"]], [["맞춤 추천", "고도화"], ["서류 지갑", "고도화"], ["출강잇다", "잇다 시리즈"]], [["월간 강사", "잇다 시리즈"]]];
    const shades = ["8FA0CC", "5B6FA8", "2A4489", "163072"];
    const w = 2.98, g = 0.07, bottom = 6.6;
    stg.forEach(([t, d], i) => {
      const x = 0.6 + i * (w + g), top = 4.05 - i * 0.75, h = bottom - top;
      s.addShape(pres.shapes.RECTANGLE, { x, y: top, w, h, fill: { color: shades[i] }, line: { type: "none" }, objectName: oid("step") });
      T(s, t, { x: x + 0.2, y: top + 0.12, w: w - 0.4, h: 0.42, fontSize: 18, bold: true, color: WHITE });
      T(s, d, { x: x + 0.2, y: top + 0.52, w: w - 0.4, h: 0.3, fontSize: 12, color: "E8ECF6" });
      cards[i].forEach(([n, tag], k) => {
        const y = top + 0.95 + k * 0.62, itda = tag === "잇다 시리즈";
        R(s, { x: x + 0.15, y, w: w - 0.3, h: 0.52, fill: itda ? OTINT : WHITE, r: 0.08 });
        T(s, n, { x: x + 0.3, y, w: 1.6, h: 0.52, fontSize: 14, bold: true, color: itda ? ORANGE : INK, valign: "middle" });
        T(s, tag, { x: x + w - 1.45, y, w: 1.15, h: 0.52, fontSize: 11, bold: true, color: itda ? ORANGE : (tag === "운영 중" || tag === "2027.2" ? NAVY : MUTED), align: "right", valign: "middle" });
      });
    });
    s.addShape(pres.shapes.LINE, { x: 0.9, y: 2.0, w: 7.6, h: 1.55, flipV: true, line: { color: HEX.orange, width: 2.5, endArrowType: "triangle", dashType: "dash" }, objectName: oid("line") });
    T(s, "강사의 성장", { x: 2.4, y: 2.15, w: 2.2, h: 0.4, fontSize: 15, bold: true, color: ORANGE, rotate: -11 });
    source(s, "");
    s.addNotes("강사가 한 계단씩 올라갈 때마다 필요한 서비스를 붙입니다. 입문 단계의 데뷔 교육, 첫 출강 단계의 인증 배지와 경력 증명, 활동 강사를 위한 맞춤 추천과 서류 지갑, 그리고 잇다 시리즈인 출강잇다와 월간 강사입니다. 출강잇다는 강의료 입금 여부만 보여 주고, 강의료는 기관이 직접 지급합니다.");
  }

  // ===== 23. 시장 확대: 길어지는 화살표 =====
  {
    const s = content("Q4 성장 전략 · 고객·시장 확대", "부울경·경북 학교에서 시작해 전국 기업 교육까지 넓힙니다", S4);
    const st = [["1단계", "부울경·경북", "학교 (방과후·늘봄·돌봄)", "경력단절여성·시니어·경력 전환자", 6.6, TINT, NAVY], ["2단계", "대구 포함 영남권", "평생학습관·지자체", "활동 강사 전체", 9.4, "8FA0CC", WHITE], ["3단계", "전국", "기업 교육", "활동 강사 전체", 12.13, NAVY, WHITE]];
    st.forEach(([n, reg, f, who, w, fill, fg], i) => {
      const y = 1.75 + i * 1.62, h = 1.48;
      s.addShape(pres.shapes.PENTAGON, { x: 0.6, y, w, h, fill: { color: fill }, line: { type: "none" }, objectName: oid("arrow") });
      pill(s, n, 0.85, y + 0.2, 0.95, 0.36, fg === WHITE ? WHITE : NAVY, fg === WHITE ? NAVY : WHITE, 12);
      T(s, reg, { x: 1.95, y: y + 0.13, w: 4.5, h: 0.5, fontSize: 22, bold: true, color: fg, valign: "middle" });
      T(s, [{ text: "분야  ", options: { fontSize: 12, color: fg === WHITE ? "E8ECF6" : MUTED } }, { text: f, options: { bold: true, breakLine: true } }, { text: "강사층  ", options: { fontSize: 12, color: fg === WHITE ? "E8ECF6" : MUTED } }, { text: who, options: { bold: true } }], { x: 0.85, y: y + 0.66, w: w - 1.5, h: 0.75, fontSize: 15, color: fg, valign: "middle", paraSpaceAfter: 2 });
    });
    s.addNotes("시장은 세 단계로 넓힙니다. 1단계는 부울경·경북의 학교와 경력단절여성·시니어 강사, 2단계는 대구를 포함한 영남권 평생학습관과 지자체, 3단계는 전국 기업 교육입니다.");
  }

  // ===== 24. 필요 자원 =====
  {
    const s = content("Q4 성장 전략 · 필요한 자원", "인력·기관·제도, 확보 방향까지 정해 두었습니다", S4);
    const rs = [["개발 인력", "결제·추천·경력 증명 기능", "외주 후 개발자 채용 (2027 하반기)", "FaLaptopCode"], ["교육 운영 인력", "데뷔 교육 기수 확대", "출강에 성공한 수료 강사를 보조 강사로", "FaChalkboardUser"], ["협력 기관", "배지의 공신력, 의뢰 수요", "부산·경남 교육청, 김해여성인력센터 등과 협약", "FaBuildingColumns"], ["법·제도", "노출·광고비 구조의 적법성", "고용센터·노무사 확인 (직업정보제공사업 범위)", "FaScaleBalanced"]];
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = Math.floor(i / 2), x = 0.6 + col * 6.17, y = 1.8 + row * 2.4, w = 5.96;
      R(s, { x, y, w, h: 2.2, fill: BG });
      await iconCircle(s, rs[i][3], x + 0.3, y + 0.3, 0.8, NAVY, "FFFFFF");
      T(s, rs[i][0], { x: x + 1.3, y: y + 0.35, w: 4.4, h: 0.45, fontSize: 19, bold: true, color: NAVY });
      T(s, [{ text: "필요한 이유  ", options: { bold: true, color: MUTED, fontSize: 12 } }, { text: rs[i][1], options: { color: INK2 } }], { x: x + 1.3, y: y + 0.88, w: 4.45, h: 0.4, fontSize: 14 });
      T(s, [{ text: "확보 방향  ", options: { bold: true, color: ORANGE, fontSize: 12 } }, { text: rs[i][2], options: { bold: true, color: INK } }], { x: x + 1.3, y: y + 1.3, w: 4.45, h: 0.7, fontSize: 14 });
    }
    s.addNotes("성장에 필요한 자원은 네 가지입니다. 개발 인력은 외주 후 2027년 하반기에 채용하고, 교육 운영 인력은 출강에 성공한 수료 강사를 보조 강사로 세웁니다. 부산·경남 교육청과 여성인력센터 등과 협약을 추진하고, 광고비 구조의 적법성은 고용센터와 노무사 확인을 거쳐 진행합니다.");
  }

  // ===== 25. 마무리 =====
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: S4 });
    s.addText("감사합니다", { placeholder: "title" });
    s.addText("영남권 기관이 강사를 찾을 때\n가장 먼저 여는 곳, 강사잇다", { placeholder: "body" });
    T(s, "박서현 대표  ·  www.gangsaitda.com", { x: 0.8, y: 6.2, w: 7, h: 0.4, fontSize: 14, color: "C9D1E6" });
    const k = [["실제 강의 연결", "3건"], ["유료 교육 결제", "10명"], ["회원", "500+명"]];
    k.forEach(([a, b], i) => {
      const y = 2.0 + i * 1.3;
      R(s, { x: 8.7, y, w: 3.9, h: 1.1, fill: "2A4489" });
      T(s, a, { x: 9.0, y, w: 2, h: 1.1, fontSize: 15, bold: true, color: "C9D1E6", valign: "middle" });
      T(s, b, { x: 10.6, y, w: 1.8, h: 1.1, fontSize: 28, bold: true, color: WHITE, align: "right", valign: "middle" });
    });
    pill(s, "특허 출원 10-2026-0223988", 8.7, 6.0, 3.9, 0.42, ORANGE, WHITE, 13);
    s.addNotes("강사잇다는 강사에게는 첫 출강부터 함께하는 곳, 기관에는 인맥 대신 인증된 실적으로 강사를 찾는 창구가 되겠습니다. 감사합니다.");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
