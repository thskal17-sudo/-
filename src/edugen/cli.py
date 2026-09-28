"""명령줄 진입점.

  edugen run products/<sku>   한 상품의 썸네일·상세페이지 생성
  edugen serve                브라우저 업로드 화면 실행 (http://localhost:8000)
"""
from __future__ import annotations

from pathlib import Path

import typer

from . import pipeline

app = typer.Typer(add_completion=False, help="교육자료 썸네일·상세페이지 자동 생성")


@app.command()
def run(
    product_dir: Path = typer.Argument(..., help="products/<sku> 폴더"),
    offline: bool = typer.Option(False, "--offline", help="Claude 없이 규칙 기반으로 실행"),
    force: bool = typer.Option(False, "--force", help="저장된 분석·문구를 무시하고 다시 생성"),
    style: str = typer.Option(None, "--style", help="썸네일 목업: stack | fan | screen"),
    width: int = typer.Option(860, help="상세페이지 폭(px)"),
    scale: int = typer.Option(2, help="상세페이지 해상도 배율"),
    max_segment: int = typer.Option(1500, help="상세 이미지 한 장의 최대 세로(px)"),
):
    """한 상품 폴더를 처리해 out/ 에 결과를 만든다."""
    result = pipeline.run_product(product_dir, offline=offline, force=force, style=style, width=width,
                                  scale=scale, max_segment=max_segment, log=typer.echo)
    typer.echo(f"결과: {result.out_dir}")
    raise typer.Exit(code=0 if result.ok else 1)


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", help="외부 접속을 허용하려면 0.0.0.0"),
    port: int = typer.Option(8000),
    products: Path = typer.Option(Path("products"), help="상품 폴더를 저장할 위치"),
):
    """브라우저에서 PDF/PPTX 를 올려 바로 생성하는 화면을 띄운다."""
    import uvicorn

    from .web import create_app

    typer.echo(f"http://{'localhost' if host in ('127.0.0.1', '0.0.0.0') else host}:{port} 에서 열립니다")
    uvicorn.run(create_app(products.resolve()), host=host, port=port)


if __name__ == "__main__":
    app()
