/**
 * 평생교육원 지원서 1:1 ZOOM 컨설팅 - 신청자 구글폼 만들기
 *
 * ▶ 쓰는 법
 *   1. https://script.google.com 접속 → [+ 새 프로젝트]
 *   2. 편집창의 기본 코드를 모두 지우고 이 파일 내용을 전부 붙여넣기 → 저장(Ctrl+S)
 *   3. 위쪽 함수 목록에서 createConsultingForm 을 고르고 [실행]
 *   4. 권한 허용: [권한 검토] → 계정 선택 → [고급] → [(프로젝트)로 이동] → [허용]
 *   5. 아래 [실행 로그]에 나온 "응답 링크"를 홈페이지 게시글에 붙이면 끝
 *
 * ▶ 만들어지는 것
 *   - 구글폼  "평생교육원 지원서 1:1 ZOOM 컨설팅 신청서"
 *   - 구글시트 "평생교육원 지원서 컨설팅 신청자 명단" (응답이 자동으로 쌓임)
 *   - 선착순 자동 마감 (정원이 차면 폼이 스스로 닫힘)
 *
 * ▶ 실수로 두 번 실행해도 폼이 또 생기지 않고, 처음 만든 폼의 링크를 다시 보여 준다.
 *   정말 새로 만들고 싶으면 forgetForm 을 한 번 실행한 뒤 createConsultingForm 을 실행한다.
 */

// ===== 여기만 고치면 된다 =====
const SETTINGS = {
  title: '평생교육원 지원서 1:1 ZOOM 컨설팅 신청서',
  sheetName: '평생교육원 지원서 컨설팅 신청자 명단',
  dateText: '11월 10일(화)',
  timeText: '19:00 ~ 20:40',
  minutesPerPerson: 20,
  slots: ['19:00 ~ 19:20', '19:20 ~ 19:40', '19:40 ~ 20:00', '20:00 ~ 20:20', '20:20 ~ 20:40'],
  maxResponses: 5,      // 선착순 인원. 이 수만큼 신청이 들어오면 폼이 자동 마감된다 (0 이면 자동 마감 안 함)
  fee: '',              // 비용. 예: '무료' (비워 두면 안내문에서 빠짐)
  organizer: '',        // 개인정보 동의문에 들어갈 운영 기관명. 예: '○○교육원' (비워 두면 빠짐)
  retention: '상담 종료 후 6개월',
};
// ==============================

function createConsultingForm() {
  const props = PropertiesService.getScriptProperties();

  // 이미 만든 폼이 있으면 새로 만들지 않고 링크만 다시 보여 준다
  const existingId = props.getProperty('FORM_ID');
  if (existingId) {
    try {
      const old = FormApp.openById(existingId);
      Logger.log('이미 만든 신청서가 있어서 새로 만들지 않았어요. 아래 링크를 쓰세요.');
      logLinks_(old);
      return;
    } catch (e) {
      props.deleteProperty('FORM_ID'); // 폼을 지운 경우: 새로 만든다
    }
  }

  const capacityText = SETTINGS.maxResponses > 0 ? `선착순 ${SETTINGS.maxResponses}명` : '';
  const form = FormApp.create(SETTINGS.title);

  // ── 폼 안내문 ───────────────────────────────
  form.setDescription([
    '평생교육원 지원서, 어디서 막히셨나요?',
    '강의계획서·강사 이력서·강좌 소개글 등 지원서를 쓰다 막히는 부분을',
    'ZOOM으로 1:1로 함께 보면서 해결해 드립니다.',
    '',
    `■ 일정: ${SETTINGS.dateText} ${SETTINGS.timeText}`,
    `■ 진행: ZOOM 온라인 1:1, 1인 ${SETTINGS.minutesPerPerson}분`,
    capacityText ? `■ 모집: ${capacityText}` : null,
    SETTINGS.fee ? `■ 비용: ${SETTINGS.fee}` : null,
    '',
    '신청서를 남겨 주시면 확인 후 개별 연락으로 상담 시각과 ZOOM 링크를 보내 드립니다.',
    '상담 때 작성 중인 지원서를 화면 공유해 주시면 더 구체적으로 봐 드릴 수 있어요.',
    '작성은 2~3분이면 충분합니다.',
  ].filter(line => line !== null).join('\n'));

  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(
    '신청이 접수되었습니다. 감사합니다!\n' +
    `${SETTINGS.dateText} 상담 시각과 ZOOM 링크를 남겨 주신 연락처로 보내 드릴게요.\n` +
    '문자·메일이 오지 않으면 스팸함도 한번 확인해 주세요.'
  );

  // ── 1. 기본 정보 ───────────────────────────
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
      .requireTextMatchesPattern('^01[016789]-?[0-9]{3,4}-?[0-9]{4}$')
      .build());

  form.addTextItem()
    .setTitle('이메일')
    .setHelpText('ZOOM 링크를 보내 드릴 주소입니다.')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .setHelpText('이메일 주소 형식으로 입력해 주세요.')
      .requireTextIsEmail()
      .build());

  // ── 2. 지원하려는 곳과 강좌 ─────────────────
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
    .setHelpText('예: 11월 30일. 마감에 맞춰 무엇부터 고칠지 함께 정해 드려요. (선택)');

  // ── 3. 막히는 부분 ──────────────────────────
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

  // ── 4. 희망 시간 ────────────────────────────
  form.addPageBreakItem().setTitle('4. 희망 시간');

  form.addCheckboxItem()
    .setTitle(`${SETTINGS.dateText} 저녁, 가능한 시간을 모두 골라 주세요.`)
    .setHelpText(`한 분당 ${SETTINGS.minutesPerPerson}분씩 진행해요. 고르신 시간 중에서 신청 순서대로 배정해 개별 연락드려요.`)
    .setChoiceValues(SETTINGS.slots.concat(['아무 시간이나 괜찮아요']))
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('ZOOM을 써 보신 적이 있나요?')
    .setChoiceValues(['네, 익숙해요', '몇 번 써 봤어요', '처음이에요 (접속 방법도 안내 부탁드려요)'])
    .setRequired(true);

  // ── 5. 개인정보 동의 ────────────────────────
  form.addPageBreakItem().setTitle('5. 개인정보 수집·이용 동의');

  const who = SETTINGS.organizer ? `${SETTINGS.organizer}는(은) ` : '';
  form.addMultipleChoiceItem()
    .setTitle('개인정보 수집·이용에 동의하십니까?')
    .setHelpText([
      `${who}1:1 컨설팅 진행을 위해 아래와 같이 개인정보를 수집·이용합니다.`,
      '',
      '• 수집 항목: 성함, 휴대폰 번호, 이메일, 지원 기관·강좌, 막히는 부분, 희망 시간',
      '• 이용 목적: 상담 신청 확인, 상담 시각 배정, ZOOM 링크 안내, 상담 준비',
      `• 보유 기간: ${SETTINGS.retention} 파기`,
      '',
      '동의를 거부하실 수 있으나, 거부하시면 상담 신청이 어렵습니다.',
    ].join('\n'))
    .setChoiceValues(['동의합니다'])
    .setRequired(true);

  // ── 응답 시트 연결 ──────────────────────────
  const sheet = SpreadsheetApp.create(SETTINGS.sheetName);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  // ── 선착순 자동 마감 ────────────────────────
  if (SETTINGS.maxResponses > 0) {
    form.setCustomClosedFormMessage(
      `${capacityText} 신청이 모두 마감되었습니다. 관심 가져 주셔서 감사합니다!\n` +
      '다음 일정이 생기면 홈페이지에서 다시 안내해 드릴게요.'
    );
    props.setProperty('MAX_RESPONSES', String(SETTINGS.maxResponses));
    ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === 'closeWhenFull')
      .forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('closeWhenFull').forForm(form).onFormSubmit().create();
  }

  props.setProperty('FORM_ID', form.getId());
  props.setProperty('SHEET_URL', sheet.getUrl());

  Logger.log('신청서를 만들었어요!');
  logLinks_(form);
}

/** 신청이 들어올 때마다 자동 실행된다. 정원이 차면 응답을 더 받지 않는다. */
function closeWhenFull(e) {
  const max = Number(PropertiesService.getScriptProperties().getProperty('MAX_RESPONSES') || 0);
  const form = e.source;
  if (max > 0 && form.getResponses().length >= max) {
    form.setAcceptingResponses(false);
  }
}

/** 기억해 둔 폼을 잊는다. 이걸 실행한 뒤 createConsultingForm 을 실행하면 폼을 새로 만든다. */
function forgetForm() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('FORM_ID');
  props.deleteProperty('SHEET_URL');
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'closeWhenFull')
    .forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('기억해 둔 폼을 지웠어요. 이제 createConsultingForm 을 실행하면 새로 만들어요.');
}

function logLinks_(form) {
  const published = form.getPublishedUrl();
  const sheetUrl = PropertiesService.getScriptProperties().getProperty('SHEET_URL') || '(폼 [응답] 탭에서 확인)';
  Logger.log('① 응답 링크 (홈페이지에 붙이기): ' + published);
  Logger.log('② 폼 편집 링크 (미리보기·수정): ' + form.getEditUrl());
  Logger.log('③ 신청자 명단 시트: ' + sheetUrl);
  if (SETTINGS.maxResponses > 0) {
    Logger.log(`선착순 자동 마감: ${SETTINGS.maxResponses}명이 신청하면 폼이 닫혀요. 테스트 응답은 꼭 지워 주세요.`);
  }
}
