# 네이버 스마트스토어 썸네일·상세페이지 자동 생성 시스템 설계

작성일: 2026-09-21

## 1. 목표와 범위

상품 정보(이름, 옵션, 가격, 특징, 원본 사진)를 넣으면 다음 산출물이 자동으로 나오는 파이프라인을 만든다.

| 산출물 | 규격 | 비고 |
|---|---|---|
| 대표 이미지(썸네일) | 1000×1000 JPG/PNG, 정사각형 | 네이버쇼핑 검색 노출용. 텍스트·도형·워터마크 없는 "클린" 버전 필수 |
| 추가 이미지 | 1000×1000, 최대 9장 | 텍스트 삽입 가능. 옵션별 컷, 사용 장면, USP 강조 컷 |
| 상세페이지 | 가로 860px 이미지 여러 장 | 스마트에디터 ONE에 순서대로 업로드. 한 장 세로 길이는 2,000px 이하로 분할 |
| 상품명·태그·검색 키워드 | 텍스트 | 상품 등록 폼에 그대로 사용 |

핵심 원칙 세 가지.

1. **텍스트가 들어가는 이미지는 생성형 이미지 모델이 아니라 HTML 템플릿으로 렌더링한다.** 한글 폰트 깨짐, 오타, 레이아웃 흔들림을 원천 차단하고 결과가 재현 가능해야 한다.
2. **LLM(Claude)은 "글과 구조"를 맡고, 픽셀은 코드가 맡는다.** 카피, 섹션 구성, 키워드, 검수는 Claude. 리사이즈, 배경 제거, 합성, 스크린샷, 분할은 Python 코드.
3. **등록 전에 사람 검수 단계를 반드시 둔다.** 표시광고법 위반 표현, 잘못된 스펙이 그대로 올라가면 스토어 제재로 이어진다.

## 2. 전체 파이프라인

```
[입력]                [생성]                     [렌더링]                 [검수]            [등록]
product.json  ──►  Claude: 카피/구조 JSON  ──►  Jinja2 HTML 템플릿  ──►  Claude 비전 QA  ──►  커머스 API
원본 사진     ──►  rembg: 누끼/정리      ──►  Playwright 스크린샷  ──►  금칙어/규격 검사  ──►  또는 ZIP 다운로드
                                              Pillow 분할/후처리        사람 승인 UI
```

### 2.1 입력 (Ingest)

- 상품 한 건은 `products/<sku>/product.json` 과 `products/<sku>/raw/*.jpg` 로 관리한다.
- 스프레드시트(CSV/XLSX)에서 여러 건을 한 번에 읽어오는 임포터를 둔다. 대량 등록은 이 경로가 기본이다.
- 스키마(pydantic)는 아래 필드를 최소로 갖는다.

```json
{
  "sku": "A-001",
  "name_raw": "무선 미니 가습기 300ml",
  "category": "생활/건강 > 계절가전 > 가습기",
  "price": 19900,
  "options": [{"name": "색상", "values": ["화이트", "핑크"]}],
  "features_raw": ["USB 충전", "7색 무드등", "무소음 30dB"],
  "specs": {"용량": "300ml", "재질": "ABS", "크기": "8x8x15cm"},
  "target": "1인 가구, 사무실 책상",
  "shipping": {"fee": 3000, "free_over": 30000, "days": "1~2일"},
  "images": ["raw/01.jpg", "raw/02.jpg"],
  "brand_tone": "friendly"
}
```

### 2.2 생성 (Generate)

**카피 및 구조 생성 – Claude API, 구조화 출력.**
모델은 `claude-opus-5`, 응답은 pydantic 스키마로 강제한다. 자유 텍스트를 받아 파싱하는 방식은 쓰지 않는다.

출력 스키마 `ContentPlan`의 핵심 항목.

- `product_name`: 네이버 검색 최적화 상품명 (50자 이내, 브랜드·핵심속성·용도 순서, 특수문자 금지)
- `search_tags`: 10개
- `thumbnail`: `{headline, subline, badge}` 추가 이미지용 짧은 문구
- `sections`: 상세페이지 섹션 리스트. 각 섹션은 `type` 으로 템플릿을 고른다.
  - `hero` (첫 화면 훅), `problem` (고객 불편), `solution`, `feature` (반복), `spec_table`, `how_to_use`, `option`, `faq`, `notice` (배송·교환·반품)
- `compliance_flags`: 모델 스스로 판단한 위험 표현 목록 (효능·최상급·비교 광고 등)

카테고리별 가이드는 시스템 프롬프트에 넣고 캐시한다. 식품·화장품·건강기능식품·의료기기는 표현 규제가 강하므로 카테고리 프롬프트를 별도로 관리한다.

**이미지 정리 – 코드.**
- `rembg` 로 배경 제거 → 누끼 PNG.
- 정사각 캔버스(1000×1000)에 여백 8% 를 두고 중앙 배치, 배경은 흰색 또는 브랜드 컬러.
- 대표 이미지는 여기서 끝낸다. 텍스트를 넣지 않는다.
- 생활 장면(라이프스타일) 배경이 필요하면 외부 이미지 생성 모델을 선택적으로 붙인다. 이 단계는 1차 범위에서 제외한다.

### 2.3 렌더링 (Render)

- 섹션 타입마다 Jinja2 HTML 템플릿을 하나씩 만든다. `templates/sections/feature.html` 처럼 파일 단위로 관리한다.
- 스타일은 `templates/themes/<theme>.css` 로 분리해 브랜드별 색·폰트만 바꿔 재사용한다. 폰트는 Pretendard 또는 Noto Sans KR 을 로컬 파일로 번들한다.
- Playwright(Chromium)로 뷰포트 860px, DPR 2 로 전체 페이지를 캡처한 뒤 Pillow 로 세로 2,000px 단위로 자른다. 자를 때 섹션 경계에서만 자르도록 각 섹션 높이를 DOM 에서 읽어온다.
- 추가 이미지(텍스트 있는 썸네일)도 같은 방식으로 1000×1000 템플릿을 캡처한다.
- 산출물은 `products/<sku>/out/` 아래에 `thumb_main.jpg`, `thumb_01..09.jpg`, `detail_01..N.jpg`, `content_plan.json`, `product_name.txt` 로 저장한다.

### 2.4 검수 (QA)

자동 검수 세 겹.

1. **규칙 기반**: 이미지 크기·용량·비율, 대표 이미지 텍스트 없음(템플릿 구조상 보장), 금칙어 사전 매칭(최고, 최상, 100%, 완치, 부작용 없음 등). 사전은 `qa/banned_terms.yaml` 로 관리한다.
2. **Claude 비전 검수**: 렌더링된 이미지를 그대로 넣고 "글자 잘림, 겹침, 오타, 스펙 불일치, 규제 위험 표현" 을 JSON 으로 받는다. 실패 항목이 있으면 카피 생성 단계로 되돌려 재생성한다(최대 2회).
3. **사람 승인**: 간단한 웹 UI(FastAPI + 정적 HTML)에서 상품별 산출물을 보고 승인/수정/재생성 버튼을 누른다. 승인된 건만 등록 단계로 넘어간다.

### 2.5 등록 (Publish)

두 가지 경로를 모두 지원한다.

- **수동 경로(1차)**: 승인된 산출물을 ZIP 으로 내려받아 스마트스토어 센터에서 직접 업로드한다. 구현이 없다시피 하고 즉시 쓸 수 있다.
- **API 경로(2차)**: 네이버 커머스 API 로 이미지 업로드 후 상품 등록. 상세페이지는 업로드된 이미지 URL 을 `<img>` 로 나열한 HTML 로 만들어 `detailContent` 에 넣는다. 커머스 API 는 판매자 승인과 앱 등록이 필요하므로 별도 셋업 작업으로 잡는다.

## 3. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | Python 3.12 | 이미지 처리·LLM SDK·브라우저 자동화 생태계가 가장 넓다 |
| LLM | Anthropic SDK, `claude-opus-5` | 구조화 출력, 비전 입력, 프롬프트 캐시를 한 API 로 해결 |
| 템플릿 | Jinja2 + 순수 CSS | 디자이너가 HTML/CSS 만으로 템플릿을 고칠 수 있다 |
| 렌더 | Playwright (Chromium) | 폰트·레이아웃이 브라우저 수준으로 정확하다 |
| 이미지 | Pillow, rembg | 리사이즈·분할·누끼 |
| 스키마 | pydantic v2 | 입력 검증과 LLM 출력 파싱을 같은 모델로 |
| 검수 UI | FastAPI + HTMX | 로그인 없는 로컬 도구로 시작 |
| 실행 | CLI (`typer`) | 1차는 큐 없이 순차 처리. 건수가 늘면 큐를 붙인다 |
| 저장 | 로컬 파일시스템 → 필요 시 S3 | 상품 폴더 단위 관리 |

이미지 생성 모델은 1차 범위에 넣지 않는다. 필요해지면 "배경 생성" 단계 하나만 플러그인으로 추가한다.

## 4. 저장소 구조 (제안)

```
.
├── docs/DESIGN.md
├── pyproject.toml
├── src/ssgen/
│   ├── schemas.py          # Product, ContentPlan, QAReport (pydantic)
│   ├── ingest/             # csv/xlsx → product.json
│   ├── generate/
│   │   ├── copy.py         # Claude 호출, 구조화 출력
│   │   ├── prompts/        # 시스템 프롬프트, 카테고리별 가이드
│   │   └── images.py       # rembg, 정사각 캔버스
│   ├── render/
│   │   ├── html.py         # Jinja2 렌더
│   │   ├── capture.py      # Playwright 스크린샷
│   │   └── slice.py        # 세로 분할
│   ├── qa/
│   │   ├── rules.py        # 규격·금칙어
│   │   ├── vision.py       # Claude 비전 검수
│   │   └── banned_terms.yaml
│   ├── publish/
│   │   ├── zip.py
│   │   └── naver_commerce.py
│   ├── review/             # FastAPI 승인 UI
│   └── cli.py
├── templates/
│   ├── sections/*.html
│   ├── thumbnails/*.html
│   └── themes/*.css
├── fonts/
├── products/<sku>/{product.json, raw/, out/}
└── tests/
```

## 5. 핵심 코드 형태

카피 생성 호출의 뼈대. 구조화 출력과 프롬프트 캐시를 쓴다.

```python
import anthropic
from ssgen.schemas import ContentPlan, Product

client = anthropic.Anthropic()

def generate_plan(product: Product, category_guide: str) -> ContentPlan:
    response = client.messages.parse(
        model="claude-opus-5",
        max_tokens=16000,
        system=[
            {"type": "text", "text": BASE_SYSTEM_PROMPT},          # 고정, 캐시 대상
            {"type": "text", "text": category_guide,
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{"role": "user", "content": product.model_dump_json()}],
        output_format=ContentPlan,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("모델이 요청을 거부함: 입력을 확인하세요")
    return response.parsed_output
```

비전 검수는 렌더링된 JPG 를 base64 로 넣고 `QAReport` 스키마로 받는다. 상세페이지 조각이 여러 장이면 한 요청에 모두 넣어 스펙 불일치를 한 번에 잡는다.

## 6. 단계별 추진 계획

| 단계 | 기간 | 산출 | 완료 기준 |
|---|---|---|---|
| 0. 준비 | 1주 | 샘플 상품 5건 데이터, 섹션 템플릿 5종 수동 디자인, `Product` 스키마 확정 | 수동으로 만든 HTML 이 860px 에서 보기 좋다 |
| 1. 렌더 파이프라인 | 1주 | `product.json` + 손으로 쓴 `content_plan.json` → 이미지 세트 | CLI 한 번으로 썸네일·상세 이미지가 나온다 |
| 2. Claude 생성 | 1주 | 카피 생성, 금칙어 검사, 비전 검수 | 5건 중 4건 이상 수정 없이 승인 가능 |
| 3. 검수 UI + ZIP | 1주 | 승인 화면, 재생성 버튼, ZIP 내보내기 | 실제 스토어에 1건 등록 완료 |
| 4. 커머스 API | 1~2주 | 이미지 업로드, 상품 등록 자동화 | 승인 클릭 → 스토어 반영 |
| 5. 고도화 | 지속 | 클릭률 기반 썸네일 A/B, 라이프스타일 배경 생성, 템플릿 추가 | 성과 데이터가 템플릿 선택에 반영 |

단계 3 까지 끝나면 실무에서 바로 쓸 수 있다. 단계 4 는 등록 건수가 하루 수십 건을 넘을 때 착수한다.

## 7. 비용 추정 (상품 1건)

| 항목 | 토큰 | 비용 |
|---|---|---|
| 카피 생성 (입력 4K, 출력 3K) | Opus 5 | 약 $0.10 |
| 비전 검수 (이미지 6장 + 출력 1K) | Opus 5 | 약 $0.06 |
| 재생성 1회 발생 시 | | 약 $0.10 추가 |

건당 $0.2 안팎이다. 야간 대량 처리는 Batch API 로 절반 가격에 돌릴 수 있다. 카테고리 가이드 캐시가 적중하면 입력 비용이 더 내려간다.

## 8. 위험 요소와 대응

- **네이버 정책 변경**: 대표 이미지 규격·텍스트 정책, 상품명 규칙은 `qa/rules.py` 한 곳에서만 참조하도록 만들어 변경 시 한 파일만 고친다.
- **광고 표현 규제**: 금칙어 사전 + Claude 플래그 + 사람 승인 3중. 식품·화장품·건강기능식품은 카테고리 프롬프트에 "효능 표현 금지" 를 명시하고, 심의 대상 카테고리는 자동 등록 경로를 막는다.
- **원본 사진 품질**: 저해상도·역광 사진은 누끼가 깨진다. 입력 단계에서 최소 1000px, 배경 대비 검사를 하고 미달 시 반려한다.
- **템플릿 단조로움**: 섹션 타입별 변형(variant)을 2~3개씩 두고 SKU 해시로 골라 비슷한 상품이 똑같이 보이지 않게 한다.
- **커머스 API 승인 지연**: 판매자 앱 등록 승인에 시간이 걸린다. 단계 0 에서 미리 신청한다.

## 9. 확정이 필요한 사항

이 문서는 아래를 가정하고 작성했다. 다르면 알려달라.

1. 구현 언어는 Python.
2. 1차 범위에 생성형 이미지(배경·모델 컷)는 포함하지 않는다.
3. 판매 카테고리는 일반 공산품 중심이며, 식품·화장품 등 심의 카테고리는 2차에 다룬다.
4. 등록은 1차에 수동(ZIP), 2차에 커머스 API.
