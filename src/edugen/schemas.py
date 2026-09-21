"""파이프라인 전 단계가 공유하는 데이터 모델."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

MaterialType = Literal["활동지", "교안", "지도안", "평가지", "묶음"]
SchoolLevel = Literal["초등", "중등", "고등", "성인"]


class Meta(BaseModel):
    """판매자가 products/<sku>/meta.yaml 에 적는 최소 정보. 나머지는 파일에서 추출."""

    sku: str
    store_name: str = "우리 스토어"
    price: int | None = None
    series: str | None = None
    subject: str | None = None
    grade: str | None = None
    school_level: SchoolLevel | None = None
    material_type: MaterialType | None = None
    file_formats: list[str] = Field(default_factory=lambda: ["PDF"])
    editable: bool = False
    has_answer_key: bool | None = None
    theme: str | None = None  # templates/themes/<theme>.css, 없으면 과목으로 결정
    thumbnail_style: Literal["stack", "fan", "screen"] | None = None
    preview_pages: list[int] | None = None  # 1-based. 없으면 자동 선택
    license_scope: str = "구매자 본인의 수업 내 사용만 허용. 재배포·공유·2차 판매 금지."


class MaterialProfile(BaseModel):
    """파일 내용에서 뽑은 자료 프로필. Claude 구조화 출력 대상."""

    material_type: MaterialType
    school_level: SchoolLevel
    grade: str = Field(description="예: 5학년, 중2, 고1. 알 수 없으면 빈 문자열")
    subject: str = Field(description="예: 국어, 수학, 영어, 사회, 과학")
    unit: str = Field(description="단원명. 자료에 명시된 것만. 없으면 빈 문자열")
    curriculum: str = Field(default="", description="예: 2022 개정. 명시된 것만")
    achievement_codes: list[str] = Field(
        default_factory=list, description="성취기준 코드. 자료에 적힌 것만, 추측 금지"
    )
    page_count: int
    has_answer_key: bool
    toc: list[str] = Field(description="활동·차시 목록. 최대 12개")
    lesson_flow: list[str] = Field(default_factory=list, description="수업 흐름. 예: 도입 5분 - ...")
    preview_pages: list[int] = Field(description="미리보기로 보여줄 페이지 번호(1-based) 3~4개. 정답지 제외")
    summary: str = Field(description="자료를 한 문장으로")
    copyright_flags: list[str] = Field(
        default_factory=list,
        description="저작권 의심 페이지와 이유. 예: '3쪽: 교과서 지문으로 보임'",
    )
    quality_notes: list[str] = Field(default_factory=list, description="오타·빈 페이지 등")


class Section(BaseModel):
    type: Literal[
        "hero", "target", "composition", "preview", "lesson_flow",
        "teacher_tips", "license", "delivery_refund", "faq",
    ]
    title: str = ""
    body: str = ""
    items: list[str] = Field(default_factory=list)
    pairs: list[list[str]] = Field(default_factory=list, description="[[라벨, 값], ...] 또는 [[질문, 답], ...]")


class Thumbnail(BaseModel):
    badge_top: str = Field(description="예: 초등 5학년 국어")
    title: str = Field(description="자료 제목. 12자 이내 권장")
    sub: str = Field(description="예: 12쪽 · 정답 포함 · PDF")


class ContentPlan(BaseModel):
    """썸네일·상세페이지에 들어갈 모든 글. Claude 구조화 출력 대상."""

    product_name: str = Field(description="네이버 검색용 상품명. 50자 이내. 학년 과목 단원 자료유형 형식 순서")
    search_tags: list[str] = Field(description="검색 태그 10개")
    thumbnail: Thumbnail
    sections: list[Section]
    compliance_flags: list[str] = Field(default_factory=list)


class QAIssue(BaseModel):
    level: Literal["error", "warn"]
    where: str
    message: str


class QAReport(BaseModel):
    issues: list[QAIssue] = Field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not any(i.level == "error" for i in self.issues)
