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
const TAGS = { short: ["단기 · 현재", "E76310"], mid: ["중기", "5B6FA8"], long: ["장기", "163072"], all: ["전 단계", "4E5968"], entry: ["입구 · 무료", "8B95A1"] };
function content(kicker, title, section, tag) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(kicker, { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  if (tag) {
    const [t, f] = TAGS[tag];
    R(s, { x: 11.13, y: 0.34, w: 1.6, h: 0.34, fill: f, r: 0.17 });
    T(s, t, { x: 11.13, y: 0.34, w: 1.6, h: 0.34, fontSize: 11, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
  }
  return s;
}
const S0 = "시작", S1 = "Q1 문제 인식", S2 = "Q2 실현 가능성", S3 = "Q3 사업화 전략", S4 = "Q4 성장 전략";
function source(s, text) { T(s, text, { x: 0.6, y: 6.6, w: 12.13, h: 0.32, fontSize: 10, color: MUTED, valign: "bottom" }); }
const chartText = { catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt", titleFontFace: "+mn-lt" };

(async () => {
  // ##### cover
  pres.addSection({ title: S0 });
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: S0 });
    pill(s, "모두의 창업 2R 발표", 0.8, 1.85, 2.3, 0.44, ORANGE, WHITE, 14);
    s.addText("강사잇다", { placeholder: "title" });
    s.addText("강사의 첫 출강부터\n나만의 브랜드까지", { placeholder: "body" });
    T(s, "박서현 대표  ·  2026.11  ·  www.gangsaitda.com", { x: 0.8, y: 6.2, w: 7, h: 0.4, fontSize: 14, color: "C9D1E6" });
    const st = [["입문", 5.2, 1.4, "E76310"], ["1~5년차", 4.35, 2.25, "5B6FA8"], ["5년 이상", 3.5, 3.1, "2A4489"]];
    st.forEach(([t, top, h, col], i) => {
      const x = 8.3 + i * 1.5;
      Rect(s, { x, y: top, w: 1.42, h, fill: col });
      T(s, t, { x, y: top + 0.15, w: 1.42, h: 0.4, fontSize: 15, bold: true, color: WHITE, align: "center" });
    });
    T(s, "데뷔 → 역량강화 → 브랜딩", { x: 8.3, y: 6.7, w: 4.42, h: 0.35, fontSize: 13, bold: true, color: "C9D1E6", align: "center" });
    s.addNotes("안녕하십니까, 강사잇다 대표 박서현입니다. 강사잇다는 강사의 첫 출강부터 개인 브랜드까지, 경력 단계마다 필요한 문을 열어 주는 서비스입니다.");
  }

  // ##### story
  {
    const s = content("한눈에 보기", "강사가 성장하는 단계마다 필요한 문을 열어 줍니다", S0);
    const nd = [["입구 · 무료", "모든 강사", "공고 모음", "부울경·경북 공공 강사 공고를 한 화면에", "운영 중", BG, INK, INK2, INK2],
      ["단기 · 현재", "입문 강사", "강사 데뷔 프로그램", "온보딩: 특강 → 실습 → 컨설팅 → 출강 연결", "1기 운영", ORANGE, WHITE, "FFE9DA", WHITE],
      ["중기", "1~5년차 강사", "강사 역량강화 프로그램", "수료 시 민간자격증 발급", "준비", TINT, NAVY, INK2, NAVY],
      ["장기", "5년 이상 강사", "월간강사", "개인 브랜딩 · 사이트·스레드 홍보", "준비", NAVY, WHITE, "DDE3F0", WHITE]];
    const w = 2.83, g = 0.27;
    nd.forEach(([tag, who, prod, d, st, f, c1, c2, pc], i) => {
      const x = 0.6 + i * (w + g);
      R(s, { x, y: 1.75, w, h: 2.85, fill: f });
      T(s, tag, { x: x + 0.25, y: 1.95, w: w - 0.5, h: 0.3, fontSize: 12, bold: true, color: c2 });
      T(s, who, { x: x + 0.25, y: 2.3, w: w - 0.5, h: 0.45, fontSize: 20, bold: true, color: c1 });
      T(s, prod, { x: x + 0.25, y: 2.85, w: w - 0.5, h: 0.4, fontSize: 15, bold: true, color: c1 });
      T(s, d, { x: x + 0.25, y: 3.27, w: w - 0.5, h: 0.6, fontSize: 12, color: c2 });
      T(s, "● " + st, { x: x + 0.25, y: 4.08, w: w - 0.5, h: 0.32, fontSize: 12, bold: true, color: pc });
      if (i < 3) L(s, x + w + 0.03, 3.17, x + w + g - 0.03, 3.17, { color: HEX.muted, width: 1.5, arrow: true });
    });
    R(s, { x: 0.6, y: 4.9, w: 12.13, h: 1.4, fill: "FFFFFF", line: LINE });
    const k = [["실제 강의 연결", "3", "건"], ["유료 교육 결제", "10", "명"], ["회원 수", "500+", "명"], ["스레드 누적 조회", "19.1", "만"]];
    k.forEach(([lab, n, u], i) => {
      const x = 0.6 + i * 3.03;
      if (i) L(s, x, 5.15, x, 6.05, { color: HEX.line, width: 1 });
      T(s, lab, { x: x + 0.35, y: 5.08, w: 2.5, h: 0.32, fontSize: 13, bold: true, color: INK2 });
      T(s, [{ text: n, options: { fontSize: 32, bold: true, color: NAVY } }, { text: " " + u, options: { fontSize: 15, bold: true, color: NAVY } }], { x: x + 0.35, y: 5.42, w: 2.6, h: 0.7, valign: "middle" });
    });
    source(s, "2026.11.27 기준 누적 실적 (회원은 1R 당시 0명)");
    s.addNotes("강사잇다의 이야기를 한 줄로 말씀드리면, 무료 공고로 강사를 모으고, 입문 강사는 데뷔시키고, 1~5년차 강사는 역량을 키워 자격을 주고, 5년 이상 강사는 월간강사로 알립니다. 지금은 첫 단계인 입문 강사 온보딩에 집중하고 있고, 지금까지 실제 강의 연결 3건, 유료 교육 결제 10명을 만들었으며 회원은 1R 이후 0명에서 500명을 넘었습니다.");
  }

  pres.addSection({ title: S1 });
  // ===== 3. 착안 계기 =====
  {
    const s = content("Q1 문제 인식 (Problem) · 착안 계기", "7년간 강사로 일하며 직접 겪은 ‘일감 찾기’와 ‘첫 경력’의 벽", S1);
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

  // ##### stages-problem
  {
    const s = content("Q1 문제 인식 (Problem) · 강사가 겪는 어려움", "강사는 경력 단계마다 다른 벽에 막힙니다", S1);
    const cols = [["입문 강사", ORANGE, "첫 경력이 없어 지원조차 못 함", "40", "%", "첫 경력 쌓기가 가장 어려움", "강사잇다 강사 설문 (n=100, 2026.11)", "공고 60%를 놓친 경험 · ‘최근 3년 내 강의 경력 1년 이상’ 요구", "첫 실적"],
      ["1~5년차 강사", MID, "경력은 생겼지만 일감이 끊김", "54.6", "%", "정기적인 일감 없음", "서울시 프리랜서 1,000명 실태조사 (2018)", "다른 강사와 구별되는 역량과 이를 증명할 근거가 필요", "역량과 자격"],
      ["5년 이상 강사", NAVY, "실력은 있어도 알릴 통로가 없음", "1", "순위", "‘차별화·브랜드 마케팅’ 요구도", "강사 402명 조사 (김종현·엄우용, 2019)", "기관은 인맥·지인 추천에 의존 (기관 3곳 인터뷰)", "개인 브랜드"]];
    const w = 3.89, g = 0.23;
    cols.forEach(([who, col, wall, n, u, lab, src, ev, need], i) => {
      const x = 0.6 + i * (w + g);
      R(s, { x, y: 1.75, w, h: 4.45, fill: BG });
      R(s, { x, y: 1.75, w, h: 0.7, fill: col });
      Rect(s, { x, y: 2.25, w, h: 0.2, fill: col });
      T(s, who, { x: x + 0.3, y: 1.75, w: w - 0.6, h: 0.7, fontSize: 18, bold: true, color: WHITE, valign: "middle" });
      T(s, wall, { x: x + 0.3, y: 2.6, w: w - 0.6, h: 0.45, fontSize: 16, bold: true });
      T(s, [{ text: n, options: { fontSize: 40, bold: true, color: col } }, { text: " " + u, options: { fontSize: 18, bold: true, color: col } }], { x: x + 0.3, y: 3.1, w: w - 0.6, h: 0.75, valign: "middle" });
      T(s, lab, { x: x + 0.3, y: 3.85, w: w - 0.6, h: 0.32, fontSize: 13, bold: true });
      T(s, src, { x: x + 0.3, y: 4.17, w: w - 0.6, h: 0.3, fontSize: 10, color: MUTED });
      T(s, ev, { x: x + 0.3, y: 4.6, w: w - 0.6, h: 0.65, fontSize: 12, color: INK2 });
      R(s, { x: x + 0.3, y: 5.45, w: w - 0.6, h: 0.5, fill: "FFFFFF", r: 0.25 });
      T(s, [{ text: "필요한 것  ", options: { fontSize: 11, color: MUTED, bold: true } }, { text: need, options: { fontSize: 15, bold: true, color: col } }], { x: x + 0.3, y: 5.45, w: w - 0.6, h: 0.5, align: "center", valign: "middle" });
    });
    R(s, { x: 0.6, y: 6.3, w: 12.13, h: 0.42, fill: OTINT, r: 0.08 });
    T(s, "강사잇다는 이 세 가지를 경력 단계별 프로그램으로 채웁니다 (Q3 수익 모델)", { x: 0.85, y: 6.3, w: 11.7, h: 0.42, fontSize: 13, bold: true, valign: "middle" });
    s.addNotes("강사는 경력 단계마다 막히는 벽이 다릅니다. 입문 강사는 첫 경력이 없어 지원조차 못 합니다. 설문에서 40%가 첫 경력 쌓기를 가장 어려운 점으로 꼽았습니다. 1~5년차는 경력은 생겼지만 일감이 끊깁니다. 서울시 조사에서 54.6%가 정기적인 일감이 없다고 답했습니다. 5년 이상 강사는 실력이 있어도 알릴 통로가 없습니다. 강사 402명 조사에서 차별화·브랜드 마케팅이 요구도 1순위였습니다.");
  }

  // ===== 4. 문제 구조: 거울 구조(나비형) =====
  {
    const s = content("Q1 문제 인식 (Problem) · 해결하려는 문제", "강사와 기관이 서로를 찾지 못하는 구조", S1);
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

  // ===== 6. 목표 시장: 깔때기 =====
  {
    const s = content("Q1 문제 인식 (Problem) · 목표 고객과 시장", "부울경·경북 연 1만 건의 강사 공고부터 시작합니다", S1);
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
    const s = content("Q1 문제 인식 (Problem) · 기존 해결 방식의 한계", "기존 서비스에는 ‘실제 연결’이 비어 있습니다", S1);
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
    T(s, "강사잇다는 공고에서 출강까지 잇습니다", { x: 9.45, y: 2.05, w: 3.0, h: 0.8, fontSize: 18, bold: true, color: WHITE });
    ["공고 무료 제공", "데뷔 교육", "단계별 인증 배지", "기관 의뢰·직접 선택"].forEach((t, i) => {
      const y = 3.05 + i * 0.68;
      Oval(s, { x: 9.48, y: y + 0.08, w: 0.3, h: 0.3, fill: ORANGE });
      T(s, "✓", { x: 9.48, y: y + 0.08, w: 0.3, h: 0.3, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, t, { x: 9.95, y, w: 2.7, h: 0.46, fontSize: 15, bold: true, color: WHITE, valign: "middle" });
    });
    source(s, "출처: 서울시 보도자료(2018.4), timelyedu.kr, 각 서비스 홈페이지 직접 확인(2026.11.23), 양성 학원 가격은 기사·판매 페이지 기준");
    s.addNotes("공고 모음 서비스는 이미 강사인 사람에게만 유용하고, 양성 학원은 60만~298만 원의 교육을 팔지만 연결은 보장하지 않습니다. 강사와 학교를 연결하던 앱은 운영을 종료했습니다. 연결만으로는 지속이 어렵다는 뜻이고, 그래서 강사잇다는 교육과 인증, 연결을 함께 묶었습니다.");
  }

  pres.addSection({ title: S2 });
  // ##### done
  {
    const s = content("Q2 실현 가능성 (Solution) · 개발·운영 완료 사항", "온보딩에 필요한 기반은 이미 운영 중입니다", S2, "short");
    const it = [["2026.8", "직업정보제공사업 신고", "J1302020260003", "부산북부지청"], ["운영 중", "웹 서비스", "gangsaitda.com", "공고 자동 수집·정규화"], ["11.10", "특허 출원", "10-2026-0223988", "공고 수집·정규화·검증"], ["1R 이후", "기관 직접 선택", "기능 추가", "국내 서버 이전 완료"],
      ["10.26", "데뷔 교육 1기", "10명 결제", "입문 특강"], ["11.27", "실제 강의 연결", "3건", "출강 2건 · 면접 합격 1건"], ["11.27", "지원 가능 공고", "281건", "1R 당시 228건"], ["11.27", "회원", "500+명", "1R 당시 0명"]];
    const w = 2.83, g = 0.27, h = 1.95;
    it.forEach(([dt, t, big, sub], i) => {
      const x = 0.6 + (i % 4) * (w + g), y = 1.75 + Math.floor(i / 4) * (h + 0.2), row2 = i >= 4;
      R(s, { x, y, w, h, fill: row2 ? TINT : BG });
      Oval(s, { x: x + 0.25, y: y + 0.22, w: 0.36, h: 0.36, fill: row2 ? NAVY : HEX.ink2 });
      T(s, "✓", { x: x + 0.25, y: y + 0.22, w: 0.36, h: 0.36, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, dt, { x: x + w - 1.45, y: y + 0.22, w: 1.2, h: 0.36, fontSize: 12, bold: true, color: MUTED, align: "right", valign: "middle" });
      T(s, t, { x: x + 0.25, y: y + 0.72, w: w - 0.5, h: 0.36, fontSize: 15, bold: true });
      T(s, big, { x: x + 0.25, y: y + 1.07, w: w - 0.5, h: 0.48, fontSize: row2 ? 24 : 16, bold: true, color: NAVY, valign: "middle" });
      T(s, sub, { x: x + 0.25, y: y + 1.55, w: w - 0.5, h: 0.28, fontSize: 11, color: INK2 });
    });
        R(s, { x: 0.6, y: 6.05, w: 12.13, h: 0.55, fill: "FFFFFF", line: HEX.orange, lw: 1.5 });
    T(s, [{ text: "다음  ", options: { bold: true, color: ORANGE } }, { text: "12월 결제 연동 (토스페이먼츠)  →  2027.1 데뷔 교육 2기  →  2027.2~3 인증 배지 · 기관 파일럿" }], { x: 0.85, y: 6.05, w: 11.7, h: 0.55, fontSize: 14, bold: true, valign: "middle" });
    s.addNotes("실현 가능성은 이미 된 것부터 말씀드리겠습니다. 직업정보제공사업 신고, 웹 서비스 운영, 특허 출원, 기관 직접 선택 기능과 국내 서버 이전까지 마쳤습니다. 그 위에서 데뷔 교육 1기 10명이 결제했고, 실제 강의 연결 3건, 지원 가능 공고 281건, 회원 500명 이상이 나왔습니다. 다음은 12월 결제 연동, 1월 데뷔 교육 2기, 2~3월 인증 배지와 기관 파일럿입니다.");
  }

  // ===== 9. 공고 수집: 전/후 비교 =====
  {
    const s = content("Q2 실현 가능성 (Solution) · 공고 자동 수집", "흩어진 공공 강사 공고를 매일 모아 한 화면에 보여 줍니다", S2, "entry");
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
    const s = content("Q2 실현 가능성 (Solution) · 1R 심사 의견 반영", "1R 심사 의견 4가지를 모두 서비스에 반영했습니다", S2);
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

  // ===== 13. 연결 사례 + 성장 그래프 =====
  {
    const s = content("Q2 실현 가능성 (Solution) · 실제 연결 사례와 지표", "1R 이후 한 달: 회원 0 → 500+명, 스레드 조회 3.7배", S2, "short");
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
    const s = content("Q2 실현 가능성 (Solution) · 차별성", "데뷔 교육과 기관 연결을 함께 하는 서비스는 확인되지 않았습니다", S2);
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
    const s = content("Q2 실현 가능성 (Solution) · 대표 역량", "현장을 아는 강사이자 민간자격 발급 기관이 직접 운영합니다", S2);
    T(s, "대표의 경험", { x: 0.6, y: 1.7, w: 4.6, h: 0.35, fontSize: 14, bold: true, color: MUTED });
    T(s, "강사잇다에서 쓰이는 곳", { x: 7.55, y: 1.7, w: 5, h: 0.35, fontSize: 14, bold: true, color: MUTED });
    const m = [["7년", "프리랜서 강사 경력", "데뷔 프로그램 설계 · 기관이 원하는 강사상을 앎", "FaChalkboardUser"], ["1,000명", "강사 모임 직접 운영", "입문 강사 모집 채널", "FaUsers"], ["민간자격", "민간자격 발급 기관", "역량강화 수료자에게 자격 발급 (중기)", "FaAward"], ["학교", "취업·진로 캠프 사업자", "한국엑스퍼트교육원 학교 네트워크", "FaSchool"], ["1인 개발", "기획·개발·운영 직접", "특허 출원 · 서버 이전 직접 처리", "FaLaptopCode"]];
    for (let i = 0; i < 5; i++) {
      const y = 2.1 + i * 0.8, h = 0.68, cy = y + h / 2;
      R(s, { x: 0.6, y, w: 4.6, h, fill: BG });
      T(s, m[i][0], { x: 0.85, y, w: 1.65, h, fontSize: 20, bold: true, color: NAVY, valign: "middle" });
      T(s, m[i][1], { x: 2.5, y, w: 2.6, h, fontSize: 15, bold: true, valign: "middle" });
      L(s, 5.22, cy, 5.95, cy, { color: HEX.soft, width: 1.5 });
      await iconCircle(s, m[i][3], 6.0, cy - 0.3, 0.6, i === 2 ? HEX.orange : NAVY, "FFFFFF");
      L(s, 6.65, cy, 7.5, cy, { color: HEX.soft, width: 1.5, arrow: true });
      R(s, { x: 7.55, y, w: 5.18, h, fill: "FFFFFF", line: LINE });
      T(s, m[i][2], { x: 7.8, y, w: 4.8, h, fontSize: 15, bold: true, color: INK, valign: "middle" });
    }
    R(s, { x: 0.6, y: 6.2, w: 12.13, h: 0.45, fill: TINT });
    T(s, "MVP는 대표가 직접 개발해 운영 중이고, 고도화는 외주·개발자와 협업합니다", { x: 0.9, y: 6.2, w: 11.6, h: 0.45, fontSize: 15, bold: true, color: NAVY, valign: "middle" });
    s.addNotes("제 경험이 사업 어디에 쓰이는지 정리했습니다. 특히 저희는 민간자격 발급 기관이라, 중기의 역량강화 프로그램 수료자에게 자격증을 직접 발급할 수 있습니다. 7년 강사 경력으로 기관이 원하는 강사상을 알고, 1,000명 강사 모임은 초기 강사 확보 채널입니다. 캠프 사업으로 쌓은 학교 네트워크가 있고, 서비스는 제가 직접 개발해 특허 출원과 서버 이전까지 처리했습니다.");
  }

  // ##### revenue-model
  pres.addSection({ title: S3 });
  {
    const s = content("Q3 사업화 전략 (Business) · 수익 모델", "강사의 경력 단계별로 세 가지 수익원을 엽니다", S3, "all");
    const bl = [["단기 · 지금 진행", "입문 강사", "강사 데뷔 프로그램 (온보딩)", "입문 특강 → 프로필 실습 → 1:1 지원서 컨설팅 → 출강 연결", "입문 특강 1만 원부터\n온보딩 1인 30만 원 · 기수제", HEX.orange, 2.7],
      ["중기", "1~5년차 강사", "강사 역량강화 프로그램", "역량 강화 교육을 마치면 민간자격증 발급 (자체 발급 기관)", "교육비 + 자격 발급비\n(단가 설계 중)", HEX.mid, 2.2],
      ["장기", "5년 이상 강사", "월간강사 · 개인 브랜딩", "매달 강사를 선정해 사이트·스레드에 소개하는 홍보", "브랜딩·홍보 이용료\n(단가 설계 중)", HEX.navy, 1.7]];
    const w = 3.97, g = 0.11, bottom = 5.95;
    bl.forEach(([tag, who, prod, d, rev, col, top], i) => {
      const x = 0.6 + i * (w + g);
      s.addShape(pres.shapes.RECTANGLE, { x, y: top, w, h: bottom - top, fill: { color: col }, line: { type: "none" }, objectName: oid("step") });
      pill(s, tag, x + 0.25, top + 0.22, i === 0 ? 1.75 : 0.85, 0.34, WHITE, i === 0 ? ORANGE : (i === 1 ? MID : NAVY), 12);
      T(s, who, { x: x + 0.25, y: top + 0.68, w: w - 0.5, h: 0.48, fontSize: 21, bold: true, color: WHITE });
      T(s, prod, { x: x + 0.25, y: top + 1.15, w: w - 0.5, h: 0.38, fontSize: 15, bold: true, color: WHITE });
      T(s, d, { x: x + 0.25, y: top + 1.52, w: w - 0.5, h: 0.6, fontSize: 12, color: "F3F5FA" });
      R(s, { x: x + 0.25, y: bottom - 0.95, w: w - 0.5, h: 0.75, fill: "FFFFFF", r: 0.08 });
      T(s, rev, { x: x + 0.45, y: bottom - 0.95, w: w - 0.9, h: 0.75, fontSize: 13, bold: true, color: i === 0 ? ORANGE : NAVY, valign: "middle" });
    });
    R(s, { x: 0.6, y: 6.08, w: 12.13, h: 0.55, fill: BG, r: 0.08 });
    T(s, [{ text: "바탕  ", options: { bold: true, color: MUTED, fontSize: 12 } }, { text: "강사: 가입·공고 열람 무료", options: { bold: true } }, { text: "     기관: 섭외 의뢰 무료, 강의료는 기관이 강사에게 직접 지급 (성사 수수료 없음)", options: { color: INK2 } }], { x: 0.85, y: 6.08, w: 11.7, h: 0.55, fontSize: 13, valign: "middle" });
    s.addNotes("수익 모델은 강사의 경력 단계에 맞춰 세 갈래입니다. 지금은 입문 강사를 위한 강사 데뷔 프로그램, 즉 온보딩을 진행합니다. 입문 특강은 1만 원부터, 온보딩은 1인 30만 원입니다. 중기에는 1~5년차 강사를 위한 역량강화 프로그램을 열고, 저희가 민간자격 발급 기관이라 수료자에게 민간자격증을 발급합니다. 장기에는 5년 이상 강사를 월간강사로 선정해 개인 브랜딩과 홍보의 문을 열어 줍니다. 가입과 공고 열람, 기관의 섭외 의뢰는 무료이고 성사 수수료는 받지 않습니다.");
  }

  // ##### onboarding
  {
    const s = content("Q3 사업화 전략 (Business) · 단기 주력 상품", "지금은 입문 강사의 ‘데뷔’에 집중합니다", S3, "short");
    const st = [["입문 특강", "1만 원부터"], ["프로필 실습", "강사 프로필 작성"], ["1:1 지원서 컨설팅", "지원서 1:1 점검"], ["공고 지원·기관 연결", "281건 공고 · 기관 의뢰"], ["첫 출강", "실적이 쌓임"]];
    const xs = st.map((_, i) => 1.5 + i * 2.6), cy = 2.95;
    L(s, xs[0], cy, xs[4], cy, { color: HEX.soft, width: 4 });
    st.forEach(([t, d], i) => {
      const dd = i === 4 ? 1.0 : 0.85, last = i === 4;
      Oval(s, { x: xs[i] - dd / 2, y: cy - dd / 2, w: dd, h: dd, fill: last ? ORANGE : (i === 0 ? WHITE : NAVY), line: i === 0 ? HEX.navy : undefined, lw: 2.5 });
      T(s, String(i + 1), { x: xs[i] - dd / 2, y: cy - dd / 2, w: dd, h: dd, fontSize: 20, bold: true, color: i === 0 ? NAVY : WHITE, align: "center", valign: "middle" });
      T(s, t, { x: xs[i] - 1.2, y: cy + 0.6, w: 2.4, h: 0.38, fontSize: 15, bold: true, align: "center", color: last ? ORANGE : INK });
      T(s, d, { x: xs[i] - 1.2, y: cy + 0.98, w: 2.4, h: 0.3, fontSize: 12, color: INK2, align: "center" });
    });
    L(s, xs[1] - 0.45, 2.05, xs[4] + 0.5, 2.05, { color: HEX.orange, width: 2 });
    L(s, xs[1] - 0.45, 2.05, xs[1] - 0.45, 2.3, { color: HEX.orange, width: 2 });
    L(s, xs[4] + 0.5, 2.05, xs[4] + 0.5, 2.3, { color: HEX.orange, width: 2 });
    T(s, "온보딩 1인 30만 원 · 출강 2회 보장", { x: (xs[1] + xs[4]) / 2 - 2.5, y: 1.62, w: 5, h: 0.38, fontSize: 15, bold: true, color: ORANGE, align: "center" });
    const cards = [["운영 방식", "기수제", "2027년 연 3기 × 20명 (계획)", BG, NAVY], ["출강 2회 보장", "12개월", "수료 후 12개월 안에 연결이 안 되면 다음 기수 무료", BG, NAVY], ["1기 결과", "10명 → 2명", "10명 결제, 2명 출강·면접 합격 (60세 이상 강사 연결 1건 포함)", OTINT, ORANGE]];
    cards.forEach(([t, big, d, f, c], i) => {
      const x = 0.6 + i * 4.11, w = 3.91;
      R(s, { x, y: 4.65, w, h: 1.9, fill: f });
      T(s, t, { x: x + 0.3, y: 4.82, w: w - 0.6, h: 0.32, fontSize: 14, bold: true, color: INK2 });
      T(s, big, { x: x + 0.3, y: 5.12, w: w - 0.6, h: 0.6, fontSize: 26, bold: true, color: c, valign: "middle" });
      T(s, d, { x: x + 0.3, y: 5.75, w: w - 0.6, h: 0.65, fontSize: 12, color: INK2 });
    });
    s.addNotes("지금 집중하는 상품은 입문 강사를 위한 강사 데뷔 프로그램입니다. 1만 원부터 시작하는 입문 특강으로 들어와, 프로필 실습과 1:1 지원서 컨설팅을 거쳐 공고 지원과 기관 연결, 첫 출강까지 이어집니다. 온보딩은 1인 30만 원이고, 수료 후 12개월 안에 연결이 안 되면 다음 기수를 무료로 들을 수 있는 출강 2회 보장을 붙였습니다. 1기는 10명이 결제했고 그중 2명이 출강과 면접 합격으로 이어졌습니다.");
  }

  // ===== 17. 가격 근거 + 진입 경로 =====
  {
    const s = content("Q3 사업화 전략 (Business) · 가격 근거와 시장 진입", "강의 자리 하나면 교육비 30만 원의 2.5배 이상을 돌려받습니다", S3, "short");
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

  // ##### three-stage-plan
  {
    const s = content("Q3 사업화 전략 (Business) · 단계별 사업 계획", "단기 온보딩 → 중기 역량강화 → 장기 브랜딩 순서로 넓힙니다", S3, "all");
    const cols = [["단기 · 현재", "2026.12~2027.6", "입문 강사 · 강사 데뷔 프로그램", ["결제 연동 · 데뷔 교육 2·3기", "인증 배지 기준 확정", "인터뷰 기관 3곳 파일럿"], ["회원 700명 · 수강 20명", "출강 연결 10건", "교육 매출 1,200만 원"], HEX.orange],
      ["중기", "2027 하반기~", "1~5년차 · 역량강화 + 민간자격", ["역량강화 과정 개설", "수료자 민간자격증 발급", "출강 성공 수료생을 보조 강사로"], ["유료 강사 30명", "협력 기관 10곳 (부산·울산)"], HEX.mid],
      ["장기", "2028~", "5년 이상 · 월간강사 브랜딩", ["월간강사 선정·홍보", "경북·대구 → 영남권 확대", "기관 섭외 대행"], ["회원 2,000명", "협력 기관 30곳", "연간 연결 100건"], HEX.navy]];
    const w = 3.8, g = 0.365;
    cols.forEach(([tag, when, prod, todo, kpi, col], i) => {
      const x = 0.6 + i * (w + g);
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x, y: 1.72, w, h: 0.78, fill: { color: col }, line: { type: "none" }, objectName: oid("chev") });
      T(s, [{ text: tag + "  ", options: { bold: true, fontSize: 16 } }, { text: when, options: { fontSize: 12 } }], { x: x + (i ? 0.5 : 0.3), y: 1.72, w: w - 0.8, h: 0.78, color: WHITE, valign: "middle" });
      T(s, prod, { x, y: 2.65, w: w + 0.1, h: 0.4, fontSize: 15, bold: true, color: col === HEX.orange ? ORANGE : NAVY });
      T(s, "할 일", { x, y: 3.1, w: 2, h: 0.28, fontSize: 11, bold: true, color: MUTED });
      T(s, todo.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < todo.length - 1 } })), { x, y: 3.38, w: w, h: 1.1, fontSize: 13, paraSpaceAfter: 3 });
      R(s, { x, y: 4.65, w, h: 1.9, fill: i === 0 ? OTINT : (i === 1 ? TINT : NAVY) });
      T(s, "핵심 KPI", { x: x + 0.25, y: 4.8, w: 2, h: 0.28, fontSize: 11, bold: true, color: i === 2 ? "DDE3F0" : MUTED });
      T(s, kpi.map((t, k) => ({ text: t, options: { breakLine: k < kpi.length - 1 } })), { x: x + 0.25, y: 5.1, w: w - 0.45, h: 1.3, fontSize: 15, bold: true, color: i === 2 ? WHITE : INK, paraSpaceAfter: 4 });
    });
    source(s, "KPI는 사업계획서의 단계별 목표(추정)를 시기에 맞춰 배치함 · 단기 KPI는 2027 상반기까지");
    s.addNotes("사업은 세 단계로 넓힙니다. 단기에는 입문 강사 데뷔 프로그램으로 내년 상반기까지 출강 연결 10건과 교육 매출 1,200만 원을 만듭니다. 중기에는 1~5년차 강사를 위한 역량강화 과정을 열고 수료자에게 민간자격증을 발급하며, 출강에 성공한 수료생을 보조 강사로 세웁니다. 장기에는 5년 이상 강사를 월간강사로 알리고, 2028년 회원 2,000명, 협력 기관 30곳, 연간 연결 100건을 목표로 합니다.");
  }

  // ===== 19. 자금 소요: 트리맵 =====
  {
    const s = content("Q3 사업화 전략 (Business) · 자금 소요 (추정)", "MVP 제작비 2,000만 원 중 70%를 단기 온보딩에 씁니다", S3);
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
    const items = [["기능 개발", "결제 · 인증 배지 · 기관 선택·추천", "외주 견적 기준", "short"], ["교육 운영", "데뷔 교육 교안·자료, 보조 강사비", "기수당 100만 원 × 3기", "short"], ["마케팅", "입문 강사 모집 광고, 기관 홍보물", "월 25만 원 × 12개월", "short"], ["법률·지식재산", "특허 심사청구, 광고비 구조 자문", "약 220만 원 + 200만 원", "all"], ["서버·운영", "네이버 클라우드, 도메인, 알림 발송", "월 15만 원 × 12개월", "all"]];
    T(s, "어느 단계에 쓰이나", { x: 7.95, y: 1.75, w: 3, h: 0.3, fontSize: 12, bold: true, color: MUTED });
    items.forEach(([n, u, b, tg], i) => {
      const y = 2.05 + i * 0.8;
      const [tt, tf] = TAGS[tg];
      R(s, { x: 11.33, y: y + 0.02, w: 1.4, h: 0.3, fill: tf, r: 0.15 });
      T(s, tt, { x: 11.33, y: y + 0.02, w: 1.4, h: 0.3, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
      T(s, n, { x: 7.95, y, w: 3.3, h: 0.32, fontSize: 14, bold: true });
      T(s, `${u} · ${b}`, { x: 7.95, y: y + 0.32, w: 4.78, h: 0.42, fontSize: 11, color: INK2 });
    });
    R(s, { x: 7.95, y: 6.05, w: 4.78, h: 0.5, fill: TINT, r: 0.08 });
    T(s, "단기 1,400만 원 (70%) · 자기자금 300만 원 추가", { x: 8.1, y: 6.05, w: 4.55, h: 0.5, fontSize: 12, bold: true, color: NAVY, valign: "middle" });
    s.addNotes("상자 크기가 금액 비율이고, 오른쪽은 각 항목이 어느 단계에 쓰이는지입니다. 기능 개발, 교육 운영, 마케팅 1,400만 원, 즉 70%가 지금 진행하는 입문 강사 온보딩에 바로 쓰입니다. MVP 제작비 2,000만 원 중 기능 개발이 800만 원으로 가장 크고, 특허 심사청구와 광고비 구조 자문 등 법률·지식재산이 420만 원입니다. 둘을 합치면 61%입니다. 교육 운영과 마케팅에 각 300만 원, 서버·운영에 180만 원을 씁니다. 여기에 자기자금 300만 원과 교육 매출을 재투자합니다.");
  }

  // ===== 20. 매출 추정 =====
  {
    const s = content("Q3 사업화 전략 (Business) · 매출 추정 (추정)", "2027년 매출 약 2,160만 원, 83%를 입문 온보딩이 만듭니다", S3, "short");
    T(s, "2027년 매출 구성 (만 원)", { x: 0.6, y: 1.7, w: 6, h: 0.35, fontSize: 15, bold: true, color: INK2 });
    s.addChart(pres.charts.BAR, [
      { name: "입문 온보딩", labels: ["2027년"], values: [1800] },
      { name: "노출·광고비", labels: ["2027년"], values: [360] },
    ], {
      x: 0.5, y: 2.05, w: 12.3, h: 1.55, barDir: "bar", barGrouping: "stacked", barGapWidthPct: 30, chartColors: [HEX.navy, HEX.orange],
      showValue: false,
      catAxisHidden: true, valAxisHidden: true, valAxisMaxVal: 2160, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: true, legendPos: "b", legendFontSize: 12, legendColor: HEX.ink2, objectName: oid("chart"), ...chartText,
    });
    const cards = [["입문 온보딩 (데뷔 프로그램)", "60명 × 30만 원", "연 3기 × 20명", "1,800만 원", NAVY], ["노출·광고비", "30명 × 월 3만 원 × 4개월", "2027.9~12, 사업계획서 기준", "360만 원", ORANGE], ["합계", "2027년 매출 추정", "", "2,160만 원", INK]];
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

  pres.addSection({ title: S4 });
  // ===== 21. 중장기 목표 =====
  {
    const s = content("Q4 성장 전략 (Scale-up) · 중장기 목표", "영남권 기관이 강사를 찾을 때 가장 먼저 여는 곳이 되겠습니다", S4, "long");
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
    T(s, "입문 강사는 데뷔, 경력 강사는 자격과 브랜드까지. 기관에는 인증된 실적으로 강사를 찾는 창구", { x: 8.2, y: 5.6, w: 4.35, h: 0.9, fontSize: 12, color: INK, valign: "middle" });
    s.addNotes("중장기 목표는 영남권 기관이 강사를 찾을 때 가장 먼저 여는 곳이 되는 것입니다. 회원은 현재 500명에서 내년 2월 700명, 2028년 2,000명을 목표로 하고, 협력 기관 30곳과 연간 연결 100건을 만들겠습니다.");
  }

  // ===== 23. 시장 확대: 길어지는 화살표 =====
  {
    const s = content("Q4 성장 전략 (Scale-up) · 고객·시장 확대", "부울경·경북 학교에서 시작해 전국 기업 교육까지 넓힙니다", S4);
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
    const s = content("Q4 성장 전략 (Scale-up) · 필요한 자원", "인력·기관·제도, 확보 방향까지 정해 두었습니다", S4);
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

  // ##### closing
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: S4 });
    s.addText("감사합니다", { placeholder: "title" });
    s.addText("강사의 첫 출강부터\n나만의 브랜드까지, 강사잇다", { placeholder: "body" });
    T(s, "박서현 대표  ·  www.gangsaitda.com", { x: 0.8, y: 6.2, w: 7, h: 0.4, fontSize: 14, color: "C9D1E6" });
    const k = [["단기 · 지금", "입문 강사 데뷔 프로그램", "E76310"], ["중기", "1~5년차 역량강화 · 민간자격", "2A4489"], ["장기", "5년 이상 월간강사 브랜딩", "2A4489"]];
    k.forEach(([a, b, f], i) => {
      const y = 2.0 + i * 1.3;
      R(s, { x: 8.2, y, w: 4.5, h: 1.1, fill: f });
      T(s, a, { x: 8.45, y: y + 0.15, w: 4, h: 0.32, fontSize: 12, bold: true, color: i === 0 ? "FFE9DA" : "C9D1E6" });
      T(s, b, { x: 8.45, y: y + 0.48, w: 4.1, h: 0.45, fontSize: 17, bold: true, color: WHITE });
    });
    s.addNotes("정리하면, 강사잇다는 지금 입문 강사의 데뷔에 집중하고, 이어서 1~5년차 강사의 역량과 자격, 5년 이상 강사의 브랜드까지 단계별로 문을 열겠습니다. 감사합니다.");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
