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
        # Increased crop height from 0.15 to 0.25 to catch levels lower down
        crop_height = int(height * 0.25)
        return img[0:crop_height, 0:width]

    def _preprocess_title_region(self, cropped_img):
        if cropped_img is None or cropped_img.size == 0:
            return None

        gray = cv2.cvtColor(cropped_img, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
        
        # Method 1: Standard OTSU
        _, thresh1 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Method 2: Inverted OTSU (often helps with white text on dark backgrounds)
        _, thresh2 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        return [cv2.cvtColor(thresh1, cv2.COLOR_GRAY2BGR), cv2.cvtColor(thresh2, cv2.COLOR_GRAY2BGR)]

    def extract_cap_x_with_ocr_results(self, image: Any) -> Tuple[List[Any], Optional[int]]:
        reader = get_ocr_reader()
        if reader is None:
            return [], None

        cropped = self._crop_title_region(image)
        if cropped is None:
            return [], None

        # Optimization: Limit resolution for OCR to speed up processing
        h, w = cropped.shape[:2]
        if w > 1000:
            scale = 1000.0 / w
            cropped = cv2.resize(cropped, (1000, int(h * scale)), interpolation=cv2.INTER_AREA)

        preprocessed_variants = self._preprocess_title_region(cropped)
        variants = [cropped]
        if isinstance(preprocessed_variants, list):
            variants.extend(preprocessed_variants)
        elif preprocessed_variants is not None:
            variants.append(preprocessed_variants)

        patterns = [
            r"[\(\s]C[aăâấầẩẫậắằẳẵặ]p\s*(\d+)",
            r"[\(\s]Cap\s*(\d+)",
        ]

        def find_level(text: str) -> Optional[int]:
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    return int(match.group(1))
            
            if re.search(r"\|/(\d+)", text):
                return 1
            
            fraction_match = re.search(r"(\d+)\s*/\s*(\d+)", text)
            if fraction_match:
                x_val, y_val = int(fraction_match.group(1)), int(fraction_match.group(2))
                return x_val + 1 if x_val == 3 and y_val == 3 else x_val
            return None

        combined_results = []
        for variant in variants:
            # detail=0 returns just strings (much faster)
            results = reader.readtext(variant, detail=0)
            if not results:
                continue
                
            combined_results.extend(results)
            full_text = " ".join(results)
            
            level = find_level(full_text)
            if level is not None:
                return combined_results, level

        return combined_results, None


def detect_weapon_level(image: Any) -> Optional[int]:
    detector = WeaponLevelDetector()
    _, level = detector.extract_cap_x_with_ocr_results(image)
    return level
