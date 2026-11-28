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
  // ##### helpers
  const SP = "본 발표 (약 5분)", SA = "부록 · 예상 질문";
  const STEPS = ["① 정체성", "② 구조적 문제", "③ 제품 데모", "④ 트랙션", "⑤ BM·비용 앵커", "⑥ 확장·목표", "⑦ 팀", "⑧ 클로징"];
  function pitch(step, extra, title) {
    const s = content(`${STEPS[step]}${extra ? " · " + extra : ""}`, title, SP);
    for (let i = 0; i < 8; i++) {
      const x = 9.95 + i * 0.35, cur = i === step;
      Oval(s, { x, y: 0.44, w: 0.17, h: 0.17, fill: cur ? ORANGE : (i < step ? NAVY : "FFFFFF"), line: cur || i < step ? undefined : HEX.line, lw: 1 });
    }
    return s;
  }
  function appx(code, title) { return content(`부록 ${code} · 예상 질문`, title, SA); }

  // ##### p1-identity
  pres.addSection({ title: SP });
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: SP });
    pill(s, "① 정체성 · 0:00~0:10", 0.8, 1.85, 2.5, 0.44, ORANGE, WHITE, 13);
    s.addText("강사잇다", { placeholder: "title" });
    s.addText("경력을 강의로 바꿔 주는\n강사 데뷔 플랫폼", { placeholder: "body" });
    T(s, "대표 박서현  ·  www.gangsaitda.com  ·  모두의 창업 2R", { x: 0.8, y: 6.2, w: 7, h: 0.4, fontSize: 14, color: "C9D1E6" });
    const st = [["입문", 5.2, 1.4, "E76310"], ["1~5년차", 4.35, 2.25, "5B6FA8"], ["5년 이상", 3.5, 3.1, "2A4489"]];
    st.forEach(([t, top, h, col], i) => {
      const x = 8.3 + i * 1.5;
      Rect(s, { x, y: top, w: 1.42, h, fill: col });
      T(s, t, { x, y: top + 0.15, w: 1.42, h: 0.4, fontSize: 15, bold: true, color: WHITE, align: "center" });
    });
    T(s, "데뷔 → 역량강화 → 브랜딩", { x: 8.3, y: 6.7, w: 4.42, h: 0.35, fontSize: 13, bold: true, color: "C9D1E6", align: "center" });
    s.addNotes("[0:00~0:10] 안녕하십니까. 경력을 강의로 바꿔 주는 강사 데뷔 플랫폼, 강사잇다의 대표 박서현입니다.");
  }

  // ##### p2-scene
  {
    const s = pitch(1, "장면 · 0:10~0:50", "오늘 강사를 시작한다면, 첫 공고에서 막힙니다");
    const st = [["FaMagnifyingGlass", "1. 공고를 찾는다", "60", "%", "공고를 놓친 경험", "교육청·구청·평생교육원·학교에 흩어진 공고를 매일 따로 확인", ORANGE, HEX.orange],
      ["FaLock", "2. 지원하려 한다", "40", "%", "첫 경력 쌓기가 가장 어려움", "공고 자격: ‘최근 3년 내 강의 경력 1년 이상’", ORANGE, HEX.orange],
      ["FaSchool", "3. 기관은 아는 강사를 부른다", "3곳", " 모두", "인맥·지인 추천에 의존", "“1분 영상으로는 판단이 어렵다” (기관 인터뷰)", NAVY, HEX.navy]];
    const w = 3.83, g = 0.32;
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * (w + g), [ic, t, n, u, lab, d, col, hx] = st[i];
      R(s, { x, y: 1.75, w, h: 3.75, fill: BG });
      await iconCircle(s, ic, x + 0.3, 2.0, 0.62, "FFFFFF", hx);
      T(s, t, { x: x + 1.05, y: 2.0, w: w - 1.25, h: 0.62, fontSize: 16, bold: true, valign: "middle" });
      T(s, [{ text: n, options: { fontSize: 44, bold: true, color: col } }, { text: u, options: { fontSize: 20, bold: true, color: col } }], { x: x + 0.3, y: 2.85, w: w - 0.6, h: 0.85, valign: "middle" });
      T(s, lab, { x: x + 0.3, y: 3.72, w: w - 0.6, h: 0.35, fontSize: 15, bold: true });
      T(s, d, { x: x + 0.3, y: 4.15, w: w - 0.6, h: 0.75, fontSize: 12, color: INK2 });
      if (i < 2) L(s, x + w + 0.04, 3.6, x + w + g - 0.04, 3.6, { color: HEX.muted, width: 2, arrow: true });
    }
    R(s, { x: 0.6, y: 5.7, w: 12.13, h: 0.8, fill: NAVY, r: 0.1 });
    T(s, [{ text: "강사 모임 1,000명에게서 매일 듣는 말   ", options: { fontSize: 13, color: "C9D1E6", bold: true } }, { text: "“공고를 못 봤어요”  “경력이 없어 지원조차 못 해요”", options: { fontSize: 18, bold: true, color: WHITE } }], { x: 0.9, y: 5.7, w: 11.6, h: 0.8, valign: "middle" });
    source(s, "출처: 강사잇다 강사 설문 (n=100, 2026.11), 기관 3곳 인터뷰, 부산 남구청 공지(2026.7.8)·서대문구청 공고(2025.12.18)");
    s.addNotes("[0:10~0:50] 여러분이 오늘 강사를 시작한다고 상상해 보십시오. 먼저 공고를 찾아야 합니다. 공고는 교육청, 구청, 평생교육원, 학교에 흩어져 있어서 강사 60%가 공고를 놓친 적이 있습니다. 겨우 찾아 지원하려 하면 '최근 3년 내 강의 경력 1년 이상'을 요구합니다. 40%가 첫 경력 쌓기를 가장 어렵다고 답했습니다. 기관은 어떨까요? 저희가 만난 기관 3곳 모두 인맥과 지인 추천으로 강사를 찾았습니다. 그래서 새 강사는 들어갈 문이 없습니다.");
  }

  // ===== 6. 목표 시장: 깔때기 =====
  {
    const s = pitch(1, "시장 · 0:50~1:30", "연 9,557억 원 시장, 부울경·경북 1만 건에서 시작합니다");
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
    s.addNotes("[0:50~1:30] 방과후 강사 7.4만 명에게 지급되는 금액만 연 9,557억 원입니다. 저희는 그중 부울경·경북 공공기관에서 나오는 연 약 1만 건의 강사 공고를 목표 시장으로 잡았고, 이미 모인 회원 500명 이상이 초기 고객입니다. 경력을 강의로 바꾸려는 부울경 경력단절여성만 16.5만 명입니다.");
  }

  // ##### p4-demo
  {
    const s = pitch(2, "1:30~2:45", "공고 찾기부터 첫 출강까지, 강사잇다에서 이렇게 이어집니다");
    const fr = [["① 공고 한 화면", "지원 가능 공고 281건, 지역·마감일 필터", "무료"], ["② 입문 특강 신청", "1만 원부터, 데뷔 프로그램의 입구", "강사"], ["③ 프로필·지원서 1:1", "강사 프로필 작성, 지원서 1:1 점검", "강사"], ["④ 기관이 직접 선택", "섭외 의뢰 접수, 프로필 보고 선택", "기관 무료"]];
    const w = 2.83, g = 0.27, y = 1.75, h = 3.1;
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * (w + g);
      R(s, { x, y, w, h, fill: "FFFFFF", line: LINE, shadow: true, r: 0.1 });
      Rect(s, { x: x + 0.02, y: y + 0.02, w: w - 0.04, h: 0.3, fill: BG });
      [0, 1, 2].forEach((k) => Oval(s, { x: x + 0.15 + k * 0.17, y: y + 0.11, w: 0.1, h: 0.1, fill: HEX.line }));
      const ix = x + 0.25, iw = w - 0.5;
      if (i === 0) {
        T(s, [{ text: "281", options: { fontSize: 26, bold: true, color: NAVY } }, { text: " 건", options: { fontSize: 13, bold: true, color: NAVY } }], { x: ix, y: y + 0.45, w: iw, h: 0.5, valign: "middle" });
        ["부산", "경남", "마감 임박"].forEach((t, k) => pill(s, t, ix + k * 0.78, y + 1.02, k === 2 ? 0.9 : 0.68, 0.28, k === 0 ? NAVY : TINT, k === 0 ? WHITE : NAVY, 10));
        [0, 1, 2].forEach((k) => { R(s, { x: ix, y: y + 1.48 + k * 0.48, w: iw, h: 0.38, fill: BG, r: 0.06 }); Rect(s, { x: ix + 0.12, y: y + 1.6 + k * 0.48, w: iw * 0.55, h: 0.08, fill: HEX.soft }); Rect(s, { x: ix + 0.12, y: y + 1.74 + k * 0.48, w: iw * 0.35, h: 0.06, fill: HEX.line }); });
      } else if (i === 1) {
        T(s, "강사 입문 특강", { x: ix, y: y + 0.5, w: iw, h: 0.4, fontSize: 15, bold: true });
        T(s, "1만 원부터", { x: ix, y: y + 0.9, w: iw, h: 0.3, fontSize: 12, color: INK2 });
        [0, 1, 2].forEach((k) => Rect(s, { x: ix, y: y + 1.4 + k * 0.22, w: iw * (0.9 - k * 0.2), h: 0.08, fill: HEX.line }));
        pill(s, "신청하기", ix, y + 2.25, iw, 0.42, ORANGE, WHITE, 13);
      } else if (i === 2) {
        Oval(s, { x: ix, y: y + 0.5, w: 0.55, h: 0.55, fill: TINT });
        Rect(s, { x: ix + 0.7, y: y + 0.6, w: iw - 0.8, h: 0.1, fill: HEX.soft });
        Rect(s, { x: ix + 0.7, y: y + 0.8, w: (iw - 0.8) * 0.6, h: 0.08, fill: HEX.line });
        ["강의 경력", "강사 소개", "지원서 1:1 점검"].forEach((t, k) => {
          Oval(s, { x: ix, y: y + 1.35 + k * 0.42, w: 0.22, h: 0.22, fill: k === 2 ? ORANGE : NAVY });
          T(s, "✓", { x: ix, y: y + 1.35 + k * 0.42, w: 0.22, h: 0.22, fontSize: 9, bold: true, color: WHITE, align: "center", valign: "middle" });
          T(s, t, { x: ix + 0.32, y: y + 1.31 + k * 0.42, w: iw - 0.3, h: 0.3, fontSize: 12, bold: k === 2, color: k === 2 ? ORANGE : INK });
        });
      } else {
        T(s, "섭외 의뢰서", { x: ix, y: y + 0.5, w: iw, h: 0.4, fontSize: 15, bold: true });
        [0, 1].forEach((k) => { R(s, { x: ix, y: y + 1.0 + k * 0.6, w: iw, h: 0.5, fill: BG, r: 0.06 }); Oval(s, { x: ix + 0.1, y: y + 1.1 + k * 0.6, w: 0.3, h: 0.3, fill: TINT }); Rect(s, { x: ix + 0.5, y: y + 1.17 + k * 0.6, w: iw * 0.5, h: 0.08, fill: HEX.soft }); });
        pill(s, "이 강사 선택", ix, y + 2.25, iw, 0.42, NAVY, WHITE, 13);
      }
      T(s, fr[i][0], { x, y: y + h + 0.15, w, h: 0.38, fontSize: 16, bold: true });
      T(s, fr[i][1], { x, y: y + h + 0.52, w, h: 0.32, fontSize: 12, color: INK2 });
      if (i < 3) L(s, x + w + 0.04, y + h / 2, x + w + g - 0.04, y + h / 2, { color: HEX.orange, width: 2, arrow: true });
    }
    R(s, { x: 0.6, y: 6.0, w: 12.13, h: 0.55, fill: OTINT, r: 0.08 });
    T(s, [{ text: "강사는 가입 없이 공고를 보고, 기관은 무료로 의뢰합니다", options: { bold: true } }, { text: "   ·   강의료는 기관이 강사에게 직접 지급 (성사 수수료 없음)", options: { color: INK2 } }], { x: 0.85, y: 6.0, w: 11.7, h: 0.55, fontSize: 14, valign: "middle" });
    source(s, "화면 구성도 · 발표 때는 실제 화면(공고 목록, 입문 특강, 섭외 의뢰)으로 시연");
    s.addNotes("[1:30~2:45] 실제 화면으로 보여 드리겠습니다. 첫째, 강사는 가입하지 않아도 부울경·경북 공공 강사 공고 281건을 한 화면에서 지역과 마감일로 찾습니다. 둘째, 첫 출강이 급한 강사는 1만 원부터 시작하는 입문 특강을 신청합니다. 셋째, 데뷔 프로그램에서 강사 프로필을 만들고 지원서를 1:1로 점검받습니다. 넷째, 기관은 섭외 의뢰서를 무료로 올리고, 강사 프로필을 보고 직접 고릅니다. 강의료는 기관이 강사에게 바로 지급하고, 저희는 수수료를 받지 않습니다.");
  }

  // ##### p5-traction
  {
    const s = pitch(3, "2:45~3:30", "모두의 창업 1R 이후 한 달, 회원 0명 → 500명");
    R(s, { x: 0.6, y: 1.75, w: 5.6, h: 3.75, fill: NAVY });
    T(s, "회원 수", { x: 0.95, y: 2.0, w: 4, h: 0.4, fontSize: 16, bold: true, color: "C9D1E6" });
    T(s, [{ text: "0", options: { fontSize: 40, bold: true, color: "8FA0CC" } }, { text: "  →  ", options: { fontSize: 28, bold: true, color: "C9D1E6" } }, { text: "500+", options: { fontSize: 72, bold: true, color: WHITE } }, { text: " 명", options: { fontSize: 24, bold: true, color: WHITE } }], { x: 0.95, y: 2.55, w: 5.1, h: 1.5, valign: "middle" });
    T(s, "1R(2026.10 말) 당시 → 2026.11.27", { x: 0.95, y: 4.2, w: 5, h: 0.35, fontSize: 13, color: "C9D1E6" });
    T(s, "실제 강의 연결 0건 → 3건", { x: 0.95, y: 4.7, w: 5, h: 0.45, fontSize: 18, bold: true, color: "FFB98A" });
    const rows = [["스레드 누적 조회", "5.1만", "19.1만", "3.7배"], ["스레드 팔로워", "296명", "600명", "2배"], ["지원 가능 공고", "228건", "281건", "+53건"], ["당근모임", "193명", "260명", "+67명"]];
    rows.forEach(([lab, a, b, d], i) => {
      const y = 1.75 + i * 0.95;
      R(s, { x: 6.5, y, w: 6.23, h: 0.8, fill: BG });
      T(s, lab, { x: 6.75, y, w: 2.0, h: 0.8, fontSize: 14, bold: true, color: INK2, valign: "middle" });
      T(s, [{ text: a + "  →  ", options: { fontSize: 15, bold: true, color: MUTED } }, { text: b, options: { fontSize: 22, bold: true, color: NAVY } }], { x: 8.75, y, w: 2.6, h: 0.8, valign: "middle" });
      pill(s, d, 11.45, y + 0.22, 1.05, 0.36, i === 0 ? ORANGE : TINT, i === 0 ? WHITE : NAVY, 12);
    });
    R(s, { x: 0.6, y: 5.7, w: 12.13, h: 0.8, fill: OTINT, r: 0.1 });
    T(s, [{ text: "누적  ", options: { bold: true, color: ORANGE } }, { text: "유료 교육 결제 10명  ·  1기 10명 중 2명 출강·면접 합격  ·  학원 원장 첫 출강  ·  60세 이상 강사 연결 1건", options: { bold: true } }], { x: 0.85, y: 5.7, w: 11.7, h: 0.8, fontSize: 14, valign: "middle" });
    s.addNotes("[2:45~3:30] 모두의 창업 1R 이후 한 달 동안 무엇이 달라졌는지 말씀드리겠습니다. 1R 당시 0명이던 회원이 500명을 넘었고, 1R에서 지적받은 실제 매칭 성과는 0건에서 3건이 되었습니다. 스레드 누적 조회는 5.1만에서 19.1만으로 3.7배가 되었습니다. 지금까지 유료 교육 결제 10명, 1기 10명 중 2명이 출강과 면접 합격으로 이어졌고, 학원 원장님이 특성화고 영어 강사로 첫 출강을 했습니다.");
  }

  // ##### p6-bm
  {
    const s = pitch(4, "3:30~4:00", "학원 60만~298만 원 대신, 30만 원에 출강 2회 보장");
    const x0 = 3.3, x1 = 12.3, k = (x1 - x0) / 300, X = (v) => x0 + v * k;
    [0, 100, 200, 300].forEach((v) => { L(s, X(v), 1.85, X(v), 4.55, { color: HEX.line, width: 0.75 }); T(s, `${v}만`, { x: X(v) - 0.4, y: 4.6, w: 0.8, h: 0.28, fontSize: 11, color: MUTED, align: "center" }); });
    const rows = [["강사 양성 학원", "기존 대안", 60, 298, HEX.muted, "60만~298만 원 · 공고·기관 연결 보장 없음", INK2], ["강사잇다 온보딩", "데뷔 프로그램", 0, 30, HEX.orange, "30만 원 · 출강 2회 보장", ORANGE], ["한 학기 강의료", "첫 자리 하나", 75, 105, HEX.navy, "75만~105만 원 (주 1회 × 15주) → 교육비 2.5배 이상 회수", NAVY]];
    rows.forEach(([n, sub, a, b, col, lab, lc], i) => {
      const y = 2.0 + i * 0.85;
      T(s, n, { x: 0.6, y, w: 2.6, h: 0.35, fontSize: 15, bold: true, color: i === 1 ? ORANGE : INK });
      T(s, sub, { x: 0.6, y: y + 0.33, w: 2.6, h: 0.28, fontSize: 11, color: MUTED });
      R(s, { x: X(a), y: y + 0.08, w: Math.max(0.15, X(b) - X(a)), h: 0.42, fill: col, r: 0.08 });
      const lx = i === 0 ? X(a) + 0.15 : X(b) + 0.15;
      T(s, lab, { x: lx, y: y + 0.08, w: 7.5, h: 0.42, fontSize: 13, bold: true, color: i === 0 ? WHITE : lc, valign: "middle" });
    });
    const tiers = [["단기 · 지금", "입문 강사", "강사 데뷔 프로그램 · 1인 30만 원", ORANGE, OTINT], ["중기", "1~5년차 강사", "역량강화 + 민간자격증 발급", NAVY, TINT], ["장기", "5년 이상 강사", "월간강사 개인 브랜딩·홍보", NAVY, TINT]];
    tiers.forEach(([tg, who, prod, c, f], i) => {
      const x = 0.6 + i * 4.11, w = 3.91;
      R(s, { x, y: 5.05, w, h: 1.0, fill: f });
      T(s, [{ text: tg + "   ", options: { fontSize: 11, bold: true, color: c } }, { text: who, options: { fontSize: 15, bold: true } }], { x: x + 0.25, y: 5.12, w: w - 0.5, h: 0.4, valign: "middle" });
      T(s, prod, { x: x + 0.25, y: 5.52, w: w - 0.5, h: 0.4, fontSize: 13, color: INK2 });
    });
    T(s, "가입·공고 열람 무료 · 기관 의뢰 무료 · 성사 수수료 없음 · 중기·장기 단가는 설계 중", { x: 0.6, y: 6.15, w: 12.13, h: 0.35, fontSize: 12, bold: true, color: INK2 });
    s.addNotes("[3:30~4:00] 강사 양성 학원은 60만에서 298만 원을 받지만 공고나 기관 연결은 보장하지 않습니다. 강사잇다 데뷔 프로그램은 30만 원이고, 수료 후 12개월 안에 연결이 안 되면 다음 기수를 무료로 듣는 출강 2회 보장을 붙였습니다. 한 학기 강의 자리 하나면 75만에서 105만 원이라, 교육비의 2.5배 이상을 돌려받습니다. 이후 1~5년차 강사에게는 역량강화와 민간자격증을, 5년 이상 강사에게는 월간강사 브랜딩을 엽니다.");
  }

  // ##### p7-scale
  {
    const s = pitch(5, "4:00~4:30", "3단계로 넓혀 2027년 매출 2,160만 원을 만듭니다");
    const cols = [["단기 · 현재", "2026.12~2027.6", "입문 강사 · 데뷔 프로그램", ["회원 700명 · 수강 20명", "출강 연결 10건", "교육 매출 1,200만 원"], HEX.orange],
      ["중기", "2027 하반기~", "1~5년차 · 역량강화 + 민간자격", ["유료 강사 30명", "협력 기관 10곳"], HEX.mid],
      ["장기", "2028~", "5년 이상 · 월간강사 브랜딩", ["회원 2,000명 · 기관 30곳", "연간 연결 100건"], HEX.navy]];
    const w = 3.8, g = 0.365;
    cols.forEach(([tag, when, prod, kpi, col], i) => {
      const x = 0.6 + i * (w + g);
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x, y: 1.72, w, h: 0.72, fill: { color: col }, line: { type: "none" }, objectName: oid("chev") });
      T(s, [{ text: tag + "  ", options: { bold: true, fontSize: 15 } }, { text: when, options: { fontSize: 12 } }], { x: x + (i ? 0.5 : 0.3), y: 1.72, w: w - 0.8, h: 0.72, color: WHITE, valign: "middle" });
      T(s, prod, { x, y: 2.58, w, h: 0.38, fontSize: 15, bold: true, color: i === 0 ? ORANGE : NAVY });
      T(s, kpi.map((t, k2) => ({ text: t, options: { breakLine: k2 < kpi.length - 1 } })), { x, y: 3.0, w, h: 1.05, fontSize: 14, color: INK, paraSpaceAfter: 3 });
    });
    R(s, { x: 0.6, y: 4.35, w: 5.9, h: 2.2, fill: BG });
    T(s, "2027년 매출 (추정)", { x: 0.9, y: 4.5, w: 4, h: 0.35, fontSize: 14, bold: true, color: INK2 });
    T(s, [{ text: "2,160", options: { fontSize: 40, bold: true, color: NAVY } }, { text: " 만 원", options: { fontSize: 18, bold: true, color: NAVY } }], { x: 0.9, y: 4.85, w: 5, h: 0.8, valign: "middle" });
    const bw = 5.3, sx = 0.9;
    R(s, { x: sx, y: 5.75, w: bw * 1800 / 2160, h: 0.35, fill: NAVY, r: 0.05 });
    R(s, { x: sx + bw * 1800 / 2160 + 0.03, y: 5.75, w: bw * 360 / 2160 - 0.03, h: 0.35, fill: ORANGE, r: 0.05 });
    T(s, "입문 온보딩 1,800만 (60명 × 30만)", { x: sx, y: 6.13, w: 4, h: 0.3, fontSize: 11, color: INK2 });
    T(s, "노출·광고비 360만", { x: sx + 3.4, y: 6.13, w: 1.9, h: 0.3, fontSize: 11, color: ORANGE, align: "right" });
    R(s, { x: 6.83, y: 4.35, w: 5.9, h: 2.2, fill: "FFFFFF", line: LINE });
    T(s, "지역 확장 순서", { x: 7.1, y: 4.5, w: 3, h: 0.35, fontSize: 14, bold: true, color: INK2 });
    pill(s, "신학기 1~3월 집중", 10.85, 4.5, 1.65, 0.34, OTINT, ORANGE, 11);
    const rg = ["경남", "부산", "울산", "경북·대구", "전국"];
    L(s, 7.4, 5.4, 12.1, 5.4, { color: HEX.soft, width: 3 });
    rg.forEach((t, i) => {
      const cx = 7.4 + i * 1.175, d = 0.42;
      Oval(s, { x: cx - d / 2, y: 5.4 - d / 2, w: d, h: d, fill: i === 0 ? ORANGE : (i === 4 ? WHITE : NAVY), line: i === 4 ? HEX.navy : undefined, lw: 2 });
      T(s, String(i + 1), { x: cx - d / 2, y: 5.4 - d / 2, w: d, h: d, fontSize: 12, bold: true, color: i === 4 ? NAVY : WHITE, align: "center", valign: "middle" });
      T(s, t, { x: cx - 0.7, y: 5.72, w: 1.4, h: 0.32, fontSize: 12, bold: true, color: i === 0 ? ORANGE : INK, align: "center" });
    });
    s.addNotes("[4:00~4:30] 확장은 세 단계입니다. 내년 상반기까지 입문 강사 데뷔 프로그램으로 출강 연결 10건과 교육 매출 1,200만 원, 하반기부터 1~5년차 역량강화와 민간자격, 2028년부터 5년 이상 강사의 월간강사 브랜딩을 엽니다. 2027년 매출은 약 2,160만 원으로 잡았고, 경남에서 시작해 부산, 울산, 경북·대구, 전국 순서로 넓힙니다.");
  }

  // ##### p8-team
  {
    const s = pitch(6, "4:30~5:00", "7년 차 강사가 직접 겪은 문제를, 직접 만들어 풀고 있습니다");
    R(s, { x: 0.6, y: 1.75, w: 4.6, h: 4.8, fill: NAVY });
    T(s, "“", { x: 0.85, y: 1.85, w: 1, h: 0.9, fontSize: 60, bold: true, color: ORANGE });
    T(s, "7년 동안 공고 사이트를 매일 뒤졌습니다.\n강사 모임 1,000명에게서 같은 고민을 들었습니다.\n그래서 직접 만들었습니다.", { x: 0.95, y: 2.75, w: 4.0, h: 2.2, fontSize: 17, bold: true, color: WHITE, paraSpaceAfter: 8 });
    T(s, "박서현 대표", { x: 0.95, y: 5.7, w: 4, h: 0.4, fontSize: 14, bold: true, color: "C9D1E6" });
    const ev = [["FaChalkboardUser", "7년", "프리랜서 강사 경력", "데뷔 프로그램 설계, 기관이 원하는 강사상을 앎"], ["FaUsers", "1,000명", "강사 모임 직접 운영", "입문 강사 모집 채널"], ["FaAward", "민간자격", "민간자격 발급 기관", "중기 역량강화 수료자에게 자격 발급"], ["FaSchool", "학교", "취업·진로 캠프 사업자", "한국엑스퍼트교육원 학교 네트워크"], ["FaLaptopCode", "1인 개발", "기획·개발·운영 직접", "특허 출원 · 국내 서버 이전 직접 처리"]];
    for (let i = 0; i < 5; i++) {
      const y = 1.75 + i * 0.98;
      R(s, { x: 5.5, y, w: 7.23, h: 0.84, fill: BG });
      await iconCircle(s, ev[i][0], 5.7, y + 0.15, 0.54, i === 2 ? HEX.orange : NAVY, "FFFFFF");
      T(s, ev[i][1], { x: 6.4, y, w: 1.55, h: 0.84, fontSize: 19, bold: true, color: NAVY, valign: "middle" });
      T(s, ev[i][2], { x: 7.95, y: y + 0.1, w: 4.6, h: 0.34, fontSize: 14, bold: true });
      T(s, ev[i][3], { x: 7.95, y: y + 0.44, w: 4.6, h: 0.3, fontSize: 12, color: INK2 });
    }
    s.addNotes("[4:30~5:00] 저는 7년 동안 프리랜서 강사로 일하며 공고 사이트를 매일 뒤졌고, 제가 운영하는 강사 모임 1,000명에게서 같은 고민을 들었습니다. 그래서 직접 만들었습니다. 서비스는 제가 직접 개발해 특허 출원과 서버 이전까지 처리했고, 저희는 민간자격 발급 기관이라 중기 역량강화 과정의 자격증도 직접 발급합니다. 취업·진로 캠프 사업으로 쌓은 학교 네트워크도 있습니다.");
  }

  // ##### p9-closing
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: SP });
    pill(s, "⑧ 클로징 · 5:00~5:15", 0.8, 1.85, 2.5, 0.44, ORANGE, WHITE, 13);
    s.addText("첫 출강을 잇다", { placeholder: "title" });
    s.addText("학원 원장님의 첫 출강처럼,\n다음 강사의 첫 출강도 잇겠습니다", { placeholder: "body" });
    T(s, "강사잇다 박서현이었습니다. 감사합니다.", { x: 0.8, y: 6.2, w: 7, h: 0.4, fontSize: 15, bold: true, color: "C9D1E6" });
    const k = [["실제 강의 연결", "3건"], ["회원", "500+명"], ["유료 교육 결제", "10명"]];
    k.forEach(([a, b], i) => {
      const y = 2.0 + i * 1.3;
      R(s, { x: 8.7, y, w: 3.9, h: 1.1, fill: "2A4489" });
      T(s, a, { x: 9.0, y, w: 2, h: 1.1, fontSize: 15, bold: true, color: "C9D1E6", valign: "middle" });
      T(s, b, { x: 10.6, y, w: 1.8, h: 1.1, fontSize: 28, bold: true, color: WHITE, align: "right", valign: "middle" });
    });
    s.addNotes("[5:00~5:15] 학원 원장님이 강사잇다로 첫 출강을 했듯이, 다음 강사의 첫 출강도 저희가 잇겠습니다. 강사의 첫 출강부터 나만의 브랜드까지, 강사잇다 박서현이었습니다. 감사합니다.");
  }

  // ##### a0-index
  pres.addSection({ title: SA });
  {
    const s = content("부록 · Q&A 대비", "예상 질문 6가지와 답변 장표", SA);
    const q = [["A1", "고객은 어떻게 모으나요?", "강사·기관 채널과 지역 순서"], ["A2", "대기업·경쟁사가 따라 하면?", "단계별 커버리지와 지키는 힘"], ["A3", "30만 원의 근거는?", "강의료 대비 회수와 학원 비교"], ["A4", "숫자가 서로 맞나요?", "매출 산식과 KPI 연결"], ["A5", "기술 우위의 근거는?", "공고 수집·정규화·검증 특허"], ["A6", "망한다면 왜일까요?", "위험을 먼저 인정하고 대응"]];
    q.forEach(([c, t, d], i) => {
      const x = 0.6 + (i % 3) * 4.11, y = 1.8 + Math.floor(i / 3) * 2.15, w = 3.91;
      R(s, { x, y, w, h: 1.95, fill: i === 5 ? OTINT : BG });
      pill(s, c, x + 0.25, y + 0.25, 0.7, 0.36, i === 5 ? ORANGE : NAVY, WHITE, 13);
      T(s, t, { x: x + 0.25, y: y + 0.75, w: w - 0.5, h: 0.45, fontSize: 17, bold: true });
      T(s, d, { x: x + 0.25, y: y + 1.25, w: w - 0.5, h: 0.4, fontSize: 13, color: INK2 });
    });
    source(s, "A7 1R 심사 의견 반영 · A8 사업비 사용 계획 · 모르는 것은 먼저 인정하고 근거로 보완");
    s.addNotes("심사위원 질문은 고객 획득 채널, 경쟁사 카피 대응, 가격 근거, 숫자 정합성, 기술 우위, 그리고 망한다면 왜, 이 여섯 가지가 반복됩니다. 질문이 나오면 해당 부록 장표로 바로 넘겨 답합니다.");
  }

  // ##### a1-channels
  {
    const s = appx("A1", "Q. 고객은 어떻게 모으나요?  이미 모인 곳에서 시작합니다");
    const ch = [["강사 채널", "FaUsers", ["강사 모임 1,000명 (대표 직접 운영)", "당근모임 260명 · 스레드 팔로워 600명", "무료 공고 → 첫 출강이 급한 강사를 데뷔 교육으로"]], ["기관 채널", "FaSchool", ["인터뷰 기관 3곳 → 파일럿 기관 (2027.2~3)", "취업·진로 캠프 사업의 학교 네트워크", "사이트로 섭외 의뢰 직접 접수 중"]]];
    for (let i = 0; i < 2; i++) {
      const x = 0.6 + i * 6.17, w = 5.96;
      R(s, { x, y: 1.75, w, h: 3.2, fill: BG });
      await iconCircle(s, ch[i][1], x + 0.3, 2.0, 0.7, NAVY, "FFFFFF");
      T(s, ch[i][0], { x: x + 1.2, y: 2.0, w: 4, h: 0.7, fontSize: 20, bold: true, color: NAVY, valign: "middle" });
      T(s, ch[i][2].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < 2 } })), { x: x + 0.35, y: 2.95, w: w - 0.7, h: 1.8, fontSize: 15, paraSpaceAfter: 8 });
    }
    R(s, { x: 0.6, y: 5.15, w: 12.13, h: 1.4, fill: "FFFFFF", line: LINE });
    T(s, "시기와 지역", { x: 0.9, y: 5.3, w: 3, h: 0.35, fontSize: 14, bold: true, color: INK2 });
    T(s, [{ text: "신학기 1~3월 집중", options: { bold: true, color: ORANGE } }, { text: "   ·   경남 → 부산 → 울산 → 경북·대구 → 전국", options: { bold: true } }], { x: 0.9, y: 5.7, w: 11.5, h: 0.6, fontSize: 18, valign: "middle" });
    s.addNotes("강사는 제가 직접 운영하는 강사 모임 1,000명, 당근모임 260명, 스레드 600명에서 무료 공고로 모으고, 첫 출강이 급한 분을 데뷔 교육으로 안내합니다. 기관은 인터뷰한 3곳을 파일럿 기관으로, 캠프 사업의 학교 네트워크를 다음 고객으로 삼습니다. 신학기 1~3월에 집중하고 경남부터 넓힙니다.");
  }

  // ===== 14. 차별성: 단계별 커버리지 =====
  {
    const s = appx("A2", "Q. 대기업·경쟁사가 따라 하면?  네 단계를 모두 잇는 곳은 없습니다");
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
    R(s, { x: 0.6, y: 6.22, w: 12.13, h: 0.42, fill: OTINT, r: 0.08 });
    T(s, "지키는 힘: 공고 수집 특허 출원 · 강사 커뮤니티 1,000명 · 민간자격 발급 기관 · 부울경 기관 관계 (2026.11.23 각 서비스 홈페이지 확인)", { x: 0.85, y: 6.22, w: 11.7, h: 0.42, fontSize: 12, bold: true, valign: "middle" });
    s.addNotes("신규 강사가 첫 출강까지 가는 길을 공고 탐색, 데뷔 준비, 신뢰 근거, 기관 연결의 네 단계로 나눴습니다. 공고 모음은 첫 단계만, 양성 학원은 교육만, 섭외 대행과 늘봄허브는 연결만 합니다. 네 단계를 모두 잇는 서비스는 확인되지 않았고, 강사잇다가 그 길 전체를 맡습니다. 인증 배지는 2027년 2월에 시작합니다.");
  }

  // ##### a3-price
  {
    const s = appx("A3", "Q. 30만 원의 근거는?  강의 자리 하나로 2.5배 이상 회수합니다");
    T(s, "데뷔 교육비와 한 학기 강의료 비교 (만 원)", { x: 0.6, y: 1.7, w: 6, h: 0.35, fontSize: 15, bold: true, color: INK2 });
    s.addChart(pres.charts.BAR, [{ name: "금액", labels: ["데뷔 교육비", "강의료(최소)", "강의료(최대)"], values: [30, 75, 105] }], {
      x: 0.5, y: 2.05, w: 6.3, h: 4.2, barDir: "col", barGapWidthPct: 55, chartColors: [HEX.orange, HEX.soft, HEX.navy],
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 14, dataLabelColor: HEX.ink, dataLabelFontBold: true,
      catAxisLabelColor: HEX.ink2, catAxisLabelFontSize: 12, valAxisHidden: true, valAxisMaxVal: 120, valAxisMinVal: 0,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, objectName: oid("chart"), ...chartText,
    });
    const c = [["한 학기 강의", "주 1회 × 15주 = 75만~105만 원", NAVY], ["출강 2회 보장", "수료 후 12개월 안에 연결이 안 되면 다음 기수 무료", ORANGE], ["기존 대안", "강사 양성 학원 60만~298만 원, 연결 보장 없음", INK2], ["입구 가격", "입문 특강 1만 원부터, 부담 없이 시작", NAVY]];
    c.forEach(([t, d, col], i) => {
      const y = 1.8 + i * 1.18;
      R(s, { x: 7.2, y, w: 5.53, h: 1.02, fill: i === 1 ? OTINT : BG });
      T(s, t, { x: 7.45, y: y + 0.12, w: 5, h: 0.36, fontSize: 15, bold: true, color: col });
      T(s, d, { x: 7.45, y: y + 0.5, w: 5.1, h: 0.4, fontSize: 13 });
    });
    s.addNotes("한 학기 강의 자리, 주 1회 15주면 강의료가 75만에서 105만 원입니다. 30만 원은 첫 자리 하나로 2.5배 이상 회수되는 가격이고, 학원 60만~298만 원보다 낮으면서 출강 2회 보장을 붙였습니다.");
  }

  // ##### a4-numbers
  {
    const s = appx("A4", "Q. 숫자가 서로 맞나요?  매출은 기수 × 인원 × 단가로 계산합니다");
    const H = { bold: true, color: NAVY, fill: { color: HEX.tint }, fontSize: 14, valign: "middle" };
    const c = { fontSize: 14, color: INK, valign: "middle" };
    const rows = [
      [{ text: "구분", options: H }, { text: "산식", options: H }, { text: "금액", options: { ...H, align: "right" } }, { text: "연결되는 KPI", options: H }],
      [{ text: "2027 상반기 교육 매출", options: { ...c, bold: true } }, { text: "2개 기수 × 20명 × 30만 원", options: c }, { text: "1,200만 원", options: { ...c, align: "right", bold: true } }, { text: "수강 20명 (2027.2, 2기)", options: c }],
      [{ text: "2027 연간 온보딩", options: { ...c, bold: true } }, { text: "연 3기 × 20명 × 30만 원", options: c }, { text: "1,800만 원", options: { ...c, align: "right", bold: true } }, { text: "연 3기 운영 (2027)", options: c }],
      [{ text: "노출·광고비", options: { ...c, bold: true } }, { text: "30명 × 월 3만 원 × 4개월 (2027.9~12)", options: c }, { text: "360만 원", options: { ...c, align: "right", bold: true } }, { text: "유료 강사 30명 (중기)", options: c }],
      [{ text: "2027 매출 합계", options: { ...c, bold: true, color: NAVY } }, { text: "", options: c }, { text: "2,160만 원", options: { ...c, align: "right", bold: true, color: NAVY } }, { text: "", options: c }],
      [{ text: "사업비", options: { ...c, bold: true } }, { text: "MVP 제작비 2,000만 + 자기자금 300만", options: c }, { text: "2,300만 원", options: { ...c, align: "right", bold: true } }, { text: "70%를 단기 온보딩에 사용", options: c }],
    ];
    s.addTable(rows, { x: 0.6, y: 1.8, w: 12.13, colW: [2.9, 4.4, 1.8, 3.03], rowH: 0.62, border: { type: "solid", pt: 0.75, color: HEX.line }, margin: [0, 0.15, 0, 0.15], objectName: oid("table") });
    R(s, { x: 0.6, y: 5.95, w: 12.13, h: 0.6, fill: OTINT, r: 0.08 });
    T(s, "상반기 1,200만 원은 연간 1,800만 원 중 2개 기수분 · 모든 금액은 사업계획서 기준 추정치", { x: 0.85, y: 5.95, w: 11.7, h: 0.6, fontSize: 13, bold: true, valign: "middle" });
    s.addNotes("매출은 기수 곱하기 인원 곱하기 단가로 계산했습니다. 상반기 교육 매출 1,200만 원은 2개 기수 40명분이고, 연 3기 60명이면 1,800만 원입니다. 여기에 9월부터 노출·광고비 360만 원을 더해 2,160만 원입니다.");
  }

  // ##### a5-tech
  {
    const s = appx("A5", "Q. 기술 우위의 근거는?  공고 수집 방식을 특허 출원했습니다");
    const st = [["수집", "교육청·구청·시설공단·대학·학교 공고를 매일 자동 수집"], ["정규화", "제각각인 공고 형식을 하나로 맞춤"], ["검증", "지원 가능한 공고만 남김"], ["한 화면", "지원 가능 공고 281건, 지역·마감일 필터"]];
    const w = 2.83, g = 0.27;
    st.forEach(([t, d], i) => {
      const x = 0.6 + i * (w + g), last = i === 3;
      R(s, { x, y: 1.85, w, h: 2.1, fill: last ? NAVY : (i === 0 ? BG : TINT) });
      T(s, `${i + 1}`, { x: x + 0.25, y: 2.0, w: 0.5, h: 0.4, fontSize: 16, bold: true, color: last ? "FFB98A" : ORANGE });
      T(s, t, { x: x + 0.25, y: 2.4, w: w - 0.5, h: 0.5, fontSize: 22, bold: true, color: last ? WHITE : NAVY });
      T(s, d, { x: x + 0.25, y: 3.0, w: w - 0.5, h: 0.8, fontSize: 13, color: last ? "DDE3F0" : INK2 });
      if (i < 3) L(s, x + w + 0.04, 2.9, x + w + g - 0.04, 2.9, { color: HEX.orange, width: 2, arrow: true });
    });
    const f = [["특허 출원", "10-2026-0223988 (2026.11.10)"], ["수집량", "경남 수집기 하루 평균 9.3건"], ["제도", "직업정보제공사업 신고 J1302020260003"], ["인프라", "1R 이후 국내 서버로 이전, 수집 안정화"]];
    f.forEach(([a, b], i) => {
      const x = 0.6 + (i % 2) * 6.17, y = 4.3 + Math.floor(i / 2) * 1.12;
      R(s, { x, y, w: 5.96, h: 0.95, fill: "FFFFFF", line: LINE });
      T(s, a, { x: x + 0.3, y, w: 1.6, h: 0.95, fontSize: 15, bold: true, color: NAVY, valign: "middle" });
      T(s, b, { x: x + 1.9, y, w: 3.9, h: 0.95, fontSize: 14, bold: true, valign: "middle" });
    });
    s.addNotes("흩어진 공공 강사 공고를 매일 자동으로 모으고, 형식을 맞추고, 지원 가능한 공고만 남기는 과정을 특허 출원했습니다. 경남만 하루 평균 9.3건이 들어오고, 직업정보제공사업 신고를 마쳐 공고를 합법적으로 제공합니다. 다만 기술만으로 지키는 것은 아니고, 강사 커뮤니티와 기관 관계가 함께 해자가 됩니다.");
  }

  // ##### a6-risk
  {
    const s = appx("A6", "Q. 망한다면 왜일까요?  위험을 먼저 인정하고 대응을 준비했습니다");
    const H = { bold: true, color: NAVY, fill: { color: HEX.tint }, fontSize: 14, valign: "middle" };
    const c = { fontSize: 13, color: INK, valign: "middle" };
    const rows = [
      [{ text: "위험", options: H }, { text: "지금 상태", options: H }, { text: "대응", options: H }],
      [{ text: "교육 후 출강 연결이 안 되면 교육 가치가 무너짐", options: { ...c, bold: true } }, { text: "1기 10명 중 2명 출강·면접 합격", options: c }, { text: "출강 2회 보장, 인터뷰 기관 3곳 파일럿, 인증 배지(2027.2)", options: c }],
      [{ text: "대표 1인 개발에 의존", options: { ...c, bold: true } }, { text: "MVP를 대표가 직접 개발·운영", options: c }, { text: "고도화는 외주, 2027 하반기 개발자 채용", options: c }],
      [{ text: "노출·광고비 구조의 적법성", options: { ...c, bold: true } }, { text: "직업정보제공사업 신고 완료", options: c }, { text: "성사 수수료 없이 노출 비용만, 고용센터·노무사 확인 후 진행", options: c }],
      [{ text: "지역 공고 수요의 한계", options: { ...c, bold: true } }, { text: "부울경·경북 연 약 1만 건 (추정)", options: c }, { text: "영남권 → 전국, 평생학습관·지자체·기업 교육으로 확대", options: c }],
      [{ text: "강사 설문 표본의 한계", options: { ...c, bold: true } }, { text: "자체 설문 n=100", options: c }, { text: "공공 조사(서울시 1,000명, 강사 402명 연구)와 함께 제시", options: c }],
    ];
    s.addTable(rows, { x: 0.6, y: 1.8, w: 12.13, colW: [4.0, 3.4, 4.73], rowH: 0.74, border: { type: "solid", pt: 0.75, color: HEX.line }, margin: [0, 0.15, 0, 0.15], objectName: oid("table") });
    s.addNotes("가장 큰 위험은 교육을 받았는데 출강으로 이어지지 않는 경우입니다. 지금은 1기 10명 중 2명이라 아직 부족하다는 것을 인정합니다. 그래서 출강 2회 보장을 붙였고, 인터뷰 기관 3곳과 파일럿을 하며 인증 배지로 기관이 믿을 근거를 만듭니다. 1인 개발 의존은 외주와 내년 하반기 채용으로, 광고비 구조는 고용센터와 노무사 확인을 거쳐 풉니다.");
  }

  // ===== 10. 1R 심사 의견 반영 =====
  {
    const s = content("부록 A7 · 1R 심사 의견 반영", "1R 심사 의견 4가지를 모두 서비스에 반영했습니다", SA);
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

  // ===== 19. 자금 소요: 트리맵 =====
  {
    const s = content("부록 A8 · 사업비 사용 계획 (추정)", "MVP 제작비 2,000만 원 중 70%를 단기 온보딩에 씁니다", SA);
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

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
