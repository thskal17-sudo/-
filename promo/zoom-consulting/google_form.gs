/**
 * 1:1 ZOOM 컨설팅 신청서(구글폼) 자동 생성 스크립트
 *
 * 쓰는 법
 *   1. https://script.google.com 접속 → [새 프로젝트]
 *   2. 기본 코드를 모두 지우고 이 파일 내용을 붙여넣기
 *   3. 위쪽 함수 선택에서 createConsultingForm 고르고 [실행]
 *   4. 처음 한 번 권한 허용 (내 구글 드라이브에 폼·시트를 만드는 권한)
 *   5. [실행 로그]에 나온 "응답 링크"를 홈페이지·게시글에 붙이면 끝
 *
 * 만들어지는 것
 *   - 구글폼 "1:1 ZOOM 컨설팅 신청서" (내 드라이브)
 *   - 응답이 쌓이는 구글 시트 "1:1 ZOOM 컨설팅 신청자 명단"
 *
 * 아래 SETTINGS 의 ○ 칸을 채운 뒤 실행하면 폼 안내문에 그대로 들어간다.
 * 비워 두면 해당 줄은 빠진다.
 */
const SETTINGS = {
  title: '1:1 ZOOM 컨설팅 신청서',
  period: '',        // 예: '11월 17일(월) ~ 11월 28일(금)'
  duration: '',      // 예: '1인 40분'
  capacity: '',      // 예: '선착순 10명'
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
    '강사님, 요즘 많이 힘드시죠?',
    '지원하시는 분야에서 막히는 부분을 1:1로 듣고 함께 방향을 찾는 컨설팅입니다.',
    '',
    '■ 진행 방식: ZOOM 온라인 1:1',
    ...info,
    '',
    '신청서를 남겨 주시면 확인 후 개별 연락으로 일정과 ZOOM 링크를 보내 드립니다.',
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
  form.addPageBreakItem().setTitle('2. 활동·지원 분야');

  form.addCheckboxItem()
    .setTitle('지원(활동)하시는 분야를 모두 골라 주세요.')
    .setChoiceValues([
      '초·중·고 학교 (방과후·자유학기·진로 등)',
      '기업·HRD 교육',
      '공공기관·지자체',
      '평생교육·문화센터',
      '대학·청소년 기관',
      '온라인 강의·VOD',
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addTextItem()
    .setTitle('주 강의 주제')
    .setHelpText('예: 진로·직업, AI 활용, 스피치, 리더십, 코딩 등')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('강사 활동 경력')
    .setChoiceValues(['준비 중 (아직 출강 경험 없음)', '1년 미만', '1~3년', '3~5년', '5년 이상'])
    .setRequired(true);

  // ── 3. 고민 ─────────────────────────────────
  form.addPageBreakItem().setTitle('3. 어떤 점이 가장 힘드세요?');

  form.addCheckboxItem()
    .setTitle('요즘 가장 고민되는 부분을 모두 골라 주세요.')
    .setChoiceValues([
      '어떤 분야로 지원할지 정하기',
      '강사 이력서·프로필 작성',
      '강의 제안서·계획서 작성',
      '출강처 찾기·기관 섭외',
      '강의 기획·커리큘럼 구성',
      '강의 자료(PPT·교안) 만들기',
      '강의 진행·수강생 반응',
      '강의료·계약',
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('상담 때 꼭 이야기하고 싶은 내용을 편하게 적어 주세요.')
    .setHelpText('자세히 적어 주실수록 상담 전에 미리 준비해 둘 수 있어요. (선택)');

  // ── 4. 희망 일정 ─────────────────────────────
  form.addPageBreakItem().setTitle('4. 희망 일정');

  form.addCheckboxItem()
    .setTitle('상담 가능한 요일')
    .setChoiceValues(['월', '화', '수', '목', '금', '토'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('상담 가능한 시간대')
    .setChoiceValues([
      '오전 (10:00~12:00)',
      '오후 (13:00~15:00)',
      '오후 (15:00~18:00)',
      '저녁 (19:00~21:00)',
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
      '• 수집 항목: 성함, 휴대폰 번호, 이메일, 활동 분야·경력, 상담 희망 내용·일정',
      '• 이용 목적: 상담 신청 확인, 일정 조율, ZOOM 링크 안내, 상담 준비',
      `• 보유 기간: ${SETTINGS.retention} 파기`,
      '',
      '동의를 거부하실 수 있으나, 거부하시면 상담 신청이 어렵습니다.',
    ].join('\n'))
    .setChoiceValues(['동의합니다'])
    .setRequired(true);

  // ── 응답 시트 연결 ───────────────────────────
  const sheet = SpreadsheetApp.create('1:1 ZOOM 컨설팅 신청자 명단');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  const publishedUrl = form.getPublishedUrl();
  let shortUrl = publishedUrl;
  try { shortUrl = form.shortenFormUrl(publishedUrl); } catch (e) { /* 짧은 링크 실패 시 원래 링크 사용 */ }

  Logger.log('응답 링크(홈페이지·게시글에 붙이기): ' + shortUrl);
  Logger.log('폼 편집 링크: ' + form.getEditUrl());
  Logger.log('응답 시트: ' + sheet.getUrl());
}
