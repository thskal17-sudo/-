"""Claude 로 MaterialProfile → ContentPlan 을 만든다. API 키가 없으면 규칙 기반 대체안을 쓴다."""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path

from .schemas import ContentPlan, MaterialProfile, Meta, Section, Thumbnail

PROMPTS = Path(__file__).parent / "prompts"
MODEL = "claude-opus-5"


def llm_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def _client():
    import anthropic

    return anthropic.Anthropic()


def analyze(pdf_path: Path, meta: Meta) -> MaterialProfile:
    """PDF 를 Claude 에 넣어 MaterialProfile 을 받는다."""
    data = base64.standard_b64encode(pdf_path.read_bytes()).decode()
    response = _client().messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=[
            {"type": "text", "text": (PROMPTS / "analyze_system.md").read_text(encoding="utf-8"),
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{
            "role": "user",
            "content": [
                {"type": "document",
                 "source": {"type": "base64", "media_type": "application/pdf", "data": data}},
                {"type": "text",
                 "text": "판매자 메타:\n" + meta.model_dump_json(indent=2, exclude_none=True)
                         + "\n\n이 자료를 분석해 MaterialProfile 을 채워라."},
            ],
        }],
        output_format=MaterialProfile,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("모델이 분석 요청을 거부했습니다. 자료 내용을 확인하세요.")
    return response.parsed_output


def write_copy(profile: MaterialProfile, meta: Meta) -> ContentPlan:
    """MaterialProfile → ContentPlan."""
    response = _client().messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=[
            {"type": "text", "text": (PROMPTS / "copy_system.md").read_text(encoding="utf-8"),
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{
            "role": "user",
            "content": "자료 프로필:\n" + profile.model_dump_json(indent=2)
                       + "\n\n판매자 메타:\n" + meta.model_dump_json(indent=2, exclude_none=True)
                       + "\n\nContentPlan 을 작성하라.",
        }],
        output_format=ContentPlan,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("모델이 카피 작성 요청을 거부했습니다.")
    return response.parsed_output


# ---------------------------------------------------------------------------
# 오프라인 대체안: API 키 없이 파이프라인을 끝까지 돌려볼 때 쓴다.
# ---------------------------------------------------------------------------

def max_preview_pages(page_count: int) -> int:
    """미리보기로 공개할 수 있는 최대 페이지 수: 전체의 30%, 최소 2쪽."""
    import math
    return max(2, math.ceil(page_count * 0.3))


def fallback_profile(meta: Meta, texts: list[str]) -> MaterialProfile:
    n = len(texts)
    import re as _re
    toc: list[str] = []
    for t in texts:
        head = " ".join(t.strip().splitlines()[:3])
        if "정답" in head or "해설" in head:
            continue  # 정답지 페이지의 제목은 목차에 넣지 않는다
        for ln in t.splitlines():
            ln = ln.strip()
            # "활동 1. ...", "3차시 ...", "1. ..." 처럼 제목 꼴인 줄만
            if 4 <= len(ln) <= 30 and _re.match(r"^(활동|차시|\d+차시|\d+[.)])\s*", ln) \
                    and meta.store_name not in ln and ln not in toc:
                toc.append(ln)
                break  # 페이지당 하나
        if len(toc) >= 12:
            break
    answer = meta.has_answer_key if meta.has_answer_key is not None else any("정답" in t for t in texts)
    preview = meta.preview_pages or list(range(1, min(n, max_preview_pages(n)) + 1))[:3]
    return MaterialProfile(
        material_type=meta.material_type or "활동지",
        school_level=meta.school_level or "초등",
        grade=meta.grade or "",
        subject=meta.subject or "",
        unit="",
        page_count=n,
        has_answer_key=bool(answer),
        toc=toc or [f"{i}쪽" for i in range(1, min(n, 6) + 1)],
        preview_pages=preview,
        summary=f"{meta.subject or ''} {meta.material_type or '활동지'} {n}쪽",
    )


def fallback_plan(profile: MaterialProfile, meta: Meta) -> ContentPlan:
    level = f"{profile.school_level} {profile.grade}".strip()
    badge = f"{level} {profile.subject}".strip()
    fmt = "/".join(meta.file_formats)
    answer = "정답 포함" if profile.has_answer_key else "정답 별도"
    name_parts = [level, profile.subject, profile.unit, profile.material_type,
                  f"{profile.page_count}쪽", "정답포함" if profile.has_answer_key else "", fmt.replace("/", " ")]
    product_name = " ".join(p for p in name_parts if p)[:50]
    tags = [t for t in [profile.school_level, profile.grade.replace(" ", ""), profile.subject,
                        profile.material_type, "수업자료", "학습지", "교사용", fmt.split("/")[0],
                        profile.curriculum.replace(" ", ""), "출력용"] if t][:10]
    sections = [
        Section(type="hero", title="바로 출력해 쓰는 수업 자료",
                body=profile.summary + " 수업 준비 시간을 줄여 드립니다.",
                items=[f"{profile.page_count}쪽 구성", answer, f"{fmt} 제공"]),
        Section(type="target", pairs=[p for p in [["대상", level], ["과목", profile.subject],
                                                  ["단원", profile.unit], ["교육과정", profile.curriculum]] if p[1]]),
        Section(type="composition",
                pairs=[["페이지", f"{profile.page_count}쪽"], ["정답지", "포함" if profile.has_answer_key else "미포함"],
                       ["파일", fmt], ["편집", "가능" if meta.editable else "불가"]],
                items=profile.toc),
        Section(type="preview", title="미리보기", body="일부 페이지를 워터마크와 함께 보여드립니다."),
        Section(type="lesson_flow", title="수업 활용 흐름 (예시)",
                items=profile.lesson_flow or ["도입 5분 · 학습 목표 확인", "전개 30분 · 활동지 풀이", "정리 5분 · 정답 확인과 발표"]),
        Section(type="teacher_tips", items=["모둠 활동으로 바꿔 진행할 수 있습니다.",
                                            "시간이 부족하면 뒤쪽 활동을 과제로 제시하세요.",
                                            "정답지는 학생용과 분리해 출력하세요."]),
        Section(type="license", body=meta.license_scope,
                items=["온라인 카페·블로그 재업로드 금지", "타 교사에게 파일 공유 금지", "2차 가공 후 판매 금지"]),
        Section(type="delivery_refund",
                body="결제 후 이메일로 파일을 보내드립니다. 옵션의 이메일 주소를 정확히 입력해 주세요.",
                items=["디지털 콘텐츠 특성상 파일 발송 후에는 청약철회가 제한됩니다.",
                       "파일이 열리지 않거나 내용이 다르면 교환·재발송해 드립니다."]),
        Section(type="faq", pairs=[["파일은 어떻게 받나요?", "결제 후 입력하신 이메일로 보내드립니다. 스팸함도 확인해 주세요."],
                                   ["인쇄해서 나눠줘도 되나요?", "구매하신 선생님의 수업 내 배부는 가능합니다."],
                                   ["수정할 수 있나요?", ("편집 가능한 파일을 함께 드립니다." if meta.editable else "PDF 만 제공되어 편집은 어렵습니다.")]]),
    ]
    return ContentPlan(
        product_name=product_name,
        search_tags=tags,
        thumbnail=Thumbnail(badge_top=badge, title=(profile.unit or profile.summary)[:12],
                            sub=f"{profile.page_count}쪽 · {answer} · {fmt}"),
        sections=sections,
    )


def save_json(model, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(model.model_dump_json(indent=2), encoding="utf-8")


def load_json(cls, path: Path):
    return cls.model_validate(json.loads(path.read_text(encoding="utf-8")))
