#!/usr/bin/env python3
"""Crop a region (or a whole page) of a book PDF into a web-optimized PNG.

This is the *book-art* counterpart to the built-in icon catalog: step 3 of the
exercise-lab workflow prefers real page illustrations for an exercise's
full-size ``image`` field, and this tool is how you extract them. It uses
PyMuPDF (``fitz``) — a single pure dependency, no system binaries.

    pip install pymupdf

``page`` is the **PDF page index** (1-based position in the file) — the same
number the chapter notes record and the ``Read`` tool uses, so no printed-page
conversion is ever needed.

Coordinates can be given two ways (pick one):

- ``--frac x0 y0 x1 y1`` — fractions of the page (0..1 from the top-left). Easiest
  when eyeballing a crop ("the top-right quarter" ≈ ``0.5 0 1 0.5``).
- ``--rect x0 y0 x1 y1`` — absolute PDF points (72 pt = 1 inch), the page's own
  coordinate system. Use when the chapter notes already record a point bbox.

Omit both to render the whole page. ``--max-width`` caps the output width in
pixels (default 640) so assets stay light on the old LAN tablets; ``--dpi`` sets
the render resolution before that cap (default 150).

Examples:
    # Whole PDF page 11 of Teuchos B, capped at 640px wide
    python pdf_crop.py BOOK.pdf 11 ../bundles/.../assets/scene.png

    # Top half of PDF page 15 (the Skyros photo) as a 480px-wide crop
    python pdf_crop.py BOOK.pdf 15 out.png --frac 0 0 1 0.5 --max-width 480
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("pdf_crop requires PyMuPDF — install it with:  pip install pymupdf")


def crop(
    pdf: Path,
    page_number: int,
    out: Path,
    *,
    frac: tuple[float, float, float, float] | None,
    rect: tuple[float, float, float, float] | None,
    dpi: int,
    max_width: int,
) -> None:
    """Render page ``page_number`` (1-based) of ``pdf`` to ``out`` as PNG."""
    if frac is not None and rect is not None:
        raise ValueError("give either --frac or --rect, not both")
    if not pdf.is_file():
        raise FileNotFoundError(f"PDF not found: {pdf}")

    doc = fitz.open(pdf)
    if not 1 <= page_number <= doc.page_count:
        raise ValueError(f"page {page_number} out of range (1..{doc.page_count})")
    page = doc[page_number - 1]
    pr = page.rect

    if frac is not None:
        x0, y0, x1, y1 = frac
        clip = fitz.Rect(
            pr.x0 + x0 * pr.width,
            pr.y0 + y0 * pr.height,
            pr.x0 + x1 * pr.width,
            pr.y0 + y1 * pr.height,
        )
    elif rect is not None:
        clip = fitz.Rect(*rect)
    else:
        clip = pr

    # Render at the requested DPI, but cap the output width to max_width so the
    # asset stays small for the tablets (zoom = pixels-per-point).
    zoom = min(dpi / 72.0, max_width / clip.width)
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip)
    out.parent.mkdir(parents=True, exist_ok=True)
    pix.save(out)
    print(f"wrote {out} ({pix.width}x{pix.height}px) from {pdf.name} p.{page_number}")


def main() -> None:
    p = argparse.ArgumentParser(description="Crop a PDF page region into a PNG asset.")
    p.add_argument("pdf", type=Path, help="source PDF (e.g. a books/… textbook)")
    p.add_argument("page", type=int, help="PDF page index, 1-based")
    p.add_argument("out", type=Path, help="output PNG path (usually a bundle's assets/…)")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--frac", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"),
                   help="crop box as page fractions (0..1, top-left origin)")
    g.add_argument("--rect", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"),
                   help="crop box in absolute PDF points")
    p.add_argument("--dpi", type=int, default=150, help="render DPI before the width cap (default 150)")
    p.add_argument("--max-width", type=int, default=640, help="cap output width in px (default 640)")
    args = p.parse_args()

    try:
        crop(
            args.pdf, args.page, args.out,
            frac=tuple(args.frac) if args.frac else None,
            rect=tuple(args.rect) if args.rect else None,
            dpi=args.dpi, max_width=args.max_width,
        )
    except (ValueError, FileNotFoundError) as exc:
        sys.exit(f"pdf_crop: {exc}")


if __name__ == "__main__":
    main()
