# 네이버 스마트스토어 썸네일·상세페이지 자동 생성 시스템 설계

작성일: 2026-09-21 (2차 수정: 판매 품목을 교육 자료로 확정)

## 1. 판매 품목과 목표

**판매 품목**: 교사·강사·학원 등 교육관계자에게 파는 강의교안(PPT/PDF), 활동지·학습지(PDF/HWP), 수업 자료 묶음.
실물 사진이 없고 **판매하는 파일 자체가 이미지의 원천**이라는 점이 일반 공산품과 가장 크게 다르다.

상품 파일을 넣으면 다음 산출물이 자동으로 나오는 파이프라인을 만든다.

| 산출물 | 규격 | 비고 |
|---|---|---|
| 대표 이미지(썸네일) | 1000×1000 정사각형 | 표지 + 펼쳐진 내지 목업. 시리즈 전체가 같은 틀을 공유 |
| 추가 이미지 | 1000×1000, 최대 9장 | 학년·과목·자료유형 배지, 구성 요약, 미리보기 페이지 |
| 상세페이지 | 가로 860px 이미지 여러 장 | 대상·구성·미리보기·활용법·이용범위·전달방식 순서 |
| 상품명·태그·검색 키워드 | 텍스트 | 학년, 과목, 단원, 자료 유형이 검색의 핵심 |
| 미리보기 샘플 PDF | 워터마크 삽입 | 상세페이지 미리보기와 별도로 고객에게 보여줄 수 있는 샘플 |

핵심 원칙 세 가지.

1. **상품 파일을 읽어서 모든 것을 만든다.** 페이지 수, 목차, 학년·과목, 성취기준, 정답 포함 여부를 사람이 입력하지 않고 파일에서 뽑는다. Claude가 PDF를 직접 읽고 구조화 JSON을 만든다.
2. **글자가 들어가는 이미지는 HTML 템플릿으로 렌더링한다.** 생성형 이미지 모델은 쓰지 않는다. 한글 오타·폰트 깨짐이 없고, 시리즈 수백 건이 같은 브랜드 룩을 유지한다.
3. **등록 전에 사람 검수 단계를 둔다.** 교육 자료는 광고 표현보다 저작권(교과서 지문·삽화·폰트)과 교육과정 표기 정확성이 리스크다.

## 2. 전체 파이프라인

```
[입력]                 [분석·생성]                     [렌더링]                  [검수]               [등록]
교안.pptx/활동지.pdf ─► LibreOffice → PDF 통일  ─►  Jinja2 HTML 템플릿   ─►  Claude 비전 QA   ─►  커머스 API
meta.yaml(선택)     ─► PyMuPDF: 페이지 이미지   ─►  Playwright 스크린샷  ─►  저작권/규격 검사  ─►  또는 ZIP
                    ─► Claude: 내용 분석 JSON   ─►  Pillow 목업 합성·분할     사람 승인 UI
                    ─► 워터마크 샘플 PDF
```

### 2.1 입력 (Ingest)

- 상품 한 건은 `products/<sku>/` 폴더 하나. 안에 원본 파일(`source.pptx`, `source.pdf`, `source.hwp`)과 선택 사항인 `meta.yaml` 을 둔다.
- `meta.yaml` 에는 파일에서 뽑기 어려운 것만 적는다. 가격, 옵션(단품/단원 묶음/학기 전체), 시리즈 이름, 전달 방식. 나머지는 자동 추출한다.
- 형식 통일: PPTX·HWPX·DOCX 는 LibreOffice headless 로 PDF 로 변환한다. 구형 HWP 는 변환 품질이 불안정하므로 판매자가 HWP 를 PDF 로 저장해 함께 넣는 것을 기본 규칙으로 한다.
- PyMuPDF 로 전체 페이지를 PNG(150dpi)로 뽑고, 텍스트 레이어도 추출해둔다.

자동 추출 스키마 `MaterialProfile` (pydantic).

```json
{
  "sku": "KO-5-1-01",
  "material_type": "활동지",           // 활동지 | 교안(PPT) | 교사용 지도안 | 평가지 | 묶음
  "school_level": "초등",              // 초등 | 중등 | 고등 | 성인/학원
  "grade": "5학년",
  "subject": "국어",
  "unit": "1단원 대화와 공감",
  "curriculum": "2022 개정",
  "achievement_codes": ["[6국01-02]"],
  "page_count": 12,
  "has_answer_key": true,
  "file_formats": ["PDF", "HWP"],
  "editable": true,
  "toc": ["활동1 ...", "활동2 ..."],
  "lesson_flow": ["도입 5분", "전개 30분", "정리 5분"],
  "preview_pages": [1, 3, 7],          // Claude가 고른 대표 페이지
  "license_scope": "구매자 본인 수업 내 사용, 재배포·2차 판매 금지"
}
```

### 2.2 분석·생성 (Analyze & Generate)

**1단계 – 내용 분석.** PDF 를 Claude 에 `document` 블록으로 넣고 `MaterialProfile` 을 구조화 출력으로 받는다. 100 페이지가 넘는 묶음 상품은 Files API 로 한 번 올려두고 재사용한다. 이 단계에서 다음도 함께 받는다.

- `copyright_flags`: 교과서 지문·삽화·유명 캐릭터·출처 불명 사진으로 보이는 페이지 번호와 이유
- `quality_notes`: 오타, 빈 페이지, 정답지 누락 의심

**2단계 – 카피·구조 생성.** `MaterialProfile` 을 입력으로 `ContentPlan` 을 받는다.

- `product_name`: 네이버 검색용 상품명 (예: `초등 5학년 국어 1단원 활동지 대화와 공감 12쪽 정답포함 PDF`). 학년·과목·단원·자료유형·형식 순서, 50자 이내.
- `search_tags`: 10개. 학년, 과목, 단원명, 자료유형, 교육과정, "수업자료", "학습지" 등.
- `thumbnail`: `{badge_top: "초등 5학년 국어", title: "대화와 공감 활동지", sub: "12쪽 · 정답 포함 · PDF/HWP"}`
- `sections`: 상세페이지 섹션. 교육 자료 전용 타입을 쓴다.
  - `hero` 훅 (누구에게 무엇을 해결해주는 자료인지 한 줄)
  - `target` 대상 학년·과목·단원·성취기준
  - `composition` 구성 표 (페이지 수, 활동 목록, 정답지, 파일 형식, 편집 가능 여부)
  - `preview` 미리보기 페이지 3~4장 (워터마크)
  - `lesson_flow` 수업 활용 흐름 (차시·시간 배분)
  - `teacher_tips` 교사용 팁·변형 활용
  - `series` 같은 시리즈 다른 단원 안내
  - `license` 이용 범위·금지 사항
  - `delivery_refund` 전달 방식, 디지털 상품 환불 규정 안내
  - `faq`
- `compliance_flags`: 과장 표현("성적 보장", "100% 향상"), 특정 교과서 출판사명 오용 등

카테고리별 가이드는 시스템 프롬프트에 넣고 캐시한다. 학교급(초·중·고)과 자료 유형(활동지·교안·평가지)별로 톤과 강조점이 다르므로 가이드를 분리한다.

**3단계 – 미리보기 자산.** 선택된 페이지에 대각선 워터마크(스토어명)를 넣은 PNG 와, 같은 페이지만 묶은 샘플 PDF 를 만든다. 전체 페이지는 절대 상세페이지에 올리지 않는다(무단 복제 방지).

### 2.3 렌더링 (Render)

**썸네일(대표 이미지).** 표지 페이지 PNG 를 HTML 목업 템플릿에 넣는다. 종류를 3개 준비한다.

- `stack`: 표지 정면 + 뒤로 겹친 내지 2장
- `fan`: 표지 + 옆으로 펼친 내지 3장 (활동지용)
- `screen`: 노트북/태블릿 화면 안의 슬라이드 (교안 PPT용)

과목별 색을 테마로 고정한다(국어 빨강, 수학 파랑 등). 시리즈 상품이 검색 결과에 나란히 떴을 때 같은 브랜드로 보이는 것이 클릭률에 유리하다.
대표 이미지에는 별도 문구를 얹지 않는다. 표지에 이미 제목이 있고, 네이버쇼핑 대표 이미지 텍스트 규제를 피한다. 학년·과목 배지가 들어간 버전은 추가 이미지 1번으로 넣는다.

**상세페이지.** 섹션 타입마다 `templates/sections/<type>.html` 하나. Playwright 로 860px 폭, DPR 2 캡처 후 섹션 경계에서 세로 2,000px 이하로 분할한다.

**폰트.** 상업 이용이 허용된 폰트만 번들한다(Pretendard, Noto Sans KR, 교육용으로 어울리는 나눔스퀘어 등). 원본 자료에 쓰인 폰트 라이선스는 판매자 책임이므로 검수 항목에 넣는다.

산출물은 `products/<sku>/out/` 아래에 `thumb_main.jpg`, `thumb_01..09.jpg`, `detail_01..N.jpg`, `sample_preview.pdf`, `content_plan.json`, `material_profile.json`, `product_name.txt` 로 저장한다.

### 2.4 검수 (QA)

자동 검수 세 겹.

1. **규칙 기반**: 이미지 규격, 대표 이미지 텍스트 없음, 금칙어(성적 보장, 100%, 최고 등), 미리보기 페이지 수 상한(전체의 30% 이하), 워터마크 존재 여부, 디지털 상품 환불 고지 문구 포함 여부.
2. **Claude 비전 검수**: 렌더링된 이미지를 넣고 글자 잘림·겹침·오타, `MaterialProfile` 과의 불일치(페이지 수, 학년), 저작권 의심 삽화를 JSON 으로 받는다. 실패 시 생성 단계로 되돌린다(최대 2회).
3. **사람 승인**: 웹 UI 에서 상품별 산출물과 `copyright_flags` 를 보고 승인·수정·재생성. **저작권 플래그가 하나라도 있으면 승인 버튼을 잠근다.** 판매자가 확인 체크를 해야 풀린다.

### 2.5 등록 (Publish)

- **수동 경로(1차)**: 승인 산출물을 ZIP 으로 내려받아 스마트스토어 센터에 업로드.
- **API 경로(2차)**: 커머스 API 로 이미지 업로드 후 상품 등록.
- **전달 방식**: 디지털 파일 판매는 결제 후 파일 전달(이메일·네이버 톡톡·다운로드 링크)이다. 스마트스토어의 디지털 상품 등록 방식과 카테고리는 판매자 센터 최신 정책을 확인해 `publish/naver_commerce.py` 상수로 고정한다. 인쇄본 옵션을 함께 팔 경우 배송 정보가 추가된다.
- **환불 고지**: 디지털 콘텐츠는 제공이 시작되면 청약철회가 제한될 수 있으므로 상세페이지 `delivery_refund` 섹션과 상품 등록 폼 양쪽에 고지 문구를 넣는다. 문구는 법률 검토를 받은 것을 템플릿 상수로 둔다.

## 3. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | Python 3.12 | PDF 처리·LLM SDK·브라우저 자동화가 모두 갖춰짐 |
| 문서 변환 | LibreOffice headless | PPTX/DOCX/HWPX → PDF |
| PDF 처리 | PyMuPDF (fitz) | 페이지 렌더, 텍스트 추출, 워터마크 삽입, 샘플 PDF 생성 |
| LLM | Anthropic SDK, `claude-opus-5` | PDF 문서 입력, 구조화 출력, 비전 검수, 프롬프트 캐시 |
| 템플릿 | Jinja2 + CSS | 디자이너가 HTML/CSS 만으로 수정 가능 |
| 렌더 | Playwright (Chromium) | 폰트·레이아웃 정확도 |
| 이미지 | Pillow | 목업 합성, 분할, JPG 최적화 |
| 스키마 | pydantic v2 | 입력 검증과 LLM 출력 파싱 공용 |
| 검수 UI | FastAPI + HTMX | 로컬 승인 도구 |
| 실행 | CLI (`typer`) | 1차는 순차 처리 |

## 4. 저장소 구조 (제안)

```
.
├── docs/DESIGN.md
├── pyproject.toml
├── src/edugen/
│   ├── schemas.py            # MaterialProfile, ContentPlan, QAReport
│   ├── ingest/
│   │   ├── convert.py        # LibreOffice → PDF
│   │   └── pages.py          # PyMuPDF 페이지 PNG·텍스트
│   ├── analyze/
│   │   ├── profile.py        # Claude: PDF → MaterialProfile
│   │   └── prompts/
│   ├── generate/
│   │   ├── copy.py           # Claude: MaterialProfile → ContentPlan
│   │   ├── preview.py        # 워터마크 PNG, 샘플 PDF
│   │   └── prompts/
│   ├── render/
│   │   ├── html.py
│   │   ├── capture.py
│   │   ├── mockup.py         # 표지 목업 합성
│   │   └── slice.py
│   ├── qa/
│   │   ├── rules.py
│   │   ├── vision.py
│   │   └── banned_terms.yaml
│   ├── publish/
│   │   ├── zip.py
│   │   └── naver_commerce.py
│   ├── review/               # FastAPI 승인 UI
│   └── cli.py
├── templates/
│   ├── thumbnails/{stack,fan,screen}.html
│   ├── sections/*.html
│   └── themes/subject_*.css
├── fonts/
├── products/<sku>/{source.*, meta.yaml, pages/, out/}
└── tests/
```

## 5. 핵심 코드 형태

PDF 를 읽어 `MaterialProfile` 을 뽑는 호출. 문서 블록과 구조화 출력을 쓴다.

```python
import base64
import anthropic
from edugen.schemas import MaterialProfile

client = anthropic.Anthropic()

def analyze(pdf_path: str, guide: str) -> MaterialProfile:
    data = base64.standard_b64encode(open(pdf_path, "rb").read()).decode()
    response = client.messages.parse(
        model="claude-opus-5",
        max_tokens=16000,
        system=[
            {"type": "text", "text": BASE_SYSTEM_PROMPT},
            {"type": "text", "text": guide,
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{
            "role": "user",
            "content": [
                {"type": "document",
                 "source": {"type": "base64",
                            "media_type": "application/pdf",
                            "data": data}},
                {"type": "text",
                 "text": "이 교육 자료를 분석해 MaterialProfile 을 채워라. "
                         "저작권이 의심되는 페이지는 copyright_flags 에 번호와 이유를 적어라."},
            ],
        }],
        output_format=MaterialProfile,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("모델이 요청을 거부함")
    return response.parsed_output
```

카피 생성은 같은 형태로 `MaterialProfile` JSON 을 넣고 `ContentPlan` 을 받는다. 비전 검수는 렌더링된 JPG 를 `image` 블록으로 넣고 `QAReport` 를 받는다.

## 6. 단계별 추진 계획

| 단계 | 기간 | 산출 | 완료 기준 |
|---|---|---|---|
| 0. 준비 | 1주 | 실제 자료 5건(활동지 3, 교안 2), 썸네일 목업 3종·섹션 템플릿 8종 수동 디자인, 스키마 확정 | 손으로 채운 HTML 이 860px 에서 보기 좋다 |
| 1. 파일 처리 | 1주 | 변환, 페이지 추출, 워터마크, 샘플 PDF, 목업 합성 | CLI 한 번에 썸네일 3종이 나온다 |
| 2. Claude 분석·생성 | 1주 | `MaterialProfile`, `ContentPlan`, 상세페이지 렌더 | 5건 중 4건 이상 수정 없이 승인 가능 |
| 3. 검수 UI + ZIP | 1주 | 승인 화면, 저작권 플래그 잠금, ZIP | 실제 스토어에 1건 등록 |
| 4. 커머스 API | 1~2주 | 자동 등록, 시리즈 일괄 등록 | 승인 클릭 → 스토어 반영 |
| 5. 고도화 | 지속 | 클릭률 기반 목업 A/B, 시리즈 묶음 자동 생성, 학기별 신규 단원 일괄 처리 | 성과 데이터 반영 |

단계 3 까지 끝나면 실무에 바로 쓸 수 있다.

## 7. 비용 추정 (상품 1건, 12쪽 기준)

| 항목 | 비용 |
|---|---|
| PDF 분석 (12쪽 문서 입력 + 출력 2K) | 약 $0.15 |
| 카피 생성 (입력 3K, 출력 3K) | 약 $0.10 |
| 비전 검수 (이미지 8장 + 출력 1K) | 약 $0.08 |

건당 $0.3~0.4. 페이지 수에 비례해 분석 비용이 늘어난다. 학기 초 일괄 처리는 Batch API 로 절반 가격에 돌린다.

## 8. 위험 요소와 대응

- **저작권**: 교과서 지문·삽화, 출처 불명 이미지, 상업 이용 불가 폰트가 가장 큰 리스크다. Claude 분석 단계에서 플래그를 뽑고, 플래그가 있으면 승인 잠금. 판매자용 체크리스트(폰트 라이선스, 이미지 출처)를 `meta.yaml` 필수 항목으로 둔다.
- **무단 복제**: 미리보기는 전체의 30% 이하, 워터마크 필수, 정답지 페이지는 미리보기에서 제외.
- **교육과정 표기 오류**: 성취기준 코드는 Claude 가 추측하지 않도록 "자료에 명시된 것만 적고 없으면 비워라" 로 지시한다. 개정 교육과정 코드표를 `analyze/curriculum_codes.yaml` 로 두고 규칙 검사에서 대조한다.
- **HWP 변환 품질**: 판매자가 PDF 를 함께 제공하는 것을 규칙으로. HWP 는 파일 형식 표기용으로만 쓴다.
- **디지털 상품 정책**: 네이버 스마트스토어의 디지털 상품 카테고리·전달·환불 정책은 변경될 수 있으므로 상수 한 곳(`publish/policy.py`)에 모아 관리한다.
- **템플릿 단조로움**: 시리즈는 통일이 장점이지만 다른 시리즈끼리는 목업 종류·과목 색으로 차이를 준다.

## 9. 확정된 가정

1. 구현 언어는 Python.
2. 판매 품목은 강의교안·활동지 등 디지털 문서. 실물 사진 처리(누끼 등)는 범위에서 제외. 인쇄본 옵션은 배송 정보만 추가.
3. 생성형 이미지 모델은 쓰지 않는다. 모든 이미지는 원본 페이지 + HTML 템플릿에서 나온다.
4. 등록은 1차 수동(ZIP), 2차 커머스 API.
5. 스마트스토어의 디지털 상품 등록·전달 방식은 단계 0 에서 판매자 센터 최신 정책으로 확정한다.
