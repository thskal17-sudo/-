/**
 * 평생교육원 지원서 1:1 ZOOM 컨설팅 신청서(구글폼) 자동 생성 스크립트
 *
 * 쓰는 법
 *   1. https://script.google.com 접속 → [새 프로젝트]
 *   2. 기본 코드를 모두 지우고 이 파일 내용을 붙여넣기
 *   3. 위쪽 함수 선택에서 createConsultingForm 고르고 [실행]
 *   4. 처음 한 번 권한 허용 (내 구글 드라이브에 폼·시트를 만드는 권한)
 *   5. [실행 로그]에 나온 "응답 링크"를 홈페이지·게시글에 붙이면 끝
 *
 * 만들어지는 것
 *   - 구글폼 "평생교육원 지원서 1:1 ZOOM 컨설팅 신청서" (내 드라이브)
 *   - 응답이 쌓이는 구글 시트 "평생교육원 지원서 컨설팅 신청자 명단"
 *
 * 아래 SETTINGS 의 ○ 칸을 채운 뒤 실행하면 폼 안내문에 그대로 들어간다.
 * 비워 두면 해당 줄은 빠진다.
 */
const SETTINGS = {
  title: '평생교육원 지원서 1:1 ZOOM 컨설팅 신청서',
  period: '11월 10일(화) 오후 7시부터, 신청 순서대로 1:1 진행',
  duration: '',      // 예: '1인 40분'
  capacity: '선착순 5명',
  maxResponses: 5,   // 이 수만큼 신청이 들어오면 폼이 자동으로 마감된다. 0 이면 자동 마감 안 함
  fee: '',           // 예: '무료'
  organizer: '',     // 개인정보 동의문에 들어갈 운영 주체. 예: '○○교육원'
  retention: '상담 종료 후 6개월',
};

function createConsultingForm() {
  const form = FormApp.create(SETTINGS.title);

  const info = [
    ['일정', SETTINGS.period],
    ['소요 시간', SETTINGS.duration],
    ['모집 인원', SETTINGS.capacity],
    ['비용', SETTINGS.fee],
  ].filter(([, v]) => v).map(([k, v]) => `■ ${k}: ${v}`);

  form.setDescription([
    '평생교육원 지원서, 어디서 막히셨나요?',
    '강의계획서·강사 이력서·강좌 소개글 등 지원서를 쓰다 막히는 부분을',
    'ZOOM으로 1:1로 함께 보면서 해결해 드립니다.',
    '',
    '■ 진행 방식: ZOOM 온라인 1:1',
    ...info,
    '',
    '신청서를 남겨 주시면 확인 후 개별 연락으로 일정과 ZOOM 링크를 보내 드립니다.',
    '상담 때 작성 중인 지원서를 화면 공유해 주시면 더 구체적으로 봐 드릴 수 있어요.',
    '작성은 2~3분이면 충분합니다.',
  ].join('\n'));

  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(
    '신청이 접수되었습니다. 감사합니다!\n' +
    '남겨 주신 연락처로 일정과 ZOOM 링크를 안내해 드릴게요.\n' +
    '문자·메일이 오지 않으면 스팸함도 한번 확인해 주세요.'
  );

  // ── 1. 기본 정보 ─────────────────────────────
  form.addSectionHeaderItem()
    .setTitle('1. 기본 정보')
    .setHelpText('상담 일정 안내에만 사용합니다.');

  form.addTextItem().setTitle('성함').setRequired(true);

  form.addTextItem()
    .setTitle('휴대폰 번호')
    .setHelpText('예: 010-1234-5678')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .setHelpText('010-1234-5678 형식으로 입력해 주세요.')
      .requireTextMatchesPattern('^01[016789]-?\\d{3,4}-?\\d{4}$')
      .build());

  form.addTextItem()
    .setTitle('이메일')
    .setHelpText('ZOOM 링크를 보내 드릴 주소입니다.')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .setHelpText('이메일 주소 형식으로 입력해 주세요.')
      .requireTextIsEmail()
      .build());

  // ── 2. 활동 분야 ─────────────────────────────
  form.addPageBreakItem().setTitle('2. 지원하려는 곳과 강좌');

  form.addCheckboxItem()
    .setTitle('지원하려는(지원했던) 기관을 모두 골라 주세요.')
    .setChoiceValues([
      '대학 부설 평생교육원',
      '시·군·구 평생학습관',
      '주민자치센터·행정복지센터',
      '공공도서관',
      '여성인력개발센터·여성회관',
      '백화점·마트 문화센터',
      '아직 정하지 못했어요',
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addTextItem()
    .setTitle('개설하고 싶은 강좌(주제)')
    .setHelpText('예: 스마트폰 활용, 캘리그라피, 생성형 AI 활용, 노후 재무설계 등')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('지금 지원 상황은 어떠세요?')
    .setChoiceValues([
      '처음 알아보는 중이에요',
      '지원서를 쓰고 있어요',
      '지원했는데 떨어졌어요',
      '이미 출강 중인데 다른 곳에도 지원하려고 해요',
    ])
    .setRequired(true);

  form.addTextItem()
    .setTitle('지원 마감일 (알고 계시면)')
    .setHelpText('예: 11월 30일. 마감이 가까운 분부터 먼저 일정을 잡아 드려요.');

  form.addMultipleChoiceItem()
    .setTitle('강의 경력')
    .setChoiceValues(['준비 중 (아직 출강 경험 없음)', '1년 미만', '1~3년', '3~5년', '5년 이상'])
    .setRequired(true);

  // ── 3. 고민 ─────────────────────────────────
  form.addPageBreakItem().setTitle('3. 어디서 막히셨나요?');

  form.addCheckboxItem()
    .setTitle('지원서에서 막히는 부분을 모두 골라 주세요.')
    .setChoiceValues([
      '강사 이력서·경력 정리',
      '자기소개서·강사 소개글',
      '강의계획서 (주차별 수업 계획)',
      '강좌명·강좌 소개글 (수강생 모집 문구)',
      '수강 대상·정원·수강료·재료비 정하기',
      '증빙 서류 (자격증·경력증명서 등)',
      '모집 공고 찾기·지원 일정 맞추기',
      '어떤 강좌로 지원할지 정하기',
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('상담 때 꼭 이야기하고 싶은 내용을 편하게 적어 주세요.')
    .setHelpText('예: 강의계획서 15주차를 어떻게 채울지 모르겠어요. 자세히 적어 주실수록 상담 전에 미리 준비해 둘 수 있어요. (선택)');

  // ── 4. 희망 일정 ─────────────────────────────
  form.addPageBreakItem().setTitle('4. 희망 일정');

  form.addCheckboxItem()
    .setTitle('11월 10일(화) 저녁, 가능한 시간을 모두 골라 주세요.')
    .setHelpText('1:1로 한 분씩 진행해서, 고르신 시간 안에서 정확한 상담 시각을 따로 알려 드려요.')
    .setChoiceValues([
      '7시대 (19:00~20:00)',
      '8시대 (20:00~21:00)',
      '9시 이후 (21:00~)',
      '아무 시간이나 괜찮아요',
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('ZOOM을 써 보신 적이 있나요?')
    .setChoiceValues(['네, 익숙해요', '몇 번 써 봤어요', '처음이에요 (접속 방법도 안내 부탁드려요)'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('이 모집 소식은 어디서 보셨나요?')
    .setChoiceValues(['홈페이지', '카카오톡 채널·단톡방', '카페·블로그', '지인 추천'])
    .showOtherOption(true);

  // ── 5. 개인정보 동의 ─────────────────────────
  form.addPageBreakItem().setTitle('5. 개인정보 수집·이용 동의');

  const who = SETTINGS.organizer ? `${SETTINGS.organizer}는(은) ` : '';
  form.addMultipleChoiceItem()
    .setTitle('개인정보 수집·이용에 동의하십니까?')
    .setHelpText([
      `${who}1:1 컨설팅 진행을 위해 아래와 같이 개인정보를 수집·이용합니다.`,
      '',
      '• 수집 항목: 성함, 휴대폰 번호, 이메일, 지원 기관·강좌·경력, 상담 희망 내용·일정',
      '• 이용 목적: 상담 신청 확인, 일정 조율, ZOOM 링크 안내, 상담 준비',
      `• 보유 기간: ${SETTINGS.retention} 파기`,
      '',
      '동의를 거부하실 수 있으나, 거부하시면 상담 신청이 어렵습니다.',
    ].join('\n'))
    .setChoiceValues(['동의합니다'])
    .setRequired(true);

  // ── 응답 시트 연결 ───────────────────────────
  const sheet = SpreadsheetApp.create('평생교육원 지원서 컨설팅 신청자 명단');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  const publishedUrl = form.getPublishedUrl();
  let shortUrl = publishedUrl;
  try { shortUrl = form.shortenFormUrl(publishedUrl); } catch (e) { /* 짧은 링크 실패 시 원래 링크 사용 */ }

  Logger.log('응답 링크(홈페이지·게시글에 붙이기): ' + shortUrl);
  Logger.log('폼 편집 링크: ' + form.getEditUrl());
  Logger.log('응답 시트: ' + sheet.getUrl());

  // ── 선착순 자동 마감 ─────────────────────────
  if (SETTINGS.maxResponses > 0) {
    form.setCustomClosedFormMessage(
      `${SETTINGS.capacity} 신청이 모두 마감되었습니다. 관심 가져 주셔서 감사합니다!\n` +
      '다음 일정이 생기면 홈페이지에서 다시 안내해 드릴게요.'
    );
    PropertiesService.getScriptProperties().setProperty('MAX_RESPONSES', String(SETTINGS.maxResponses));
    ScriptApp.newTrigger('closeWhenFull').forForm(form).onFormSubmit().create();
    Logger.log(`선착순 자동 마감: ${SETTINGS.maxResponses}명이 신청하면 폼이 닫힙니다.`);
  }
}

/** 신청이 들어올 때마다 실행된다. 정원이 차면 응답을 더 받지 않는다. */
function closeWhenFull(e) {
  const max = Number(PropertiesService.getScriptProperties().getProperty('MAX_RESPONSES') || 0);
  const form = e.source;
  if (max > 0 && form.getResponses().length >= max) {
    form.setAcceptingResponses(false);
  }
}
