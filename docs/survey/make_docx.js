const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, BorderStyle, Footer, PageNumber, TabStopType, VerticalAlign
} = require('docx');

const FONT = { ascii: '맑은 고딕', eastAsia: '맑은 고딕', hAnsi: '맑은 고딕', cs: '맑은 고딕' };
const NAVY = '1F3A6E', GRAY = '666666', LIGHT = 'E8EDF6';
const PAGE_W = 11906, MARGIN = 1134; // A4, 2cm margins
const CONTENT_W = PAGE_W - MARGIN * 2; // 9638

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 20, bold: o.bold, color: o.color, italics: o.italics });
const para = (children, o = {}) => new Paragraph({ pageBreakBefore: o.pageBreakBefore, children: Array.isArray(children) ? children : [children], spacing: { before: o.before ?? 0, after: o.after ?? 60, line: o.line || 300 }, indent: o.indent, alignment: o.align, keepNext: o.keepNext, keepLines: true, border: o.border, shading: o.shading, tabStops: o.tabStops });

const body = [];
const add = (...p) => body.push(...p);

// ── 제목
add(para(run('강사 활동 실태 및 서비스 수요 조사', { size: 36, bold: true, color: NAVY }), { align: AlignmentType.CENTER, after: 80 }));
add(para(run('조사기관 보라에듀  ·  문의 010-9894-5055  ·  응답 기간 11월 17일(화)까지', { size: 18, color: GRAY }), { align: AlignmentType.CENTER, after: 240 }));

// ── 인사말 (테두리 박스)
const box = { top: { style: BorderStyle.SINGLE, size: 6, color: 'B8C4DC', space: 6 }, bottom: { style: BorderStyle.SINGLE, size: 6, color: 'B8C4DC', space: 6 }, left: { style: BorderStyle.SINGLE, size: 6, color: 'B8C4DC', space: 8 }, right: { style: BorderStyle.SINGLE, size: 6, color: 'B8C4DC', space: 8 } };
const boxShade = { type: ShadingType.CLEAR, fill: 'F5F7FB', color: 'auto' };
[
  [run('안녕하십니까.')],
  [run('본 조사는 학교·공공기관·기업 등에서 활동하시는 강사분들의 활동 실태와 어려움, 그리고 강사 지원 서비스에 대한 의견을 알아보기 위해 실시됩니다.')],
  [run('응답 내용은 통계 분석 목적으로만 사용되며, 개인을 식별할 수 없는 형태로 처리됩니다. 정답은 없으니 평소 경험하신 대로 응답해 주시기 바랍니다.')],
  [run('· 응답 시간: 약 5분    · 응답 기간: 11월 17일(화)까지')],
  [run('Q5 자유 응답을 정성껏 작성해 주신 분을 선정해 '), run('스타벅스 e카드교환권 1만원권', { bold: true }), run('을 보내 드립니다.')],
  [run('(11월 12일 이전 응답자 중 선정된 분께는 안내드린 대로 bhc 치킨 기프티콘을 보내 드립니다.)', { size: 18, color: GRAY })],
].forEach((c, i, a) => add(para(c, { border: box, shading: boxShade, after: i === a.length - 1 ? 200 : 40 })));
add(para(run('※ 해당하는 곳에 ✔ 표시해 주십시오. 별도 안내가 없으면 하나만 선택합니다.', { size: 18, color: GRAY }), { after: 120 }));

// ── 헬퍼
const section = (title, brk) => add(para(run(title, { size: 24, bold: true, color: 'FFFFFF' }), {
  pageBreakBefore: brk, before: brk ? 0 : 240, after: 120, keepNext: true,
  shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' }, indent: { left: 0 },
}));
const qTitle = (id, text, hint) => {
  const ch = [run(id + '. ', { bold: true, color: NAVY, size: 21 }), run(text, { bold: true, size: 21 })];
  if (hint) ch.push(run('  (' + hint + ')', { size: 18, color: GRAY }));
  add(para(ch, { before: 160, after: 60, keepNext: true }));
};
const note = (text) => add(para(run(text, { size: 18, color: GRAY }), { indent: { left: 280 }, after: 60, keepNext: true }));
const BOX = '☐ ';
function options(list, o = {}) {
  const short = list.every(s => s.length <= 10) && !o.vertical;
  if (short) {
    add(para(list.map((s, i) => run((i ? '      ' : '') + BOX + s.replace(/ /g, '\u00A0'))), { indent: { left: 280 }, after: 40 }));
  } else {
    list.forEach((s, i) => add(para(run(BOX + s), { indent: { left: 280 }, after: 20, keepNext: i < list.length - 1 })));
  }
  if (o.other) add(para(run(BOX + '기타: ______________________________'), { indent: { left: 280 }, after: 40 }));
}
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const lines = (n) => add(new Table({
  width: { size: CONTENT_W - 280, type: WidthType.DXA }, columnWidths: [CONTENT_W - 280], indent: { size: 280, type: WidthType.DXA },
  rows: Array.from({ length: n }, () => new TableRow({ height: { value: 520, rule: 'atLeast' }, cantSplit: true, children: [new TableCell({
    width: { size: CONTENT_W - 280, type: WidthType.DXA },
    borders: { top: NONE, left: NONE, right: NONE, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' } },
    children: [para(run(' '), { after: 0 })] })] })),
}));

const PAINS = ['마감이 지난 뒤에 공고를 알게 되었다', '기관마다 같은 서류(이력서·경력증명서·범죄경력회보서 등)를 다시 준비했다', '지원 후 결과 연락을 받지 못했다', '강의료가 공고 내용과 달랐거나 지급이 늦었다', '첫 출강 기회를 어디에서 얻어야 할지 몰랐다', '경력·포트폴리오 부족으로 서류에서 탈락한 것 같다', '강의안·교구 준비에 시간이 많이 들었다', '방학·비수기에 일정이 비어 수입이 줄었다', '기관 담당자와 직접 연결될 창구가 없었다'];
const num = (arr) => arr.map((s, i) => (i + 1) + '. ' + s);

// ── Ⅰ
section('Ⅰ. 기본 정보');
qTitle('A1', '귀하께서 현재 가장 많이 활동하시는 강의 분야는 무엇입니까?', '1개만 선택');
options(['학교 – 취업·진로 (진로교육, 취업특강, 창업교육 등)', '학교 – 방과후 (방과후학교, 늘봄, 돌봄 프로그램 등)', '공공기관 (지자체, 도서관, 평생교육원, 복지관 등)', '기업 (직무·리더십·CS 교육 등)'], { other: true });
qTitle('A2', '귀하의 강사 경력은 어느 정도입니까?', '첫 유료 출강 기준');
options(['아직 출강 경험 없음 (준비 중)', '1년 미만', '1~3년 미만', '3~5년 미만', '5~10년 미만', '10년 이상'], { vertical: true });
qTitle('A3', '귀하의 연령대는 어떻게 되십니까?');
options(['20대', '30대', '40대', '50대', '60대 이상']);
qTitle('A4', '주로 활동하시는 지역은 어디입니까?', '복수 응답');
options(['부산', '울산', '경남', '경북', '대구', '그 외 지역']);
qTitle('A5', '강의 활동은 귀하의 수입에서 어느 정도를 차지합니까?');
options(['전업 (강의 수입이 거의 전부)', '주 수입 (다른 일도 일부 병행)', '부업 (본업이 따로 있음)', '아직 강의 수입 없음']);

// ── Ⅱ
section('Ⅱ. 강사 활동 실태');
qTitle('Q1', '강사 모집 공고는 주로 어디에서 확인하십니까?', '복수 응답');
options(['교육청·학교 홈페이지', '지자체·도서관·평생교육원 등 기관 홈페이지', '구인 사이트 (워크넷, 사람인 등)', '강사 단체 대화방·밴드·카페', '지인·협회 소개', '교육업체·에이전시', '따로 찾지 않음 (기관에서 연락이 옴)']);
qTitle('Q2', '공고 확인과 지원서류 준비에 일주일 평균 몇 시간 정도를 쓰십니까?');
options(['1시간 미만', '1~3시간', '3~5시간', '5~10시간', '10시간 이상']);
qTitle('Q3', '최근 3개월 동안 실제로 경험하신 일을 모두 선택해 주십시오.', '복수 응답');
note('"해당 없음"은 다른 항목과 함께 고르지 말아 주십시오.');
options(num(PAINS).concat(['10. 해당 없음']));
qTitle('Q4', '위 Q3의 1~9번 중 가장 먼저 해결되었으면 하는 것은 몇 번입니까?', '1개만');
add(para(run('번호: ________ 번'), { indent: { left: 280 }, after: 60 }));
qTitle('Q5', '(선택) 강사로 활동하시면서 가장 어려웠던 순간을 자유롭게 적어 주십시오.');
note('정성껏 작성해 주신 분을 선정해 스타벅스 e카드교환권 1만원권을 보내 드립니다. 마지막 장에 연락처를 남겨 주세요.');
lines(4);

// ── Ⅲ
section('Ⅲ. 강사 지원 서비스에 대한 의견', true);
add(para(run('다음은 현재 시장에서 검토되고 있는 강사 지원 서비스입니다. 각 서비스를 읽고 응답해 주십시오.'), { after: 100 }));
const svc = [
  ['서비스 A. 강사 공고 맞춤 알림', '교육청·학교·지자체·도서관·평생교육원 등 여러 기관의 강사 모집 공고를 매일 수집해, 본인이 선택한 지역·분야의 공고만 매일 아침 이메일로 보내 주는 서비스. 신규 공고와 마감임박(3일 이내) 공고를 구분하고, 강의료·시수 요약과 원문 링크를 제공합니다.'],
  ['서비스 B. 신규 강사 입문 과정', '5주 기수제 소수 정원 과정. 강사 프로필·소개서 작성 → 강의안·시범 강의 피드백 → 지원서류·지원 실무 → 첫 출강 연결 지원.'],
  ['서비스 C. 강사-기관 매칭', '서비스 운영사가 기관과 강사를 직접 연결하고, 출강이 확정되면 수수료를 받는 방식.'],
];
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'B8C4DC' };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
add(new Table({
  width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [2600, CONTENT_W - 2600],
  rows: svc.map(([h, d]) => new TableRow({ cantSplit: true, children: [
    new TableCell({ width: { size: 2600, type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: LIGHT, color: 'auto' }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [para(run(h, { bold: true, color: NAVY }), { after: 0 })] }),
    new TableCell({ width: { size: CONTENT_W - 2600, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [para(run(d, { size: 19 }), { after: 0 })] }),
  ] })),
}));
qTitle('Q6', '세 가지 서비스 중 지금 하나만 이용할 수 있다면 무엇을 선택하시겠습니까?');
options(['서비스 A', '서비스 B', '서비스 C', '모두 이용 의향 없음']);
qTitle('Q7', '서비스 A(강사 공고 맞춤 알림)를 이용한다면, 한 달에 최대 얼마까지 지불하실 의향이 있습니까?');
options(['무료일 때만 이용', '월 3,900원까지', '월 5,900원까지', '월 9,900원까지', '월 14,900원까지', '월 19,900원 이상도 가능'], { vertical: true });
qTitle('Q8', '서비스 B(신규 강사 입문 과정)에 대해, 아래 두 경우 각각 최대 얼마까지 지불하실 의향이 있습니까?', '행마다 하나씩');
const cols = ['필요\n없음', '무료일\n때만', '10만원\n미만', '10~30\n만원', '30~50\n만원', '50~80\n만원', '80만원\n이상'];
const firstW = 2900, cw = Math.floor((CONTENT_W - firstW) / cols.length), lastW = CONTENT_W - firstW - cw * (cols.length - 1);
const widths = [firstW, ...cols.map((_, i) => i === cols.length - 1 ? lastW : cw)];
const cell = (children, w, shade) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER, shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children });
add(new Table({
  width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths,
  rows: [
    new TableRow({ cantSplit: true, tableHeader: true, children: [cell([para(run(''), { after: 0 })], firstW, LIGHT), ...cols.map((c, i) => cell(c.split('\n').map(l => para(run(l, { size: 17, bold: true }), { align: AlignmentType.CENTER, after: 0, line: 240 })), widths[i + 1], LIGHT))] }),
    ...['(가) 교육 과정만 제공', '(나) 수료 후 실제 출강 1회 이상 연결 보장'].map(r => new TableRow({ cantSplit: true, children: [cell([para(run(r, { size: 19 }), { after: 0 })], firstW), ...cols.map((_, i) => cell([para(run('☐', { size: 24 }), { align: AlignmentType.CENTER, after: 0 })], widths[i + 1]))] })),
  ],
}));
qTitle('Q9', '[경력 3년 이상만] 서비스 B에 멘토(강의안 피드백·동행 출강)로 참여하실 의향이 있습니까?');
options(['보수가 있다면 참여하겠다', '일정·조건을 보고 결정하겠다', '참여하지 않겠다', '해당 없음 (경력 3년 미만)']);
qTitle('Q10', '교육업체·에이전시를 통해 출강하신 경험이 있다면, 강의료 중 업체 몫은 대략 어느 정도였습니까?');
options(['경험 없음·모름', '10% 미만', '10~20%', '20~30%', '30~50%', '50% 이상']);
qTitle('Q11', '서비스 C(강사-기관 매칭)를 통해 강의가 확정되었다고 가정해 주십시오. 강사가 부담하는 수수료로 최대 어느 수준까지 받아들이실 수 있습니까?');
note('예시: 2시간 강의, 강의료 30만원');
options(['강사 부담은 없어야 한다 (기관 부담)', '3% (9,000원)', '5% (15,000원)', '10% (30,000원)', '15% (45,000원)', '20% 이상도 가능 (새로운 기관과 연결된다면)'], { vertical: true });
qTitle('Q12', '수수료 방식으로 가장 선호하시는 것은 무엇입니까?');
options(['매번 정률 (강의료의 일정 %)', '매번 정액 (건당 고정 금액)', '첫 출강만 수수료, 같은 기관 재출강은 무료', '월 구독 (매칭 무제한)', '기관이 부담하는 방식만 이용']);
qTitle('Q13', '최근 1년 동안 강사 활동(자격증·양성과정·연수·교구·교재 등)을 위해 지출하신 금액은 모두 합해 어느 정도입니까?');
options(['거의 없음', '10만원 미만', '10~50만원', '50~100만원', '100~300만원', '300만원 이상'], { vertical: true });
qTitle('Q14', '강사 입장에서 앞으로 있었으면 하는 서비스를 골라 주십시오.', '최대 3개');
options(['여러 기관의 공고를 한곳에서 보기', '서류 한 번 등록으로 여러 기관에 지원', '기관별 강의료·정산 후기 공개', '기관이 강사를 찾아볼 수 있는 강사 프로필 페이지', '강의안·교구 공유 및 거래', '시범 강의 영상 피드백', '방학·비수기 일감 연결', '사업소득(3.3%)·종합소득세 신고 도움', '같은 분야 강사 네트워크'], { other: true });

// ── Ⅳ
section('Ⅳ. 마무리', true);
qTitle('B1', '이 설문을 어디에서 보셨습니까?', '선택');
options(['강사 단체 대화방·밴드·카페', '강사 협회·단체 안내', '지인 소개', '이메일 안내'], { other: true });
qTitle('B2', '기프티콘(스타벅스 e카드교환권 1만원권)을 받으시겠습니까?');
note('Q5를 정성껏 작성해 주신 분 중 선정해 보내 드립니다.');
options(['예 → 아래에 연락처를 적어 주십시오', '아니요']);
add(para([run('휴대폰 번호:  ', { bold: true }), run('010 - ________ - ________')], { indent: { left: 280 }, before: 120, after: 120 }));
add(para(run('개인정보 수집·이용 동의', { bold: true, color: NAVY }), { before: 120, after: 40, keepNext: true, border: box, shading: boxShade }));
['· 수집 항목: 휴대폰 번호', '· 이용 목적: 기프티콘 발송', '· 보유 기간: 발송 완료 후 1개월 이내 파기', '동의를 거부할 수 있으며, 거부 시 기프티콘 발송 대상에서 제외됩니다.']
  .forEach(t => add(para(run(t, { size: 19 }), { after: 20, keepNext: true, border: box, shading: boxShade })));
add(para(run('☐ 위 내용에 동의합니다', { bold: true }), { after: 200, border: box, shading: boxShade }));
add(para(run('설문에 응답해 주셔서 감사합니다.', { size: 22, bold: true, color: NAVY }), { align: AlignmentType.CENTER, before: 240 }));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['보라에듀 강사 활동 실태조사  ·  ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: GRAY })] })] }) },
    children: body,
  }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(process.argv[2], b); console.log('written'); });
