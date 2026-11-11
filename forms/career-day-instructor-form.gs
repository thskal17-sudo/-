/**
 * 직업인 체험 강사 모집 구글 폼 자동 생성 스크립트
 *
 * 사용법: forms/README.md 참고
 *   1) https://script.google.com 에서 "새 프로젝트"
 *   2) 이 파일 내용을 전부 붙여 넣고 저장
 *   3) 위쪽 함수 선택에서 createCareerDayForm 고르고 "실행"
 *   4) 실행 로그에 나온 편집 링크로 들어가 "파일 업로드" 질문만 직접 추가
 *      (구글이 파일 업로드 질문은 스크립트로 만들 수 없게 막아 두었음)
 */

// ===== 여기만 고치면 폼 전체에 반영됩니다 =====
const EVENT_DATE = '2026. 12. 10.(금)';     // ※ 2026년 12월 10일은 실제로 목요일입니다. 확인 후 수정하세요.
const EVENT_TIME = '6~7교시 (정확한 시간은 확정 후 개별 안내)';
const SCHOOL = '김해 소재 중학교';
const FEE_PER_HOUR = 50000;                  // 시간(차시)당 강사료
const SESSIONS = 2;                          // 진행 차시
// ===========================================

const JOBS = {
  '3학년': ['뷰티케어전문가', '크리에이터', '청년창업가', '공예가', '제과제빵사', '드론'],
  '2학년': ['바리스타', '메이크업아티스트', '마술', '메디컬 분야', '스포츠전문가', '3D프린팅 전문가'],
  '1학년': ['제과제빵사', '요리사', '웹툰작가', '3D프린팅 전문가', '바리스타'],
};

function won(n) {
  return n.toLocaleString('ko-KR') + '원';
}

function createCareerDayForm() {
  const total = FEE_PER_HOUR * SESSIONS;

  const form = FormApp.create('[' + SCHOOL + '] 직업인 체험 강사 모집 신청서');
  form.setDescription([
    SCHOOL + '에서 학생들의 진로 탐색을 위한 직업인 체험 수업을 진행해 주실 분을 모십니다.',
    '',
    '■ 일시: ' + EVENT_DATE + ' ' + EVENT_TIME,
    '■ 장소: ' + SCHOOL + ' 각반 교실 및 특별실',
    '■ 진행: 이론 + 체험, ' + SESSIONS + '차시',
    '■ 대상: 학급당 약 26~28명',
    '■ 강사료: 시간당 ' + won(FEE_PER_HOUR) + ' × ' + SESSIONS + '차시 = ' + won(total),
    '',
    '※ 현직 직업인을 우선 섭외합니다.',
    '※ 학년별 수준에 맞춘 강의와 체험으로 구성해 주세요.',
  ].join('\n'));
  form.setConfirmationMessage('신청해 주셔서 감사합니다. 검토 후 입력하신 연락처로 안내드리겠습니다.');
  form.setAllowResponseEdits(true);

  // ---- 1. 기본 정보 ----
  form.addSectionHeaderItem().setTitle('1. 기본 정보');

  form.addTextItem().setTitle('성함').setRequired(true);

  form.addTextItem()
    .setTitle('연락처')
    .setHelpText('예: 010-1234-5678')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .requireTextMatchesPattern('^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$')
      .setHelpText('휴대폰 번호 형식으로 입력해 주세요. (예: 010-1234-5678)')
      .build());

  form.addTextItem()
    .setTitle('이메일')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .requireTextIsEmail()
      .setHelpText('올바른 이메일 주소를 입력해 주세요.')
      .build());

  form.addTextItem().setTitle('현재 직업 / 소속').setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('현직 여부')
    .setChoiceValues(['현직 종사자', '프리랜서 / 개인사업자', '전직 종사자'])
    .showOtherOption(true)
    .setRequired(true);

  // ---- 2. 희망 직업군 ----
  form.addPageBreakItem().setTitle('2. 희망 직업군');

  const jobChoices = [];
  Object.keys(JOBS).forEach(function (grade) {
    JOBS[grade].forEach(function (job) {
      jobChoices.push('[' + grade + '] ' + job);
    });
  });
  form.addCheckboxItem()
    .setTitle('진행 가능한 학년 / 직업군 (복수 선택 가능)')
    .setChoiceValues(jobChoices)
    .showOtherOption(true)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('관련 경력 사항')
    .setHelpText('경력 기간, 주요 활동, 보유 자격증 등을 적어 주세요.')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('학교 / 청소년 대상 강의 경험')
    .setChoiceValues(['있음', '없음'])
    .setRequired(true);

  // ---- 3. 수업 계획 ----
  form.addPageBreakItem()
    .setTitle('3. 수업 계획 (이론 + 체험, ' + SESSIONS + '차시)')
    .setHelpText('학급당 약 26~28명 기준으로 작성해 주세요.');

  form.addParagraphTextItem()
    .setTitle('이론 수업 내용')
    .setHelpText('직업 소개, 하는 일, 진로 경로 등')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('체험 활동 내용')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('준비물 / 재료 및 재료비 여부')
    .setHelpText('강사님이 준비하실 것과 학교에서 준비해야 할 것을 나눠 적어 주세요.');

  form.addParagraphTextItem()
    .setTitle('필요한 시설 / 기자재')
    .setHelpText('예: 빔프로젝터, 개수대, 콘센트, 오븐, 넓은 공간 등');

  // ---- 4. 일정 확인 및 동의 ----
  form.addPageBreakItem().setTitle('4. 일정 확인 및 동의');

  form.addMultipleChoiceItem()
    .setTitle(EVENT_DATE + ' ' + EVENT_TIME.replace(/\s*\(.*\)$/, '') + ' 참여 가능 여부')
    .setChoiceValues(['가능', '시간 조정이 필요함', '불가능'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('강사료 확인')
    .setHelpText('시간당 ' + won(FEE_PER_HOUR) + ' × ' + SESSIONS + '차시 = ' + won(total))
    .setChoiceValues(['확인했습니다'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('개인정보 수집·이용 동의')
    .setHelpText([
      '수집 항목: 성함, 연락처, 이메일, 직업/소속, 경력 사항, 제출 파일',
      '수집 목적: 직업인 체험 강사 선정 및 연락',
      '보유 기간: 행사 종료 후 지체 없이 파기',
      '동의를 거부할 수 있으나, 거부 시 신청이 어렵습니다.',
    ].join('\n'))
    .setChoiceValues(['동의합니다'])
    .setRequired(true);

  form.addParagraphTextItem().setTitle('기타 문의 / 요청 사항');

  Logger.log('폼 편집 링크: ' + form.getEditUrl());
  Logger.log('응답자용 링크: ' + form.getPublishedUrl());
  Logger.log('다음 단계: 편집 링크에서 "3. 수업 계획" 섹션 끝에 "파일 업로드" 질문을 직접 추가하세요. (forms/README.md 참고)');
}
