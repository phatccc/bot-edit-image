import os
import re
import threading
from typing import Any, List, Optional, Tuple

import cv2

try:
    import easyocr
except ImportError:  # pragma: no cover - optional runtime dependency
    easyocr = None


_reader = None
_reader_lock = threading.Lock()
_ocr_storage_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".easyocr")


def get_ocr_reader():
    """Lazily initialize the OCR reader once for the whole process."""
    global _reader
    if easyocr is None:
        return None

    if _reader is None:
        with _reader_lock:
            if _reader is None:
                os.makedirs(_ocr_storage_dir, exist_ok=True)
                _reader = easyocr.Reader(
                    ["vi", "en"],
                    gpu=False,
                    model_storage_directory=_ocr_storage_dir,
                    user_network_directory=_ocr_storage_dir,
                )
    return _reader


class WeaponLevelDetector:
    def _ensure_image(self, image: Any):
        if isinstance(image, str):
            img = cv2.imread(image)
            return img
        return image

    def _crop_title_region(self, image: Any):
        img = self._ensure_image(image)
        if img is None:
            return None

        height, width = img.shape[:2]
        crop_height = int(height * 0.15)
        return img[0:crop_height, 0:width]

    def _preprocess_title_region(self, cropped_img):
        if cropped_img is None or cropped_img.size == 0:
            return None

        gray = cv2.cvtColor(cropped_img, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)

    def extract_cap_x_with_ocr_results(self, image: Any) -> Tuple[List[Any], Optional[int]]:
        reader = get_ocr_reader()
        if reader is None:
            return [], None

        cropped = self._crop_title_region(image)
        if cropped is None:
            return [], None

        processed = self._preprocess_title_region(cropped)
        variants = [cropped]
        if processed is not None:
            variants.append(processed)

        combined_results: List[Any] = []
        full_text_parts = []
        for variant in variants:
            results = reader.readtext(variant)
            combined_results.extend(results)
            full_text_parts.extend(result[1] for result in results)

        full_text = " ".join(full_text_parts)

        patterns = [
            r"[\(\s]C[aăâấầẩẫậắằẳẵặ]p\s*(\d+)",
            r"[\(\s]Cap\s*(\d+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                return combined_results, int(match.group(1))

        pipe_pattern = r"\|/(\d+)"
        if re.search(pipe_pattern, full_text):
            return combined_results, 1

        fraction_match = re.search(r"(\d+)\s*/\s*(\d+)", full_text)
        if fraction_match:
            x_value = int(fraction_match.group(1))
            y_value = int(fraction_match.group(2))
            if x_value == 3 and y_value == 3:
                return combined_results, x_value + 1
            return combined_results, x_value

        return combined_results, None


def detect_weapon_level(image: Any) -> Optional[int]:
    detector = WeaponLevelDetector()
    _, level = detector.extract_cap_x_with_ocr_results(image)
    return level
