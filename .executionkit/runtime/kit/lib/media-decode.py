"""Bounded host-side raster decoding. No network, filesystem inputs or writes."""
import io
import json
import sys
import warnings

MAX_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 24_000_000

try:
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    warnings.simplefilter("error", Image.DecompressionBombWarning)
    data = sys.stdin.buffer.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("MEDIA_BYTES_LIMIT")
    with Image.open(io.BytesIO(data)) as image:
        width, height = image.size
        if width < 1 or height < 1 or width * height > MAX_PIXELS:
            raise ValueError("MEDIA_PIXEL_LIMIT")
        if image.format not in ("JPEG", "WEBP", "AVIF"):
            raise ValueError("MEDIA_CODEC_UNSUPPORTED")
        if getattr(image, "n_frames", 1) != 1:
            raise ValueError("MEDIA_ANIMATION_REQUIRES_SEPARATE_REVIEW")
        codec = image.format
        if codec == "JPEG" and not data.endswith(b"\xff\xd9"):
            raise ValueError("MEDIA_JPEG_TRAILING_OR_TRUNCATED")
        if codec == "WEBP" and (len(data) < 12 or int.from_bytes(data[4:8], "little") + 8 != len(data)):
            raise ValueError("MEDIA_WEBP_CONTAINER_LENGTH")
        image.verify()
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        alpha = "A" in image.getbands() or "transparency" in image.info
    print(json.dumps({"width": width, "height": height, "alpha": alpha,
                      "mime": {"JPEG": "image/jpeg", "WEBP": "image/webp", "AVIF": "image/avif"}[codec]}))
except ImportError:
    print(json.dumps({"error": "MEDIA_DECODER_UNAVAILABLE"}))
    sys.exit(2)
except Exception:
    print(json.dumps({"error": "MEDIA_DECODE_REJECTED"}))
    sys.exit(1)
