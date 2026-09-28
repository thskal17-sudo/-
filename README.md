# edugen — 교육자료 썸네일·상세페이지 자동 생성

강의교안·활동지 파일(**PDF, PPTX, PPT**)을 올리면 네이버 스마트스토어용
대표 이미지(1000×1000), 추가 이미지, 상세페이지 이미지(860px), 상품명, 검색 태그를 만든다.

설계 문서: [docs/DESIGN.md](docs/DESIGN.md)

## 빠른 시작 (업로드 화면)

**준비물**

| 프로그램 | 필요한 경우 | 받는 곳 |
|---|---|---|
| Python 3.10 이상 | 항상 | https://www.python.org/downloads/ (설치 때 "Add python.exe to PATH" 체크) |
| LibreOffice | PPT·PPTX 를 올릴 때 | https://ko.libreoffice.org/download/ |

PDF 만 올린다면 LibreOffice 는 없어도 된다.

**실행**

- 윈도우: `start.bat` 더블클릭
- 맥·리눅스: 터미널에서 `./start.sh`

처음 한 번은 설치 때문에 몇 분 걸린다. 끝나면 브라우저에서 http://localhost:8000 이 열린다.

**쓰는 법**

1. 파일을 끌어다 놓는다. PDF, PPTX, PPT 모두 된다.
2. 학년·과목·자료 유형 등을 고른다. 비워두면 파일에서 추정한다.
3. "만들기"를 누르면 결과 화면으로 넘어간다.
4. 결과 화면에서 상품명·태그를 복사하고, "전체 ZIP 받기"로 이미지를 한 번에 받는다.
5. 썸네일 형태(펼친 종이, 겹친 종이, 노트북 화면)를 바꿔 다시 만들 수 있다.

같은 상품 코드로 다시 올리면 덮어쓴다. 올린 파일과 결과는 `products/<상품코드>/` 에 저장되고, git 에는 올라가지 않는다.

## Claude 로 문구 만들기

`ANTHROPIC_API_KEY` 환경변수가 있으면 Claude 가 자료 내용을 읽고 상품명·상세 문구를 쓴다.
없으면 규칙 기반 문구로 만든다. 업로드 화면 상단에 어느 쪽인지 표시된다.

```bat
:: 윈도우 (한 번만)
setx ANTHROPIC_API_KEY "sk-ant-..."
```

## PPT·PPTX 변환에 대해

- PPT·PPTX 는 LibreOffice 로 PDF 로 바꾼 뒤 처리한다. 변환본은 `source.converted.pdf` 로 저장된다.
- 윈도우·맥은 PC 에 설치된 폰트(맑은 고딕 등)를 그대로 쓴다.
- 리눅스에서는 한글이 중국어 폰트로 바뀌지 않도록 번들한 Noto Sans KR 을 쓴다. 한자도 표시된다.
- 슬라이드처럼 가로형 파일은 자동으로 노트북 화면 목업을 쓰고, 미리보기를 한 줄에 한 장씩 보여준다.
- 특수 폰트가 들어간 PPT 는 PC 에 그 폰트가 없으면 모양이 달라질 수 있다. 이때는 PowerPoint 에서 PDF 로 저장해 올리는 것이 가장 정확하다.

## 명령줄로 쓰기

```bash
pip install -e .
playwright install chromium

edugen serve                              # 업로드 화면
edugen run products/<sku>                 # 폴더 하나 처리
edugen run products/<sku> --offline       # Claude 없이
edugen run products/<sku> --force         # 저장된 분석·문구 무시하고 다시
edugen run products/<sku> --style screen  # 썸네일 목업 강제 (stack | fan | screen)
```

폴더 구조:

```
products/<sku>/
├── source.pdf  또는  source.pptx / source.ppt
└── meta.yaml   # 선택. 예시는 products/sample-ko5-1/meta.yaml
```

## 결과 파일

| 파일 | 용도 |
|---|---|
| `thumb_main.jpg` | 대표 이미지. 문구 없음(네이버쇼핑 노출용) |
| `thumb_01.jpg`, `thumb_02.jpg` | 추가 이미지. 학년·과목 배지와 제목 포함 |
| `detail_01.jpg` … | 상세페이지. 위에서부터 순서대로 업로드 |
| `preview/` | 워터마크 미리보기 페이지 |
| `product_name.txt`, `search_tags.txt` | 상품 등록 폼에 붙여넣기 |
| `material_profile.json`, `content_plan.json` | 분석·문구 결과. 손으로 고친 뒤 `--force` 없이 다시 `run` 하면 반영 |
| `qa_report.json` | 검수 결과 |

## 템플릿

- `templates/thumbnails/{stack,fan,screen}.html` 썸네일 목업
- `templates/sections/*.html` 상세페이지 섹션
- `templates/themes/*.css` 과목별 색
- `templates/web/*.html` 업로드 화면

## 개발

```bash
pip install -e ".[dev]"
pytest
```

LibreOffice 가 없으면 PPTX 전체 흐름 테스트는 건너뛴다.

## 폰트 라이선스

Pretendard 와 Noto Sans KR 은 SIL Open Font License 1.1 이다. 원문은 `fonts/` 에 있다.
