"""테스트용 샘플 활동지 PDF 를 만든다. 실제 자료가 없을 때만 쓴다."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from edugen import FONTS_DIR, render  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "products" / "sample-ko5-1" / "source.pdf"

PAGES = [
    ("1단원 대화와 공감", "초등 5학년 국어 활동지", ["학습 목표: 상대의 마음을 헤아리며 대화하는 방법을 안다.", "이름: ________  날짜: ____월 ____일"]),
    ("활동 1. 대화 장면 살펴보기", "그림 속 두 친구의 표정을 보고 어떤 상황인지 써 봅시다.", ["1) 민수는 어떤 마음일까요?", "2) 지우가 한 말 중 고쳐야 할 부분은?", "3) 내가 지우라면 어떻게 말할까요?"]),
    ("활동 2. 공감하는 말 찾기", "다음 대화에서 공감하는 표현에 밑줄을 그어 봅시다.", ["\"그랬구나, 많이 속상했겠다.\"", "\"네가 잘못했네.\"", "\"나라도 그랬을 것 같아.\""]),
    ("활동 3. 대화 바꿔 쓰기", "공감하는 말로 대화를 다시 써 봅시다.", ["원래 대화: ______________________", "바꾼 대화: ______________________", "친구와 역할을 나누어 읽어 봅시다."]),
    ("활동 4. 나의 대화 점검", "이번 주 내가 한 대화를 떠올려 봅시다.", ["잘한 점:", "고칠 점:", "다음에 해 볼 말:"]),
    ("정답 및 해설", "교사용", ["활동 1: 예시 답안 - 민수는 서운한 마음", "활동 2: 첫 번째, 세 번째 문장", "활동 3: 학생 답안 자유"]),
]

HTML = """<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
@font-face{font-family:P;src:url("%s/PretendardVariable.woff2");font-weight:45 920}
@page{size:A4;margin:0}
body{font-family:P,sans-serif;margin:0}
.pg{width:210mm;height:297mm;padding:22mm 20mm;page-break-after:always;position:relative}
.hd{border-bottom:3px solid #d64545;padding-bottom:6mm;margin-bottom:10mm}
.hd small{color:#d64545;font-weight:700;font-size:12pt}
h1{font-size:24pt;margin:2mm 0 0}
p.lead{font-size:13pt;color:#333}
li{font-size:13pt;margin:8mm 0;list-style:none;border-bottom:1px dashed #bbb;padding-bottom:4mm}
.box{border:1.5px solid #999;height:60mm;margin-top:8mm;border-radius:3mm}
.ft{position:absolute;bottom:12mm;left:20mm;right:20mm;display:flex;justify-content:space-between;color:#888;font-size:10pt}
</style></head><body>%s</body></html>"""

def page(i, title, lead, items):
    lis = "".join(f"<li>{x}</li>" for x in items)
    return (f'<div class="pg"><div class="hd"><small>초등 5학년 국어</small><h1>{title}</h1></div>'
            f'<p class="lead">{lead}</p><ul>{lis}</ul><div class="box"></div>'
            f'<div class="ft"><span>초록칠판 활동지</span><span>{i}</span></div></div>')

if __name__ == "__main__":
    html = HTML % (FONTS_DIR.resolve().as_uri(), "".join(page(i, *p) for i, p in enumerate(PAGES, 1)))
    tmp = OUT.with_suffix(".html")
    tmp.write_text(html, encoding="utf-8")
    with render.Browser() as b:
        pg = b._browser.new_page()
        pg.goto(tmp.resolve().as_uri())
        pg.wait_for_load_state("networkidle")
        pg.pdf(path=str(OUT), format="A4", print_background=True)
        pg.close()
    tmp.unlink()
    print("wrote", OUT)
