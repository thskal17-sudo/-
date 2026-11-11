/**
 * 직업인 체험 강사 모집 구글 폼 자동 생성 스크립트
 *
 * 사용법: forms/README.md 참고
 *   1) 강사 서류 양식(한글 파일)을 내 구글 드라이브에 올리고 공유 링크 복사
 *   2) https://script.google.com 에서 "새 프로젝트" → 이 파일 내용 전부 붙여 넣기
 *   3) 아래 TEMPLATE_FILE_URL 에 1)의 링크 붙여 넣고 저장
 *   4) 함수 선택에서 createCareerDayForm 고르고 "실행"
 *   5) 실행 로그의 편집 링크로 들어가 "파일 업로드" 질문만 직접 추가
 *      (구글이 파일 업로드 질문은 스크립트로 만들 수 없게 막아 두었음)
 */

// ===== 여기만 고치면 폼 전체에 반영됩니다 =====
const TEMPLATE_FILE_URL = '';                // 구글 드라이브에 올린 서류 양식(한글 파일)의 링크
const EVENT_DATE = '2026. 12. 10.(목)';
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

/** 드라이브 링크에서 파일 ID를 뽑아 "링크가 있는 모든 사용자 보기"로 공유하고 바로 받기 링크를 돌려준다. */
function templateDownloadUrl() {
  const m = TEMPLATE_FILE_URL.match(/[-\w]{25,}/);
  if (!m) {
    throw new Error('TEMPLATE_FILE_URL 이 비어 있거나 올바른 구글 드라이브 링크가 아닙니다. 서류 양식을 드라이브에 올린 뒤 링크를 붙여 넣으세요.');
  }
  const file = DriveApp.getFileById(m[0]);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('주의: 양식 파일 공유 설정을 바꾸지 못했습니다(' + e.message + '). 드라이브에서 "링크가 있는 모든 사용자 - 뷰어"로 직접 바꿔 주세요.');
  }
  return 'https://drive.google.com/uc?export=download&id=' + m[0];
}

function createCareerDayForm() {
  const total = FEE_PER_HOUR * SESSIONS;
  const templateUrl = templateDownloadUrl();

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
    '■ 제출 서류 양식 (한글 파일) 내려받기',
    templateUrl,
    '  - 강사 이력카드, 강의계획서, 신분증·통장사본·자격증, 개인정보 수집 및 이용 동의서',
    '  - 작성 후 이 신청서의 "서류 제출" 단계에서 업로드해 주세요.',
    '',
    '※ 현직 직업인을 우선 섭외합니다.',
    '※ 학년별 수준에 맞춘 강의와 체험으로 구성해 주세요.',
  ].join('\n'));
  form.setConfirmationMessage('신청해 주셔서 감사합니다. 제출하신 서류 검토 후 입력하신 연락처로 안내드리겠습니다.');
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

  // ---- 3. 서류 제출 (파일 업로드 질문은 이 섹션에 직접 추가) ----
  form.addPageBreakItem()
    .setTitle('3. 서류 제출 (강사 이력카드 · 강의계획서)')
    .setHelpText([
      '첨부파일 확인하여 업로드해주세요.',
      '',
      '양식 내려받기: ' + templateUrl,
      '',
      '양식 안의 강사 이력카드, 강의계획서(' + SESSIONS + '차시, 이론 + 체험), 신분증·통장사본·자격증, ' +
        '개인정보 수집 및 이용 동의서를 모두 작성해 업로드해 주세요.',
    ].join('\n'));

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
      '수집 항목: 성함, 연락처, 이메일, 직업/소속, 제출 서류',
      '수집 목적: 직업인 체험 강사 선정 및 연락',
      '보유 기간: 제출 서류의 개인정보 수집 및 이용 동의서에 따름',
      '동의를 거부할 수 있으나, 거부 시 신청이 어렵습니다.',
    ].join('\n'))
    .setChoiceValues(['동의합니다'])
    .setRequired(true);

  form.addParagraphTextItem().setTitle('기타 문의 / 요청 사항');

  Logger.log('폼 편집 링크: ' + form.getEditUrl());
  Logger.log('응답자용 링크: ' + form.getPublishedUrl());
  Logger.log('다음 단계: 편집 링크에서 "3. 서류 제출" 섹션에 "파일 업로드" 질문을 직접 추가하세요. (forms/README.md 참고)');
}
