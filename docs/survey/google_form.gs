/**
 * 강사 활동 실태 및 서비스 수요 조사 → 구글폼 자동 생성 스크립트
 *
 * 사용법
 * 1. https://script.google.com 접속 → [새 프로젝트]
 * 2. 기본 코드를 모두 지우고 이 파일 내용을 붙여넣기 → 저장
 * 3. 위쪽 함수 선택에서 createSurveyForm 선택 → [실행]
 * 4. 권한 승인(본인 구글 계정) 후 실행 로그에 나오는
 *    - 응답자용 링크(배포용)
 *    - 편집 링크
 *    - 응답 스프레드시트 링크
 *    를 확인
 *
 * 실행할 때마다 새 폼이 하나씩 만들어집니다. 수정이 필요하면 편집 링크에서 고치거나,
 * 이 파일을 고친 뒤 다시 실행하고 이전 폼은 지워 주세요.
 */

const ORG = '보라에듀';
const CONTACT = '010-9894-5055';

const PAINS = [
  '마감이 지난 뒤에 공고를 알게 되었다',
  '기관마다 같은 서류(이력서·경력증명서·범죄경력회보서 등)를 다시 준비했다',
  '지원 후 결과 연락을 받지 못했다',
  '강의료가 공고 내용과 달랐거나 지급이 늦었다',
  '첫 출강 기회를 어디에서 얻어야 할지 몰랐다',
  '경력·포트폴리오 부족으로 서류에서 탈락한 것 같다',
  '강의안·교구 준비에 시간이 많이 들었다',
  '방학·비수기에 일정이 비어 수입이 줄었다',
  '기관 담당자와 직접 연결될 창구가 없었다'
];

function createSurveyForm() {
  const form = FormApp.create('강사 활동 실태 및 서비스 수요 조사');
  form
    .setDescription(
      '안녕하십니까.\n\n' +
      '본 조사는 학교·공공기관·기업 등에서 활동하시는 강사분들의 활동 실태와 어려움, ' +
      '그리고 강사 지원 서비스에 대한 의견을 알아보기 위해 실시됩니다.\n\n' +
      '응답 내용은 통계 분석 목적으로만 사용되며, 개인을 식별할 수 없는 형태로 처리됩니다. ' +
      '정답은 없으니 평소 경험하신 대로 응답해 주시기 바랍니다.\n\n' +
      '응답 시간은 약 5분입니다. Q5 자유 응답을 정성껏 작성해 주신 분을 선정해 bhc 치킨 기프티콘을 보내 드립니다.\n\n' +
      '조사기관: ' + ORG + ' · 문의: ' + CONTACT
    )
    .setProgressBar(true)
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false)
    .setConfirmationMessage('설문에 응답해 주셔서 감사합니다.\n보내 주신 응답은 강사 활동 환경을 개선하는 데 소중히 활용하겠습니다.');

  // ── Ⅰ. 기본 정보 ─────────────────────────────
  form.addSectionHeaderItem().setTitle('Ⅰ. 기본 정보');

  form.addMultipleChoiceItem()
    .setTitle('A1. 귀하께서 현재 가장 많이 활동하시는 강의 분야는 무엇입니까?')
    .setHelpText('1개만 선택')
    .setChoiceValues([
      '학교 – 취업·진로 (진로교육, 취업특강, 창업교육 등)',
      '학교 – 방과후 (방과후학교, 늘봄, 돌봄 프로그램 등)',
      '공공기관 (지자체, 도서관, 평생교육원, 복지관 등)',
      '기업 (직무·리더십·CS 교육 등)'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('A2. 귀하의 강사 경력은 어느 정도입니까?')
    .setHelpText('첫 유료 출강 기준')
    .setChoiceValues(['아직 출강 경험 없음 (준비 중)', '1년 미만', '1~3년 미만', '3~5년 미만', '5~10년 미만', '10년 이상'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('A3. 귀하의 연령대는 어떻게 되십니까?')
    .setChoiceValues(['20대', '30대', '40대', '50대', '60대 이상'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('A4. 주로 활동하시는 지역은 어디입니까?')
    .setHelpText('복수 응답')
    .setChoiceValues(['부산', '울산', '경남', '경북', '대구', '그 외 지역'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('A5. 강의 활동은 귀하의 수입에서 어느 정도를 차지합니까?')
    .setChoiceValues(['전업 (강의 수입이 거의 전부)', '주 수입 (다른 일도 일부 병행)', '부업 (본업이 따로 있음)', '아직 강의 수입 없음'])
    .setRequired(true);

  // ── Ⅱ. 강사 활동 실태 ─────────────────────────
  form.addPageBreakItem().setTitle('Ⅱ. 강사 활동 실태');

  form.addCheckboxItem()
    .setTitle('Q1. 강사 모집 공고는 주로 어디에서 확인하십니까?')
    .setHelpText('복수 응답')
    .setChoiceValues([
      '교육청·학교 홈페이지',
      '지자체·도서관·평생교육원 등 기관 홈페이지',
      '구인 사이트 (워크넷, 사람인 등)',
      '강사 단체 대화방·밴드·카페',
      '지인·협회 소개',
      '교육업체·에이전시',
      '따로 찾지 않음 (기관에서 연락이 옴)'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q2. 공고 확인과 지원서류 준비에 일주일 평균 몇 시간 정도를 쓰십니까?')
    .setChoiceValues(['1시간 미만', '1~3시간', '3~5시간', '5~10시간', '10시간 이상'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Q3. 최근 3개월 동안 실제로 경험하신 일을 모두 선택해 주십시오.')
    .setHelpText('복수 응답 · "해당 없음"은 다른 항목과 함께 고르지 말아 주십시오.')
    .setChoiceValues(PAINS.concat(['해당 없음']))
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q4. 위 항목 중 가장 먼저 해결되었으면 하는 것은 무엇입니까?')
    .setHelpText('1개만 선택')
    .setChoiceValues(PAINS)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Q5. (선택) 강사로 활동하시면서 가장 어려웠던 순간을 자유롭게 적어 주십시오.')
    .setHelpText('🍗 정성껏 작성해 주신 분을 선정해 bhc 치킨 기프티콘을 보내 드립니다. 설문 마지막에 기프티콘 받으실 연락처를 남겨 주세요.')
    .setRequired(false);

  // ── Ⅲ. 강사 지원 서비스에 대한 의견 ─────────────
  form.addPageBreakItem()
    .setTitle('Ⅲ. 강사 지원 서비스에 대한 의견')
    .setHelpText(
      '다음은 현재 시장에서 검토되고 있는 강사 지원 서비스입니다. 각 서비스를 읽고 응답해 주십시오.\n\n' +
      '■ 서비스 A. 강사 공고 맞춤 알림\n' +
      '교육청·학교·지자체·도서관·평생교육원 등 여러 기관의 강사 모집 공고를 매일 수집해, 본인이 선택한 지역·분야의 공고만 ' +
      '매일 아침 이메일로 보내 주는 서비스. 신규 공고와 마감임박(3일 이내) 공고를 구분하고, 강의료·시수 요약과 원문 링크를 제공합니다.\n\n' +
      '■ 서비스 B. 신규 강사 입문 과정\n' +
      '5주 기수제 소수 정원 과정. 강사 프로필·소개서 작성 → 강의안·시범 강의 피드백 → 지원서류·지원 실무 → 첫 출강 연결 지원.\n\n' +
      '■ 서비스 C. 강사-기관 매칭\n' +
      '서비스 운영사가 기관과 강사를 직접 연결하고, 출강이 확정되면 수수료를 받는 방식.'
    );

  form.addMultipleChoiceItem()
    .setTitle('Q6. 세 가지 서비스 중 지금 하나만 이용할 수 있다면 무엇을 선택하시겠습니까?')
    .setChoiceValues(['서비스 A. 강사 공고 맞춤 알림', '서비스 B. 신규 강사 입문 과정', '서비스 C. 강사-기관 매칭', '모두 이용 의향 없음'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q7. 서비스 A(강사 공고 맞춤 알림)를 이용한다면, 한 달에 최대 얼마까지 지불하실 의향이 있습니까?')
    .setChoiceValues(['무료일 때만 이용', '월 3,900원까지', '월 5,900원까지', '월 9,900원까지', '월 14,900원까지', '월 19,900원 이상도 가능'])
    .setRequired(true);

  form.addGridItem()
    .setTitle('Q8. 서비스 B(신규 강사 입문 과정)에 대해, 아래 두 경우 각각 최대 얼마까지 지불하실 의향이 있습니까?')
    .setHelpText('행마다 하나씩 선택')
    .setRows(['(가) 교육 과정만 제공', '(나) 수료 후 실제 출강 1회 이상 연결 보장'])
    .setColumns(['필요 없음', '무료일 때만', '10만원 미만', '10~30만원', '30~50만원', '50~80만원', '80만원 이상'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q9. [경력 3년 이상만] 서비스 B에 멘토(강의안 피드백·동행 출강)로 참여하실 의향이 있습니까?')
    .setHelpText('경력 3년 미만이신 분은 "해당 없음"을 선택해 주십시오.')
    .setChoiceValues(['보수가 있다면 참여하겠다', '일정·조건을 보고 결정하겠다', '참여하지 않겠다', '해당 없음 (경력 3년 미만)'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q10. 교육업체·에이전시를 통해 출강하신 경험이 있다면, 강의료 중 업체 몫은 대략 어느 정도였습니까?')
    .setChoiceValues(['경험 없음·모름', '10% 미만', '10~20%', '20~30%', '30~50%', '50% 이상'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q11. 서비스 C(강사-기관 매칭)를 통해 강의가 확정되었다고 가정해 주십시오. 강사가 부담하는 수수료로 최대 어느 수준까지 받아들이실 수 있습니까?')
    .setHelpText('예시: 2시간 강의, 강의료 30만원')
    .setChoiceValues([
      '강사 부담은 없어야 한다 (기관 부담)',
      '3% (9,000원)',
      '5% (15,000원)',
      '10% (30,000원)',
      '15% (45,000원)',
      '20% 이상도 가능 (새로운 기관과 연결된다면)'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q12. 수수료 방식으로 가장 선호하시는 것은 무엇입니까?')
    .setChoiceValues([
      '매번 정률 (강의료의 일정 %)',
      '매번 정액 (건당 고정 금액)',
      '첫 출강만 수수료, 같은 기관 재출강은 무료',
      '월 구독 (매칭 무제한)',
      '기관이 부담하는 방식만 이용'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q13. 최근 1년 동안 강사 활동(자격증·양성과정·연수·교구·교재 등)을 위해 지출하신 금액은 모두 합해 어느 정도입니까?')
    .setChoiceValues(['거의 없음', '10만원 미만', '10~50만원', '50~100만원', '100~300만원', '300만원 이상'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Q14. 강사 입장에서 앞으로 있었으면 하는 서비스를 골라 주십시오.')
    .setHelpText('최대 3개')
    .setChoiceValues([
      '여러 기관의 공고를 한곳에서 보기',
      '서류 한 번 등록으로 여러 기관에 지원',
      '기관별 강의료·정산 후기 공개',
      '기관이 강사를 찾아볼 수 있는 강사 프로필 페이지',
      '강의안·교구 공유 및 거래',
      '시범 강의 영상 피드백',
      '방학·비수기 일감 연결',
      '사업소득(3.3%)·종합소득세 신고 도움',
      '같은 분야 강사 네트워크'
    ])
    .showOtherOption(true)
    .setValidation(FormApp.createCheckboxValidation()
      .setHelpText('최대 3개까지 선택해 주십시오.')
      .requireSelectAtMost(3)
      .build())
    .setRequired(true);

  // ── Ⅳ. 마무리 ───────────────────────────────
  form.addPageBreakItem().setTitle('Ⅳ. 마무리');

  form.addMultipleChoiceItem()
    .setTitle('이 설문을 어디에서 보셨습니까?')
    .setChoiceValues(['강사 단체 대화방·밴드·카페', '강사 협회·단체 안내', '지인 소개', '이메일 안내'])
    .showOtherOption(true)
    .setRequired(false);

  const giftQ = form.addMultipleChoiceItem()
    .setTitle('bhc 치킨 기프티콘을 받으시겠습니까?')
    .setHelpText('Q5를 정성껏 작성해 주신 분 중 선정해 보내 드립니다.')
    .setRequired(true);

  const contactPage = form.addPageBreakItem()
    .setTitle('기프티콘 받으실 연락처')
    .setHelpText('기프티콘은 아래 휴대폰 번호로 발송됩니다.');

  giftQ.setChoices([
    giftQ.createChoice('예, 연락처를 남기겠습니다', contactPage),
    giftQ.createChoice('아니요 (바로 제출)', FormApp.PageNavigationType.SUBMIT)
  ]);

  form.addTextItem()
    .setTitle('휴대폰 번호')
    .setHelpText('예: 010-1234-5678')
    .setValidation(FormApp.createTextValidation()
      .setHelpText('휴대폰 번호 형식으로 입력해 주십시오. (예: 010-1234-5678)')
      .requireTextMatchesPattern('^01[016789]-?[0-9]{3,4}-?[0-9]{4}$')
      .build())
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('개인정보 수집·이용 동의')
    .setHelpText(
      '· 수집 항목: 휴대폰 번호\n' +
      '· 이용 목적: 기프티콘 발송\n' +
      '· 보유 기간: 발송 완료 후 1개월 이내 파기\n' +
      '동의를 거부할 수 있으며, 거부 시 기프티콘 발송 대상에서 제외됩니다.'
    )
    .setChoiceValues(['위 내용에 동의합니다'])
    .setRequired(true);

  // 응답을 받을 스프레드시트 연결
  const ss = SpreadsheetApp.create('강사 활동 실태조사 응답');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // 응답 받기 켜기 (새 구글폼 게시 방식 대응)
  try {
    if (typeof form.setPublished === 'function') form.setPublished(true);
  } catch (e) {
    Logger.log('게시 설정은 폼 편집 화면의 [게시] 버튼에서 직접 켜 주세요: ' + e);
  }
  form.setAcceptingResponses(true);

  Logger.log('응답자용 링크(배포용): ' + form.getPublishedUrl());
  Logger.log('편집 링크: ' + form.getEditUrl());
  Logger.log('응답 스프레드시트: ' + ss.getUrl());
}
