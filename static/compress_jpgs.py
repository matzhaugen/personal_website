# compress_jpgs.py
import os
import sys
from pathlib import Path
import shutil
from PIL import Image, ImageOps  # ← add ImageOps here

def compress_image(input_path: Path, output_path: Path, quality: int = 65) -> None:
    """
    Compress a single JPG image aggressively while preserving correct orientation.
    """
    try:
        with Image.open(input_path) as img:
            # Apply EXIF orientation if present → rotates pixels and strips the tag
            img = ImageOps.exif_transpose(img)

            # Convert to RGB if needed (after transpose, in case mode changed)
            if img.mode not in ('RGB', 'L'):
                if img.mode in ('RGBA', 'LA'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1])
                    img = background
                else:
                    img = img.convert('RGB')

            # Save with strong compression
            img.save(
                output_path,
                format='JPEG',
                quality=quality,
                optimize=True,
                progressive=True,
                subsampling='4:2:0'  # strongest chroma subsampling
            )
        print(f"Compressed (orientation preserved): {input_path.name} → {output_path.name}")

    except Exception as e:
        print(f"Error processing {input_path.name}: {e}")

def main(folder_path: str, quality: int = 65, overwrite: bool = False):
    folder = Path(folder_path).resolve()

    if not folder.is_dir():
        print(f"Error: '{folder}' is not a valid directory")
        sys.exit(1)

    print(f"Scanning folder: {folder}")
    print(f"Using JPEG quality: {quality}")
    print("-" * 50)

    count = 0
    skipped = 0

    for file in sorted(folder.iterdir()):
        if not file.is_file():
            continue

        # Accept both .jpg and .jpeg (case insensitive)
        if file.suffix.lower() not in ('.jpg', '.jpeg'):
            continue

        # Skip files that already look like compressed versions
        if file.stem.endswith('_compressed'):
            skipped += 1
            continue

        output_filename = f"{file.stem}_compressed.jpg"
        output_path = file.parent / output_filename

        # If output already exists and we're not in overwrite mode
        if output_path.exists() and not overwrite:
            print(f"Skipping (already exists): {file.name}")
            skipped += 1
            continue

        compress_image(file, output_path, quality=quality)
        count += 1

    print("-" * 50)
    print(f"Done. Processed {count} images | Skipped {skipped} files")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Aggressively compress JPG images in a folder")
    parser.add_argument("folder", help="Path to the folder containing JPG images")
    parser.add_argument("--quality", type=int, default=65,
                        help="JPEG quality (1–95). Lower = smaller file, worse quality. Default: 65")
    parser.add_argument("--overwrite", action="store_true",
                        help="Overwrite existing _compressed.jpg files")

    args = parser.parse_args()

    if args.quality < 10 or args.quality > 95:
        print("Quality must be between 10 and 95")
        sys.exit(1)

    main(args.folder, quality=args.quality, overwrite=args.overwrite)