# edugen — 교육자료 썸네일·상세페이지 자동 생성

강의교안·활동지 파일(PDF/PPTX/DOCX/HWPX)을 넣으면 네이버 스마트스토어용
대표 이미지(1000×1000), 추가 이미지, 상세페이지 이미지(860px), 상품명, 검색 태그를 만든다.

설계 문서: [docs/DESIGN.md](docs/DESIGN.md)

## 설치

```bash
pip install -e .
# Chromium 이 없으면
playwright install chromium
```

Claude 를 쓰려면 `ANTHROPIC_API_KEY` 를 설정한다. 없으면 `--offline` 으로 규칙 기반 대체안이 돌아간다.

## 사용

```
products/<sku>/
├── source.pdf        # 또는 source.pptx / source.docx / source.hwpx
└── meta.yaml         # 선택. 예시는 products/sample-ko5-1/meta.yaml
```

```bash
edugen run products/<sku>              # Claude 분석·카피 + 렌더링 + 검수
edugen run products/<sku> --offline    # API 없이
edugen run products/<sku> --force      # 캐시된 분석·카피 JSON 무시하고 재생성
edugen run products/<sku> --style screen   # 썸네일 목업 강제 (stack | fan | screen)
```

결과는 `products/<sku>/out/` 에 생긴다.

| 파일 | 용도 |
|---|---|
| `thumb_main.jpg` | 대표 이미지. 문구 없음(네이버쇼핑 노출용) |
| `thumb_01.jpg`, `thumb_02.jpg` | 추가 이미지. 학년·과목 배지와 제목 포함 |
| `detail_01.jpg` … | 상세페이지. 순서대로 업로드 |
| `preview/` | 워터마크 미리보기 페이지 |
| `product_name.txt`, `search_tags.txt` | 상품 등록 폼에 붙여넣기 |
| `material_profile.json`, `content_plan.json` | 분석·카피 결과. 손으로 고친 뒤 다시 `run` 하면 반영됨 |
| `qa_report.json` | 검수 결과 |

## 문구를 손으로 고치려면

`out/content_plan.json` 을 편집하고 `--force` 없이 다시 `edugen run` 하면 렌더링만 다시 한다.

## 템플릿

- `templates/thumbnails/{stack,fan,screen}.html` — 썸네일 목업
- `templates/sections/*.html` — 상세페이지 섹션
- `templates/themes/*.css` — 과목별 색 (`meta.yaml` 의 `theme` 로 지정 가능)

## 샘플

```bash
python scripts/make_sample.py          # products/sample-ko5-1/source.pdf 생성
edugen run products/sample-ko5-1 --offline
```

## 테스트

```bash
pytest
```
