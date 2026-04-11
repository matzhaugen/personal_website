#!/usr/bin/env python3
"""
merge_to_pdf.py — Combine all JPGs, PNGs, and PDFs in a folder into one PDF.

Usage:
    python merge_to_pdf.py <input_folder> [output.pdf]

Files are sorted alphabetically by filename. To control order,
prefix filenames with numbers (e.g., 01_cover.jpg, 02_page.pdf).

Requirements:
    pip install pypdf Pillow
"""

import sys
import os
from pathlib import Path
from PIL import Image
from pypdf import PdfReader, PdfWriter

SUPPORTED_IMAGES = {".jpg", ".jpeg", ".png"}
SUPPORTED_PDFS = {".pdf"}
SUPPORTED = SUPPORTED_IMAGES | SUPPORTED_PDFS


def image_to_pdf_page(image_path: str) -> PdfReader:
    """Convert an image file to an in-memory single-page PDF."""
    img = Image.open(image_path)

    # Convert RGBA/palette images to RGB for PDF compatibility
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")

    tmp_path = image_path + ".tmp.pdf"
    img.save(tmp_path, "PDF", resolution=img.info.get("dpi", (150, 150))[0] if isinstance(img.info.get("dpi"), tuple) else 150)
    reader = PdfReader(tmp_path)
    os.remove(tmp_path)
    return reader


def merge_files(input_folder: str, output_path: str) -> None:
    folder = Path(input_folder)
    if not folder.is_dir():
        print(f"Error: '{input_folder}' is not a valid directory.")
        sys.exit(1)

    # Gather and sort supported files alphabetically
    files = sorted(
        [f for f in folder.iterdir() if f.suffix.lower() in SUPPORTED],
        key=lambda f: f.name.lower(),
    )

    if not files:
        print(f"No JPG, PNG, or PDF files found in '{input_folder}'.")
        sys.exit(1)

    print(f"Found {len(files)} file(s) to merge:\n")
    writer = PdfWriter()

    for f in files:
        ext = f.suffix.lower()
        try:
            if ext in SUPPORTED_IMAGES:
                reader = image_to_pdf_page(str(f))
                for page in reader.pages:
                    writer.add_page(page)
                print(f"  [IMG] {f.name}")
            elif ext in SUPPORTED_PDFS:
                reader = PdfReader(str(f))
                for page in reader.pages:
                    writer.add_page(page)
                print(f"  [PDF] {f.name} ({len(reader.pages)} page(s))")
        except Exception as e:
            print(f"  [ERR] {f.name} — skipped ({e})")

    with open(output_path, "wb") as out:
        writer.write(out)

    total_pages = len(writer.pages)
    print(f"\nDone! Merged {len(files)} files ({total_pages} pages) → {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python merge_to_pdf.py <input_folder> [output.pdf]")
        sys.exit(1)

    input_folder = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else os.path.join(input_folder, "merged_output.pdf")

    merge_files(input_folder, output_file)