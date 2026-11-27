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

  // ===== 4. 문제 구조 =====
  {
    const s = content("Q1 문제 인식 · 해결하려는 문제", "강사와 기관이 서로를 찾지 못하는 구조", S1);
    R(s, { x: 0.6, y: 1.7, w: 5.3, h: 4.05, fill: TINT });
    R(s, { x: 7.43, y: 1.7, w: 5.3, h: 4.05, fill: BG });
    pill(s, "강사 (공급)", 2.5, 1.88, 1.5, 0.38, NAVY, WHITE, 13);
    pill(s, "기관 (수요)", 9.33, 1.88, 1.5, 0.38, INK2, WHITE, 13);
    // 악순환 3노드
    const nodes = [[2.15, 2.45, "실적 없음", "첫 경력 쌓을 곳이 없음"], [3.5, 4.35, "공고 지원 불가", "경력 1년 이상 요구"], [0.8, 4.35, "출강 기회 없음", "인맥 없으면 추천도 없음"]];
    for (const [x, y, t, d] of nodes) {
      R(s, { x, y, w: 2.2, h: 1.05, fill: "FFFFFF", line: HEX.navy, lw: 1.5 });
      T(s, t, { x, y: y + 0.12, w: 2.2, h: 0.4, fontSize: 15, bold: true, align: "center" });
      T(s, d, { x: x + 0.1, y: y + 0.55, w: 2.0, h: 0.35, fontSize: 12, color: INK2, align: "center" });
    }
    L(s, 4.0, 3.55, 4.45, 4.3, { color: HEX.navy, width: 2, arrow: true });
    L(s, 3.45, 4.88, 3.05, 4.88, { color: HEX.navy, width: 2, arrow: true });
    L(s, 1.75, 4.3, 2.3, 3.55, { color: HEX.navy, width: 2, arrow: true });
    T(s, "악순환", { x: 2.25, y: 3.75, w: 2.0, h: 0.4, fontSize: 16, bold: true, color: NAVY, align: "center" });
    // 기관 흐름
    const org = [["인맥·지인 추천에 의존", "기관 3곳 인터뷰 공통 답변"], ["새 강사를 검증할 수단 없음", "“1분 영상으로는 판단 어려움”"], ["늘 아는 강사만 다시 섭외", "새로운 강사가 들어갈 틈이 없음"]];
    org.forEach(([t, d], i) => {
      const y = 2.45 + i * 1.08;
      R(s, { x: 7.85, y, w: 4.46, h: 0.86, fill: "FFFFFF", line: HEX.muted, lw: 1.25 });
      T(s, t, { x: 7.85, y: y + 0.08, w: 4.46, h: 0.38, fontSize: 15, bold: true, align: "center" });
      T(s, d, { x: 7.85, y: y + 0.46, w: 4.46, h: 0.3, fontSize: 12, color: INK2, align: "center" });
      if (i < 2) L(s, 10.08, y + 0.88, 10.08, y + 1.06, { color: HEX.muted, width: 1.5, arrow: true });
    });
    // 연결 단절
    T(s, "연결 단절", { x: 5.95, y: 2.95, w: 1.43, h: 0.35, fontSize: 14, bold: true, color: HEX.red, align: "center" });
    L(s, 6.05, 3.55, 7.3, 3.55, { color: HEX.red, width: 1.75, dash: "dash", arrow: true });
    L(s, 7.3, 4.05, 6.05, 4.05, { color: HEX.red, width: 1.75, dash: "dash", arrow: true });
    T(s, "✕", { x: 6.42, y: 3.55, w: 0.5, h: 0.5, fontSize: 24, bold: true, color: HEX.red, align: "center", valign: "middle" });
    R(s, { x: 0.6, y: 5.95, w: 12.13, h: 0.6, fill: NAVY, r: 0.1 });
    T(s, "필요한 것: 첫 실적을 만들어 주고, 기관이 믿을 근거를 함께 주는 연결", { x: 0.6, y: 5.95, w: 12.13, h: 0.6, fontSize: 17, bold: true, color: WHITE, align: "center", valign: "middle" });
    source(s, "출처: 기관 3곳 인터뷰, 부산 남구청 공지(2026.7.8), 서대문구청 공고(2025.12.18)");
    s.addNotes("강사는 실적이 없어서 공고에 지원하지 못하고, 지원하지 못하니 출강 기회가 없는 악순환에 빠집니다. 기관은 인터뷰한 3곳 모두 인맥과 지인 추천에 의존했고, 새 강사를 검증할 방법이 없어 늘 아는 강사만 다시 부릅니다. 결국 필요한 것은 첫 실적을 만들어 주고 기관이 믿을 근거를 함께 주는 연결입니다.");
  }

  // ===== 5. 강사의 어려움 (도넛 3개) =====
  {
    const s = content("Q1 문제 인식 · 강사가 겪는 어려움", "강사 10명 중 6명이 공고를 놓치고, 4명은 첫 경력에서 막힙니다", S1);
    const d = [["공고를 놓친 경험", 60, "강사잇다 강사 설문 (n=100, 2026.11)", HEX.orange], ["정기적인 일감 없음", 54.6, "서울시 프리랜서 1,000명 실태조사 (2018)", HEX.navy], ["첫 경력 쌓기가 가장 어려움", 40, "강사잇다 강사 설문 (n=100, 2026.11)", HEX.navy]];
    const w = 3.83, g = 0.32;
    d.forEach(([lab, v, src, col], i) => {
      const x = 0.6 + i * (w + g);
      R(s, { x, y: 1.75, w, h: 4.35, fill: BG });
      T(s, lab, { x: x + 0.3, y: 1.98, w: w - 0.6, h: 0.4, fontSize: 17, bold: true, align: "center" });
      s.addChart(pres.charts.DOUGHNUT, [{ name: lab, labels: ["해당", "그 외"], values: [v, 100 - v] }], {
        x: x + 0.62, y: 2.5, w: 2.6, h: 2.6, holeSize: 72, chartColors: [col, HEX.line], showLegend: false, showValue: false, showPercent: false, showLabel: false, showTitle: false, firstSliceAng: 0, dataBorder: { pt: 0, color: "FFFFFF" }, objectName: oid("chart"), ...chartText,
      });
      T(s, [{ text: String(v), options: { fontSize: 36, bold: true, color: col } }, { text: "%", options: { fontSize: 18, bold: true, color: col } }], { x: x + 0.62, y: 3.4, w: 2.6, h: 0.8, align: "center", valign: "middle" });
      T(s, src, { x: x + 0.3, y: 5.3, w: w - 0.6, h: 0.6, fontSize: 12, color: INK2, align: "center" });
    });
    R(s, { x: 0.6, y: 6.25, w: 12.13, h: 0.42, fill: OTINT, r: 0.08 });
    T(s, "강사 402명 조사에서 ‘차별화·브랜드 마케팅’이 모든 경력 단계의 요구도 1순위 (김종현·엄우용, 2019, 교육과 학습 9(4))", { x: 0.85, y: 6.25, w: 11.7, h: 0.42, fontSize: 12, color: INK, valign: "middle" });
    s.addNotes("강사잇다 강사 설문에서 60%가 공고를 놓친 경험이 있었고, 40%는 첫 경력 쌓기를 가장 어려운 점으로 꼽았습니다. 서울시 프리랜서 실태조사에서도 54.6%가 정기적인 일감이 없다고 답했습니다.");
  }

  // ===== 6. 목표 시장 =====
  {
    const s = content("Q1 문제 인식 · 목표 고객과 시장", "부울경·경북 연 1만 건의 강사 공고부터 시작합니다", S1);
    const cx = 3.05, base = 6.3;
    [[4.4, TINT], [3.05, HEX.soft], [1.7, NAVY]].forEach(([d, col]) => Oval(s, { x: cx - d / 2, y: base - d, w: d, h: d, fill: col }));
    T(s, "전체", { x: cx - 1, y: base - 4.15, w: 2, h: 0.35, fontSize: 14, bold: true, color: NAVY, align: "center" });
    T(s, "목표", { x: cx - 1, y: base - 2.85, w: 2, h: 0.35, fontSize: 14, bold: true, color: NAVY, align: "center" });
    T(s, "초기", { x: cx - 1, y: base - 1.05, w: 2, h: 0.4, fontSize: 15, bold: true, color: WHITE, align: "center" });
    const rows = [["전체 시장", "9,557억 원", "방과후강사 7.4만 명에게 지급된 연간 금액 (국세청 사업소득 원천징수 신고 통계)", TINT], ["목표 시장", "연 약 1만 건", "부울경·경북 공공기관 강사 공고 (추정: 경남 하루 9.3건 × 4개 지역)", HEX.soft], ["초기 고객", "회원 500+명", "강사 모임 1,000명 · 당근모임 260명 · 스레드 팔로워 600명 (2026.11.27)", NAVY]];
    rows.forEach(([t, n, d, col], i) => {
      const y = 1.8 + i * 1.45;
      R(s, { x: 5.9, y: y + 0.1, w: 0.32, h: 0.32, fill: col, r: 0.06 });
      T(s, t, { x: 6.4, y: y + 0.03, w: 1.8, h: 0.45, fontSize: 16, bold: true, color: INK2, valign: "middle" });
      T(s, n, { x: 8.2, y: y - 0.08, w: 4.5, h: 0.68, fontSize: 30, bold: true, color: NAVY, valign: "middle" });
      T(s, d, { x: 6.4, y: y + 0.62, w: 6.3, h: 0.55, fontSize: 13, color: INK2 });
      if (i < 2) L(s, 5.9, y + 1.32, 12.73, y + 1.32, { color: HEX.line, width: 1 });
    });
    R(s, { x: 5.9, y: 6.08, w: 6.83, h: 0.48, fill: OTINT, r: 0.08 });
    T(s, "잠재 강사층: 부울경 경력단절여성 16.5만 명 (KOSIS 2025)", { x: 6.1, y: 6.08, w: 6.5, h: 0.48, fontSize: 14, bold: true, color: INK, valign: "middle" });
    s.addNotes("방과후 강사 7.4만 명에게 지급되는 금액만 연 9,557억 원입니다. 저희는 그중 부울경·경북 공공기관에서 나오는 연 약 1만 건의 강사 공고를 목표 시장으로 잡았고, 이미 모인 회원 500명 이상이 초기 고객입니다. 경력을 강의로 바꾸려는 부울경 경력단절여성만 16.5만 명입니다.");
  }

  // ===== 7. 기존 방식 한계 =====
  {
    const s = content("Q1 문제 인식 · 기존 해결 방식의 한계", "기존 서비스에는 ‘실제 연결’이 비어 있습니다", S1);
    const H = { bold: true, color: NAVY, fill: { color: HEX.tint }, fontSize: 14, valign: "middle" };
    const c = { fontSize: 14, color: INK, valign: "middle" };
    const rows = [
      [{ text: "기존 방식", options: H }, { text: "하는 일", options: H }, { text: "한계", options: H }],
      [{ text: "공고 모음 서비스", options: { ...c, bold: true } }, { text: "공고를 모아 보여 줌", options: c }, { text: [{ text: "이미 강사인 사람", options: { bold: true, color: HEX.orange } }, { text: "에게만 유용함" }], options: c }],
      [{ text: "늘봄허브 (공공)", options: { ...c, bold: true } }, { text: "늘봄·방과후 프로그램 등록", options: c }, { text: "심사 연 2회, 늘봄·방과후에 한정", options: c }],
      [{ text: "강사 양성 학원", options: { ...c, bold: true } }, { text: "60만~298만 원 교육 판매", options: c }, { text: "공고·기관 연결은 보장하지 않음", options: c }],
      [{ text: "학교 강사 매칭 앱", options: { ...c, bold: true } }, { text: "강사·학교 연결", options: c }, { text: [{ text: "운영 종료", options: { bold: true, color: HEX.orange } }, { text: " (연결만으로는 지속 어려움)" }], options: c }],
    ];
    s.addTable(rows, { x: 0.6, y: 1.8, w: 8.1, colW: [2.3, 2.75, 3.05], rowH: 0.86, border: { type: "solid", pt: 0.75, color: HEX.line }, margin: [0, 0.15, 0, 0.15], objectName: oid("table") });
    R(s, { x: 9.05, y: 1.8, w: 3.68, h: 3.9, fill: NAVY });
    T(s, "강사잇다는 이 빈칸을 잇습니다", { x: 9.35, y: 2.05, w: 3.1, h: 0.8, fontSize: 18, bold: true, color: WHITE });
    ["공고 무료 제공", "데뷔 교육", "단계별 인증 배지", "기관 의뢰·직접 선택"].forEach((t, i) => {
      const y = 3.0 + i * 0.62;
      Oval(s, { x: 9.38, y: y + 0.08, w: 0.3, h: 0.3, fill: ORANGE });
      T(s, "✓", { x: 9.38, y: y + 0.08, w: 0.3, h: 0.3, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, t, { x: 9.85, y, w: 2.7, h: 0.46, fontSize: 15, bold: true, color: WHITE, valign: "middle" });
    });
    source(s, "출처: 서울시 보도자료(2018.4), timelyedu.kr, 각 서비스 홈페이지 직접 확인(2026.11.23), 양성 학원 가격은 기사·판매 페이지 기준");
    s.addNotes("공고 모음 서비스는 이미 강사인 사람에게만 유용하고, 양성 학원은 60만~298만 원의 교육을 팔지만 연결은 보장하지 않습니다. 강사와 학교를 연결하던 앱은 운영을 종료했습니다. 연결만으로는 지속이 어렵다는 뜻이고, 그래서 강사잇다는 교육과 인증, 연결을 함께 묶었습니다.");
  }

  // ===== 8. 서비스 흐름 =====
  pres.addSection({ title: "Q2 실현 가능성" });
  const S2 = "Q2 실현 가능성";
  {
    const s = content("Q2 실현 가능성 · 핵심 기능", "공고 찾기부터 첫 출강까지 한 번에 이어 줍니다", S2);
    pill(s, "강사잇다만의 차별점 ②③④", 9.9, 0.92, 2.83, 0.4, ORANGE, WHITE, 13);
    const st = [["①", "공고 모음", "입구 · 무료", "부울경·경북 교육청·구청·평생교육원 공고 매일 자동 수집", "운영 중"], ["②", "데뷔 교육", "유료 · 기수제", "입문 특강 → 프로필 실습 → 1:1 지원서 컨설팅", "1기 완료"], ["③", "인증 배지", "신뢰 근거", "공공기관 강의 확인 · 강의 경력 · 실적 시간 (50h+, 100h+)", "2027.2"], ["④", "기관 연결", "기관 무료", "섭외 의뢰서 접수, 기관이 강사 프로필을 보고 직접 선택", "운영 중"], ["⑤", "첫 출강 · 실적", "성과", "강의료는 기관이 강사에게 직접 지급 (수수료 없음)", "3건 연결"]];
    const w = 2.15, g = 0.345, y = 1.75, h = 3.55;
    st.forEach(([no, name, tag, desc, stat], i) => {
      const x = 0.6 + i * (w + g), hi = i >= 1 && i <= 3;
      R(s, { x, y, w, h, fill: hi ? TINT : BG });
      R(s, { x, y, w, h: 1.0, fill: hi ? NAVY : INK2 });
      Rect(s, { x, y: y + 0.8, w, h: 0.2, fill: hi ? NAVY : INK2 });
      T(s, `${no} ${name}`, { x: x + 0.1, y: y + 0.14, w: w - 0.2, h: 0.42, fontSize: 16, bold: true, color: WHITE, align: "center" });
      T(s, tag, { x: x + 0.1, y: y + 0.56, w: w - 0.2, h: 0.3, fontSize: 12, color: "DDE3F0", align: "center" });
      T(s, desc, { x: x + 0.18, y: y + 1.2, w: w - 0.36, h: 1.45, fontSize: 14, color: INK, align: "center" });
      pill(s, stat, x + 0.4, y + h - 0.65, w - 0.8, 0.4, WHITE, hi ? NAVY : INK2, 13);
      if (i < 4) L(s, x + w + 0.05, y + h / 2, x + w + g - 0.05, y + h / 2, { color: HEX.muted, width: 2, arrow: true });
    });
    // 되먹임 ⑤ → ③
    const xa = 0.6 + 4 * (w + g) + w / 2, xb = 0.6 + 2 * (w + g) + w / 2, yb = 5.75;
    L(s, xa, y + h + 0.05, xa, yb, { color: HEX.orange, width: 2.25 });
    L(s, xa, yb, xb, yb, { color: HEX.orange, width: 2.25 });
    L(s, xb, yb, xb, y + h + 0.06, { color: HEX.orange, width: 2.25, arrow: true });
    T(s, "출강 실적이 다시 인증 배지로 쌓여, 다음 공고·의뢰에 유리해짐", { x: xb - 1.0, y: yb + 0.12, w: 7.3, h: 0.4, fontSize: 15, bold: true, color: ORANGE, align: "center" });
    s.addNotes("강사잇다는 다섯 단계로 이어집니다. 무료 공고 모음이 입구이고, 데뷔 교육, 단계별 인증 배지, 기관 의뢰가 기존 서비스에 없는 부분입니다. 출강 실적은 다시 인증 배지로 쌓여 다음 공고와 의뢰에 유리해지는 선순환을 만듭니다.");
  }

  // ===== 9. 공고 자동 수집 =====
  {
    const s = content("Q2 실현 가능성 · 공고 자동 수집", "흩어진 공공 강사 공고를 매일 모아 한 화면에 보여 줍니다", S2);
    const src = [["교육청", "부산·울산·경남·경북"], ["시·군·구청", "평생학습·주민센터"], ["시설공단", "문화·체육 강좌"], ["대학 평생교육원", "강좌 강사 모집"], ["학교", "방과후·늘봄 강사"]];
    const hx = 5.55, hy = 3.85;
    src.forEach(([a, b], i) => {
      const y = 1.75 + i * 0.95;
      R(s, { x: 0.6, y, w: 2.85, h: 0.8, fill: BG, line: LINE });
      T(s, a, { x: 0.8, y: y + 0.08, w: 2.5, h: 0.36, fontSize: 15, bold: true });
      T(s, b, { x: 0.8, y: y + 0.44, w: 2.5, h: 0.28, fontSize: 12, color: INK2 });
      L(s, 3.5, y + 0.4, hx - 1.0, hy, { color: HEX.soft, width: 1.5, dash: "dash" });
    });
    Oval(s, { x: hx - 1.05, y: hy - 1.05, w: 2.1, h: 2.1, fill: NAVY });
    T(s, "강사잇다", { x: hx - 1.05, y: hy - 0.55, w: 2.1, h: 0.45, fontSize: 19, bold: true, color: WHITE, align: "center" });
    T(s, "매일 자동 수집\n정규화 · 검증", { x: hx - 1.05, y: hy - 0.05, w: 2.1, h: 0.6, fontSize: 12, color: "DDE3F0", align: "center" });
    pill(s, "특허 출원 10-2026-0223988", hx - 1.45, hy + 1.3, 2.9, 0.4, OTINT, ORANGE, 12);
    L(s, hx + 1.15, hy, 7.55, hy, { color: HEX.navy, width: 3, arrow: true });
    R(s, { x: 7.75, y: 1.75, w: 4.98, h: 4.2, fill: "FFFFFF", line: LINE, shadow: true });
    T(s, "강사잇다 공고 화면", { x: 8.1, y: 2.0, w: 4.3, h: 0.35, fontSize: 14, bold: true, color: INK2 });
    T(s, "지원 가능 공고", { x: 8.1, y: 2.55, w: 4.3, h: 0.35, fontSize: 15, bold: true });
    T(s, [{ text: "281", options: { fontSize: 54, bold: true, color: NAVY } }, { text: " 건", options: { fontSize: 22, bold: true, color: NAVY } }], { x: 8.1, y: 2.9, w: 4.3, h: 0.95, valign: "middle" });
    T(s, "1R 당시 228건 → 현재", { x: 8.1, y: 3.85, w: 4.3, h: 0.3, fontSize: 12, color: INK2 });
    ["지역·마감일 필터", "가입 없이 무료 열람", "www.gangsaitda.com 운영 중"].forEach((t, i) => {
      const y = 4.4 + i * 0.45;
      Oval(s, { x: 8.1, y: y + 0.1, w: 0.18, h: 0.18, fill: ORANGE });
      T(s, t, { x: 8.42, y, w: 4.0, h: 0.38, fontSize: 14, valign: "middle" });
    });
    source(s, "실제 서비스 화면 캡처를 이 오른쪽 카드 자리에 넣으면 더 설득력 있음 (사업계획서 그림 4)");
    s.addNotes("교육청, 구청, 시설공단, 대학 평생교육원, 학교에 흩어진 강사 공고를 매일 자동으로 모으고 정규화해서 한 화면에 보여 줍니다. 이 수집·정규화·검증 방식은 특허 출원했습니다. 지원 가능한 공고는 1R 당시 228건에서 현재 281건입니다.");
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

  // ===== 11. 추진 경과 타임라인 =====
  {
    const s = content("Q2 실현 가능성 · 추진 경과와 다음 일정", "신고·교육·특허를 마쳤고, 다음은 결제 연동과 인증 배지입니다", S2);
    const ev = [["2026.8", "직업정보제공사업 신고", "부산북부지청", 1, 1], ["10.26", "데뷔 교육 1기", "입문 특강 10명 결제", 0, 1], ["10월 말", "1R 통과", "경남 · 경상국립대학교", 1, 1], ["11.10", "특허 출원", "공고 수집·정규화·검증", 0, 1], ["1R 이후", "기관 직접 선택 기능", "국내 서버 이전", 1, 1], ["11.27", "회원 500+명", "스레드 누적 조회 19.1만", 0, 1], ["12월", "결제 연동", "토스페이먼츠", 1, 0], ["2027.1", "데뷔 교육 2기", "신학기 공고 대응", 0, 0], ["2027.2~3", "배지·기관 파일럿", "인터뷰 기관 3곳", 1, 0]];
    const ly = 4.05, x0 = 1.15, step = 1.38;
    L(s, x0 - 0.3, ly, x0 + 5 * step, ly, { color: HEX.ink2, width: 3 });
    L(s, x0 + 5 * step, ly, x0 + 8 * step + 0.4, ly, { color: HEX.orange, width: 3 });
    ev.forEach(([dt, t, d, up, done], i) => {
      const x = x0 + i * step, col = done ? NAVY : ORANGE;
      Oval(s, { x: x - 0.12, y: ly - 0.12, w: 0.24, h: 0.24, fill: WHITE, line: done ? HEX.navy : HEX.orange, lw: 2.5 });
      const bw = 2.3;
      let bx = x - bw / 2, al = "center";
      if (bx < 0.6) { bx = 0.6; al = "left"; }
      if (bx + bw > 12.73) { bx = 12.73 - bw; al = "right"; }
      if (up) {
        L(s, x, ly - 0.16, x, ly - 0.6, { color: HEX.line, width: 1 });
        T(s, dt, { x: x - 0.8, y: ly + 0.22, w: 1.6, h: 0.32, fontSize: 13, bold: true, color: col, align: "center" });
        T(s, t, { x: bx, y: ly - 1.55, w: bw, h: 0.6, fontSize: 14, bold: true, color: done ? INK : ORANGE, align: al, valign: "bottom" });
        T(s, d, { x: bx, y: ly - 0.92, w: bw, h: 0.3, fontSize: 12, color: INK2, align: al });
      } else {
        L(s, x, ly + 0.16, x, ly + 0.6, { color: HEX.line, width: 1 });
        T(s, dt, { x: x - 0.8, y: ly - 0.55, w: 1.6, h: 0.32, fontSize: 13, bold: true, color: col, align: "center" });
        T(s, t, { x: bx, y: ly + 0.66, w: bw, h: 0.6, fontSize: 14, bold: true, color: done ? INK : ORANGE, align: al });
        T(s, d, { x: bx, y: ly + 1.02, w: bw, h: 0.3, fontSize: 12, color: INK2, align: al });
      }
    });
    pill(s, "지금까지 한 일", x0 + 1.9, 5.85, 2.2, 0.42, INK2, WHITE, 13);
    pill(s, "앞으로 할 일", x0 + 6.8, 5.85, 2.2, 0.42, ORANGE, WHITE, 13);
    source(s, "웹 서비스 운영 중(www.gangsaitda.com) · 특허 출원 10-2026-0223988 · 직업정보제공사업 신고 J1302020260003 · MVP는 대표가 직접 개발");
    s.addNotes("8월 직업정보제공사업 신고, 10월 데뷔 교육 1기, 1R 통과, 11월 특허 출원까지 마쳤습니다. 1R 이후에는 기관이 강사를 직접 고르는 기능을 붙이고 서버를 국내로 옮겼습니다. 12월 결제 연동, 내년 1월 교육 2기, 2~3월 인증 배지와 기관 파일럿이 다음 일정입니다.");
  }

  // ===== 12. 성과 요약 3열 =====
  {
    const s = content("Q2 실현 가능성 · 검증 결과", "사업·서비스·커뮤니티 세 방향에서 성과가 쌓이고 있습니다", S2);
    const cols = [["사업 성과", "FaHandshake", [["실제 강의 연결 3건", "출강 2건 · 면접 합격 1건"], ["유료 데뷔 교육 1기", "10명 결제"], ["기관 섭외 의뢰 접수", "사이트로 직접 의뢰"], ["회원 500+명", "1R 당시 0명"]]], ["서비스·기술 성과", "FaGears", [["특허 출원", "10-2026-0223988 (2026.11.10)"], ["직업정보제공사업 신고", "J1302020260003"], ["국내 서버 이전", "공고 자동 수집 안정화"], ["기관 강사 직접 선택", "1R 이후 기능 추가"]]], ["커뮤니티 성과", "FaComments", [["스레드 누적 조회 19.1만", "1R 당시 5.1만"], ["스레드 팔로워 600명", "1R 당시 296명"], ["당근모임 260명", "1R 당시 193명"], ["강사 모임 1,000명", "대표가 직접 운영"]]]];
    const w = 3.89, g = 0.23;
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * (w + g), [head, ic, items] = cols[i];
      await iconCircle(s, ic, x, 1.7, 0.5, NAVY, "FFFFFF");
      T(s, head, { x: x + 0.62, y: 1.7, w: 3, h: 0.5, fontSize: 18, bold: true, color: NAVY, valign: "middle" });
      items.forEach(([a, b], k) => {
        const y = 2.4 + k * 1.05, first = k === 0;
        R(s, { x, y, w, h: 0.9, fill: first ? NAVY : BG });
        T(s, a, { x: x + 0.25, y: y + 0.1, w: w - 0.5, h: 0.4, fontSize: 16, bold: true, color: first ? WHITE : INK });
        T(s, b, { x: x + 0.25, y: y + 0.5, w: w - 0.5, h: 0.3, fontSize: 12, color: first ? "DDE3F0" : INK2 });
      });
    }
    source(s, "2026.11.27 기준");
    s.addNotes("성과를 세 방향으로 정리했습니다. 사업 쪽은 실제 강의 연결 3건과 유료 교육 10명, 서비스 쪽은 특허 출원과 사업 신고, 서버 이전, 커뮤니티 쪽은 스레드 누적 조회 19.1만과 팔로워 600명입니다.");
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

  // ===== 14. 포지셔닝 =====
  {
    const s = content("Q2 실현 가능성 · 차별성", "데뷔 교육과 기관 연결을 함께 하는 서비스는 확인되지 않았습니다", S2);
    const L0 = 1.35, T0 = 1.8, W0 = 5.9, H0 = 4.2;
    Rect(s, { x: L0, y: T0, w: W0, h: H0, fill: BG });
    Rect(s, { x: L0 + W0 / 2, y: T0, w: W0 / 2, h: H0 / 2, fill: TINT });
    L(s, L0, T0 + H0 / 2, L0 + W0, T0 + H0 / 2, { color: HEX.line, width: 1 });
    L(s, L0 + W0 / 2, T0, L0 + W0 / 2, T0 + H0, { color: HEX.line, width: 1 });
    L(s, L0, T0 + H0 + 0.15, L0 + W0, T0 + H0 + 0.15, { color: HEX.ink2, width: 1.5, arrow: true });
    T(s, "실제 공고·기관 의뢰 연결", { x: L0, y: T0 + H0 + 0.22, w: W0, h: 0.3, fontSize: 13, bold: true, color: INK2, align: "center" });
    L(s, L0 - 0.15, T0 + H0, L0 - 0.15, T0, { color: HEX.ink2, width: 1.5, arrow: true });
    T(s, "신규 강사 데뷔 지원", { x: L0 - 1.6, y: T0 + H0 / 2 - 0.2, w: 2.4, h: 0.4, fontSize: 13, bold: true, color: INK2, align: "center", valign: "middle", rotate: 270 });
    const pts = [["강사 양성 학원", 0.18, 0.2], ["늘봄허브 (공공)", 0.55, 0.6], ["공고 모음 서비스", 0.66, 0.7], ["섭외 대행", 0.88, 0.9], ["강사잇다", 0.84, 0.18]];
    pts.forEach(([n, fx, fy]) => {
      const me = n === "강사잇다", r = me ? 0.36 : 0.22, x = L0 + W0 * fx, y = T0 + H0 * fy;
      Oval(s, { x: x - r / 2, y: y - r / 2, w: r, h: r, fill: me ? ORANGE : MUTED });
      const side = n === "섭외 대행" || n === "늘봄허브 (공공)";
      const lx = side ? x - 2.25 : x - 1.2, ly = side ? y - 0.18 : y + r / 2 + 0.03;
      T(s, n, { x: lx, y: ly, w: side ? 2.0 : 2.4, h: 0.36, fontSize: me ? 16 : 13, bold: true, color: me ? ORANGE : INK2, align: side ? "right" : "center" });
    });
    T(s, "강사잇다만 가진 것", { x: 7.75, y: 1.75, w: 5, h: 0.4, fontSize: 18, bold: true, color: NAVY });
    const it = [["데뷔 교육", "특강 → 프로필 실습 → 1:1 컨설팅"], ["인증 배지", "공공기관 강의·실적 시간 (2027.2 예정)"], ["기관 직접 의뢰", "부울경·경북 지역 밀착"], ["가입 무료", "교육은 1만 원부터"]];
    it.forEach(([a, b], i) => {
      const y = 2.3 + i * 0.98;
      R(s, { x: 7.75, y, w: 4.98, h: 0.82, fill: BG });
      Oval(s, { x: 7.98, y: y + 0.27, w: 0.28, h: 0.28, fill: NAVY });
      T(s, "✓", { x: 7.98, y: y + 0.27, w: 0.28, h: 0.28, fontSize: 10, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, a, { x: 8.45, y: y + 0.08, w: 4.1, h: 0.36, fontSize: 15, bold: true });
      T(s, b, { x: 8.45, y: y + 0.44, w: 4.1, h: 0.3, fontSize: 12, color: INK2 });
    });
    source(s, "비교 대상: 공고 모음 = 공공강사·티처라인, 섭외 대행 = 더알림·커넥트밸류 (홈페이지 직접 확인 2026.11.23)");
    s.addNotes("가로축은 실제 공고와 기관 의뢰로 연결해 주는 정도, 세로축은 신규 강사의 데뷔를 돕는 정도입니다. 양성 학원은 교육만, 공고 모음과 섭외 대행은 연결만 합니다. 두 가지를 함께 하는 서비스는 확인되지 않았고, 강사잇다가 그 자리를 차지합니다.");
  }

  // ===== 15. 대표 역량 =====
  {
    const s = content("Q2 실현 가능성 · 대표 역량", "현장을 아는 강사가 직접 만들고 운영합니다", S2);
    const cp = [["7년", "프리랜서 강사 경력", "기관이 원하는 강사상을 앎", "FaChalkboardUser"], ["1,000명", "강사 모임 직접 운영", "초기 강사 확보 채널", "FaUsers"], ["학교", "취업·진로 캠프 사업자", "한국엑스퍼트교육원 네트워크", "FaSchool"], ["1인 개발", "기획·개발·운영 직접", "특허 출원·서버 이전 처리", "FaLaptopCode"]];
    const w = 2.83, g = 0.27;
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * (w + g), [n, t, d, ic] = cp[i];
      R(s, { x, y: 1.8, w, h: 3.6, fill: BG });
      await iconCircle(s, ic, x + (w - 0.8) / 2, 2.1, 0.8, NAVY, "FFFFFF");
      T(s, n, { x, y: 3.05, w, h: 0.75, fontSize: 34, bold: true, color: NAVY, align: "center", valign: "middle" });
      T(s, t, { x: x + 0.15, y: 3.9, w: w - 0.3, h: 0.4, fontSize: 16, bold: true, align: "center" });
      T(s, d, { x: x + 0.15, y: 4.35, w: w - 0.3, h: 0.6, fontSize: 13, color: INK2, align: "center" });
    }
    R(s, { x: 0.6, y: 5.7, w: 12.13, h: 0.75, fill: TINT });
    T(s, "MVP는 대표가 직접 개발해 운영 중이고, 고도화는 외주·개발자와 협업합니다", { x: 0.9, y: 5.7, w: 11.6, h: 0.75, fontSize: 16, bold: true, color: NAVY, valign: "middle" });
    s.addNotes("저는 7년 차 강사로 기관이 어떤 강사를 원하는지 알고, 1,000명 강사 모임을 직접 운영해 초기 강사를 모을 수 있습니다. 취업·진로 캠프 사업으로 학교 네트워크도 갖고 있습니다. 서비스는 제가 직접 개발해 운영 중이며, 고도화는 외주와 협업합니다.");
  }

  // ===== 16. 비즈니스 모델 =====
  pres.addSection({ title: "Q3 사업화 전략" });
  const S3 = "Q3 사업화 전략";
  {
    const s = content("Q3 사업화 전략 · 수익 구조", "가입은 무료, 강사가 한 단계 올라서는 시점에 수익이 생깁니다", S3);
    const nodes = [[0.6, "강사", "신규·전환 강사, 활동 강사", TINT, NAVY], [5.12, "강사잇다", "공고·교육·배지·연결", NAVY, WHITE], [9.63, "학교·기관", "방과후·늘봄·평생교육원", BG, INK]];
    const nw = 3.1, ny = 2.75, nh = 1.25;
    nodes.forEach(([x, t, d, f, c]) => {
      R(s, { x, y: ny, w: nw, h: nh, fill: f });
      T(s, t, { x, y: ny + 0.15, w: nw, h: 0.55, fontSize: 24, bold: true, color: c, align: "center" });
      T(s, d, { x, y: ny + 0.72, w: nw, h: 0.35, fontSize: 13, color: c === WHITE ? "DDE3F0" : INK2, align: "center" });
    });
    // 서비스(위, 남색)
    L(s, 5.05, ny + 0.3, 3.77, ny + 0.3, { color: HEX.navy, width: 2.5, arrow: true });
    L(s, 8.29, ny + 0.3, 9.56, ny + 0.3, { color: HEX.navy, width: 2.5, arrow: true });
    T(s, "공고 무료 제공 · 데뷔 교육\n인증 배지 · 프로필 노출", { x: 2.6, y: 1.7, w: 3.7, h: 0.75, fontSize: 13, bold: true, color: NAVY, align: "center", valign: "bottom" });
    T(s, "검증된 강사 추천\n섭외 의뢰 연결", { x: 7.05, y: 1.7, w: 3.7, h: 0.75, fontSize: 13, bold: true, color: NAVY, align: "center", valign: "bottom" });
    // 수익(아래, 주황)
    L(s, 3.77, ny + 0.95, 5.05, ny + 0.95, { color: HEX.orange, width: 2.5, arrow: true });
    L(s, 9.56, ny + 0.95, 8.29, ny + 0.95, { color: HEX.orange, width: 2.5, arrow: true });
    R(s, { x: 1.9, y: 4.25, w: 4.6, h: 1.5, fill: OTINT });
    T(s, [{ text: "① 데뷔 교육 1인 30만 원", options: { bold: true, fontSize: 15, breakLine: true } }, { text: "기수제, 출강 2회 보장", options: { fontSize: 12, color: INK2, breakLine: true } }, { text: "② 노출·광고비 월 3만 원", options: { bold: true, fontSize: 15, breakLine: true } }, { text: "2027년 3분기부터", options: { fontSize: 12, color: INK2 } }], { x: 2.15, y: 4.3, w: 4.2, h: 1.4, valign: "middle" });
    R(s, { x: 6.85, y: 4.25, w: 4.6, h: 1.5, fill: OTINT });
    T(s, [{ text: "③ 섭외 대행 건당 10만 원", options: { bold: true, fontSize: 15, breakLine: true } }, { text: "2028년부터, 조건 맞춤 선별·추천", options: { fontSize: 12, color: INK2 } }], { x: 7.1, y: 4.3, w: 4.2, h: 1.4, valign: "middle" });
    L(s, 11.18, 6.0, 2.15, 6.0, { color: HEX.muted, width: 1.5, dash: "dash", arrow: true });
    T(s, "강의료: 기관 → 강사 직접 지급 (강사잇다는 성사 수수료를 받지 않음)", { x: 2.2, y: 6.06, w: 9, h: 0.35, fontSize: 13, bold: true, color: INK2, align: "center" });
    // 범례
    L(s, 0.6, 6.68, 1.0, 6.68, { color: HEX.navy, width: 2.5 }); T(s, "서비스 흐름", { x: 1.08, y: 6.55, w: 1.4, h: 0.28, fontSize: 11, color: INK2 });
    L(s, 2.4, 6.68, 2.8, 6.68, { color: HEX.orange, width: 2.5 }); T(s, "수익 흐름", { x: 2.88, y: 6.55, w: 1.4, h: 0.28, fontSize: 11, color: INK2 });
    s.addNotes("가입과 공고 열람은 무료입니다. 수익은 강사가 한 단계 올라서는 시점에 받습니다. 데뷔 교육 1인 30만 원, 2027년 3분기부터 노출·광고비 월 3만 원, 2028년부터 섭외 대행 건당 10만 원입니다. 강의료는 기관이 강사에게 직접 지급하고, 저희는 성사 수수료를 받지 않습니다.");
  }

  // ===== 17. 가격 근거 + 진입 전략 =====
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
    T(s, "초기 시장 진입 전략", { x: 6.85, y: 1.7, w: 5.8, h: 0.35, fontSize: 15, bold: true, color: INK2 });
    const st = [["강사", "FaUsers", "강사 모임 1,000명 · 당근모임 260명 · 스레드에 무료 공고 → 첫 출강이 급한 강사를 데뷔 교육으로"], ["기관", "FaSchool", "인터뷰 기관 3곳 + 캠프 사업의 학교 네트워크를 파일럿 기관으로"], ["시기·지역", "FaMapLocationDot", "신학기 1~3월 집중 / 경남 → 부산 → 울산 → 경북·대구 → 전국"]];
    for (let i = 0; i < 3; i++) {
      const y = 2.15 + i * 1.47;
      R(s, { x: 6.85, y, w: 5.88, h: 1.3, fill: "FFFFFF", line: LINE });
      await iconCircle(s, st[i][1], 7.08, y + 0.3, 0.7, TINT, HEX.navy);
      T(s, st[i][0], { x: 8.0, y: y + 0.13, w: 4.5, h: 0.36, fontSize: 16, bold: true, color: NAVY });
      T(s, st[i][2], { x: 8.0, y: y + 0.5, w: 4.55, h: 0.7, fontSize: 13, color: INK });
    }
    s.addNotes("가격 근거입니다. 한 학기 강의 자리, 즉 주 1회 15주면 강의료가 75만~105만 원입니다. 첫 자리 하나로 교육비 30만 원의 2.5배 이상을 돌려받는 구조이고, 수료 후 12개월 안에 연결되지 않으면 다음 기수를 무료로 들을 수 있습니다. 진입은 이미 모인 커뮤니티와 이미 만난 기관에서 시작하고, 신학기인 1~3월에 집중합니다.");
  }

  // ===== 18. 로드맵 =====
  {
    const s = content("Q3 사업화 전략 · 단계별 추진 일정 (추정)", "2027년 검증·수익화, 2028년 영남권으로 넓힙니다", S3);
    const stg = [["1. 검증", "2026.12~2027.2", ["인증 배지 기준 확정", "결제 연동", "데뷔 교육 2기"], ["회원 700명", "교육 수강 20명", "기관 의뢰 5건"]], ["2. 수익화", "2027.3~6", ["공공기관 의뢰 연결", "배지 1차 부여", "신학기 공고 대응"], ["출강 연결 10건", "교육 매출 1,200만 원", "재수강·재의뢰 30%"]], ["3. 확장", "2027.7~12", ["노출·광고비 도입", "부산·울산 기관 협력"], ["유료 강사 30명", "협력 기관 10곳"]], ["4. 영남권", "2028~", ["섭외 대행 시작", "경북·대구 확대"], ["회원 2,000명", "협력 기관 30곳", "연간 연결 100건"]]];
    const shades = ["8FA0CC", "5B6FA8", "2A4489", "163072"];
    const w = 3.0, g = 0.043;
    stg.forEach(([n, when, todo, goal], i) => {
      const x = 0.6 + i * (w + g);
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x, y: 1.7, w: w + 0.1, h: 0.95, fill: { color: shades[i] }, line: { type: "none" }, objectName: oid("chevron") });
      T(s, n, { x: x + 0.35, y: 1.74, w: w - 0.5, h: 0.45, fontSize: 18, bold: true, color: WHITE, align: "center" });
      T(s, when, { x: x + 0.35, y: 2.17, w: w - 0.5, h: 0.35, fontSize: 13, color: WHITE, align: "center" });
      T(s, "할 일", { x: x + 0.2, y: 2.85, w: 2, h: 0.3, fontSize: 12, bold: true, color: MUTED });
      T(s, todo.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < todo.length - 1 } })), { x: x + 0.2, y: 3.15, w: w - 0.35, h: 1.15, fontSize: 14, paraSpaceAfter: 4 });
      R(s, { x: x + 0.08, y: 4.4, w: w - 0.16, h: 2.1, fill: i === 3 ? NAVY : TINT });
      T(s, "목표", { x: x + 0.3, y: 4.55, w: 2, h: 0.3, fontSize: 12, bold: true, color: i === 3 ? "DDE3F0" : NAVY });
      goal.forEach((t, k) => T(s, t, { x: x + 0.3, y: 4.9 + k * 0.5, w: w - 0.5, h: 0.42, fontSize: 16, bold: true, color: i === 3 ? WHITE : INK }));
    });
    s.addNotes("단계별 목표입니다. 내년 2월까지 검증 단계에서 회원 700명과 교육 수강 20명, 상반기 수익화 단계에서 출강 연결 10건과 교육 매출 1,200만 원, 하반기 확장 단계에서 유료 강사 30명과 협력 기관 10곳을 목표로 합니다. 2028년에는 회원 2,000명, 협력 기관 30곳, 연간 연결 100건으로 영남권 전체로 넓힙니다.");
  }

  // ===== 19. 자금 소요 =====
  {
    const s = content("Q3 사업화 전략 · 자금 소요 (추정)", "MVP 제작비 2,000만 원 중 61%를 기능 개발과 지식재산에 씁니다", S3);
    const items = [["기능 개발", 800, "인증 배지, 결제, 기관 선택·추천 기능 고도화", "외주 견적 기준", HEX.navy], ["법률·지식재산", 420, "광고비 구조 자문, 특허 심사청구", "심사청구 약 220만 + 자문 200만", HEX.orange], ["교육 운영", 300, "데뷔 교육 교안·자료, 보조 강사비", "기수당 100만 원 × 3기", "5B6FA8"], ["마케팅", 300, "스레드·당근 광고, 기관 홍보물", "월 25만 원 × 12개월", "8FA0CC"], ["서버·운영", 180, "네이버 클라우드, 도메인, 알림 발송", "월 15만 원 × 12개월", "C3CCE3"]];
    s.addChart(pres.charts.DOUGHNUT, [{ name: "사업비", labels: items.map((d) => d[0]), values: items.map((d) => d[1]) }], {
      x: 0.6, y: 1.75, w: 4.4, h: 4.4, holeSize: 62, chartColors: items.map((d) => d[4]), showLegend: false, showPercent: true, showValue: false, showLabel: false,
      dataLabelColor: "FFFFFF", dataLabelFontSize: 12, dataLabelFontBold: true, dataBorder: { pt: 1.5, color: "FFFFFF" }, firstSliceAng: 0, objectName: oid("chart"), ...chartText,
    });
    T(s, [{ text: "총 사업비", options: { fontSize: 14, color: INK2, breakLine: true, bold: true } }, { text: "2,000", options: { fontSize: 34, bold: true, color: NAVY } }, { text: " 만 원", options: { fontSize: 15, bold: true, color: NAVY } }], { x: 1.3, y: 3.4, w: 3.0, h: 1.1, align: "center", valign: "middle" });
    T(s, "항목", { x: 5.6, y: 1.75, w: 2, h: 0.3, fontSize: 12, bold: true, color: MUTED });
    T(s, "금액", { x: 10.2, y: 1.75, w: 1.0, h: 0.3, fontSize: 12, bold: true, color: MUTED, align: "right" });
    T(s, "비율", { x: 11.6, y: 1.75, w: 1.1, h: 0.3, fontSize: 12, bold: true, color: MUTED, align: "right" });
    items.forEach(([n, v, use, basis, col], i) => {
      const y = 2.15 + i * 0.82;
      R(s, { x: 5.6, y: y + 0.12, w: 0.24, h: 0.24, fill: col, r: 0.05 });
      T(s, n, { x: 6.0, y: y + 0.02, w: 2.4, h: 0.4, fontSize: 15, bold: true });
      T(s, `${use} · ${basis}`, { x: 6.0, y: y + 0.4, w: 6.0, h: 0.3, fontSize: 11, color: INK2 });
      T(s, `${v.toLocaleString()}만 원`, { x: 9.4, y: y + 0.02, w: 1.8, h: 0.4, fontSize: 15, bold: true, align: "right" });
      T(s, `${Math.round((v / 2000) * 100)}%`, { x: 11.6, y: y + 0.02, w: 1.1, h: 0.4, fontSize: 15, bold: true, color: NAVY, align: "right" });
      L(s, 5.6, y + 0.77, 12.73, y + 0.77, { color: HEX.line, width: 0.75 });
    });
    R(s, { x: 5.6, y: 6.3, w: 7.13, h: 0.5, fill: TINT, r: 0.08 });
    T(s, "조달: MVP 제작비(최대 2,000만 원) + 자기자금 300만 원 + 교육 매출 재투자", { x: 5.8, y: 6.3, w: 6.8, h: 0.5, fontSize: 13, bold: true, color: NAVY, valign: "middle" });
    s.addNotes("MVP 제작비 2,000만 원은 기능 개발 800만 원, 법률·지식재산 420만 원, 교육 운영과 마케팅 각 300만 원, 서버·운영 180만 원으로 씁니다. 기능 개발과 특허 심사청구 등 지식재산에 61%를 배정했습니다. 여기에 자기자금 300만 원과 교육 매출을 재투자합니다.");
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

  // ===== 22. 성장 단계별 서비스 =====
  {
    const s = content("Q4 성장 전략 · 서비스 고도화", "강사 성장 단계마다 필요한 서비스를 붙여 나갑니다", S4);
    const stg = [["입문", "경력을 강의로"], ["첫 출강", "실적 만들기"], ["활동 강사", "꾸준한 일감·정산"], ["브랜드 강사", "나를 알리기"]];
    const cards = [[["데뷔 교육", "운영 중", "특강 → 실습 → 컨설팅"], ["교육 과정 확대", "확장", "분야별 수업 전환·자격증"]], [["인증 배지", "2027.2", "공공기관 강의·실적 시간"], ["강의 경력 증명", "고도화", "출강 이력 자동 기록·발급"]], [["맞춤 추천", "고도화", "조건에 맞춰 강사↔공고 추천"], ["서류 지갑", "고도화", "자격증·경력증명 직접 보관"], ["출강잇다", "잇다 시리즈", "출강별 강의료 입금 여부 확인"]], [["월간 강사", "잇다 시리즈", "매달 선정해 사이트·스레드에 소개"]]];
    const shades = ["8FA0CC", "5B6FA8", "2A4489", "163072"];
    const w = 3.0, g = 0.043;
    stg.forEach(([t, d], i) => {
      const x = 0.6 + i * (w + g);
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x, y: 1.7, w: w + 0.1, h: 0.95, fill: { color: shades[i] }, line: { type: "none" }, objectName: oid("chevron") });
      T(s, t, { x: x + 0.35, y: 1.74, w: w - 0.5, h: 0.45, fontSize: 18, bold: true, color: WHITE, align: "center" });
      T(s, d, { x: x + 0.35, y: 2.17, w: w - 0.5, h: 0.35, fontSize: 13, color: WHITE, align: "center" });
      cards[i].forEach(([n, tag, desc], k) => {
        const y = 2.85 + k * 1.25, itda = tag === "잇다 시리즈";
        R(s, { x: x + 0.08, y, w: w - 0.16, h: 1.08, fill: itda ? OTINT : BG, line: itda ? HEX.orange : undefined });
        T(s, n, { x: x + 0.3, y: y + 0.12, w: 1.6, h: 0.4, fontSize: 16, bold: true });
        const tw = Math.max(0.85, tag.length * 0.13 + 0.3);
        pill(s, tag, x + w - 0.25 - tw, y + 0.15, tw, 0.32, itda ? ORANGE : (tag === "운영 중" || tag === "2027.2" ? NAVY : MUTED), WHITE, 11);
        T(s, desc, { x: x + 0.3, y: y + 0.6, w: w - 0.55, h: 0.35, fontSize: 12, color: INK2 });
      });
    });
    source(s, "출강잇다: 강의료는 기관이 직접 지급하고, 강사잇다는 입금 내역만 보여 줌");
    s.addNotes("강사의 성장 단계에 맞춰 서비스를 붙입니다. 입문 단계의 데뷔 교육, 첫 출강 단계의 인증 배지와 경력 증명, 활동 강사를 위한 맞춤 추천과 서류 지갑, 그리고 잇다 시리즈인 출강잇다와 월간 강사입니다.");
  }

  // ===== 23. 시장 확대 =====
  {
    const s = content("Q4 성장 전략 · 고객·시장 확대", "부울경·경북 학교에서 시작해 전국 기업 교육까지 넓힙니다", S4);
    const st = [["1단계", "부울경·경북", "학교 (방과후·늘봄·돌봄)", "경력단절여성·시니어·경력 전환자"], ["2단계", "대구 포함 영남권", "평생학습관·지자체", "활동 강사 전체"], ["3단계", "전국", "기업 교육", "활동 강사 전체"]];
    const fills = [TINT, "8FA0CC", NAVY];
    const w = 3.95, g = 0.14, bottom = 6.55;
    st.forEach(([n, reg, field, who], i) => {
      const x = 0.6 + i * (w + g), h = 2.9 + i * 0.95, y = bottom - h, dark = i > 0;
      R(s, { x, y, w, h, fill: fills[i], r: 0.1 });
      const fg = dark ? WHITE : NAVY, fg2 = dark ? "F0F3FA" : INK;
      pill(s, n, x + 0.3, y + 0.3, 1.0, 0.38, dark ? WHITE : NAVY, dark ? NAVY : WHITE, 13);
      T(s, reg, { x: x + 0.3, y: y + 0.85, w: w - 0.6, h: 0.5, fontSize: 22, bold: true, color: fg });
      T(s, [{ text: "분야", options: { fontSize: 12, bold: true, color: dark ? "DDE3F0" : MUTED, breakLine: true } }, { text: field, options: { fontSize: 16, bold: true, color: fg2, breakLine: true } }, { text: " ", options: { fontSize: 8, breakLine: true } }, { text: "강사층", options: { fontSize: 12, bold: true, color: dark ? "DDE3F0" : MUTED, breakLine: true } }, { text: who, options: { fontSize: 16, bold: true, color: fg2 } }], { x: x + 0.3, y: y + 1.45, w: w - 0.6, h: 1.4 });
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
