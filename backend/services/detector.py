import cv2
import numpy as np
from typing import List, Dict, Any, Tuple
import json
import os


TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


def load_template(template_name: str = "default") -> dict:
    """Load template config from JSON file."""
    path = os.path.join(TEMPLATE_DIR, f"{template_name}.json")
    with open(path, "r") as f:
        return json.load(f)


def detect_screen_type(image: np.ndarray) -> str:
    """
    Detect the type of PUBG Mobile screen.
    Currently defaults to 'outfit_screen' — the most common type for acc showcase.
    Can be extended with more heuristics.
    """
    h, w = image.shape[:2]

    # Check if the right side has a grid-like structure (inventory)
    right_region = image[:, int(w * 0.6):, :]
    gray_right = cv2.cvtColor(right_region, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray_right, 50, 150)
    
    # Count horizontal and vertical lines
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 80, minLineLength=50, maxLineGap=10)
    
    if lines is not None and len(lines) > 10:
        return "outfit_screen"
    
    return "outfit_screen"


def normalize_image_for_crop_type(
    image: np.ndarray,
    template: dict,
    crop_type: str = None,
    outfit_preset: str = None,
    custom_grid: Any = None,
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Normalize certain input screenshots before region detection.

    For outfit screenshots, users usually want the outfit inventory grid itself,
    not the full lobby/screen capture. When a wide screenshot is detected, crop
    it down to the outfit panel so the rest of the pipeline behaves like a
    dedicated inventory screenshot.
    """
    metadata: Dict[str, Any] = {
        "normalized": False,
        "inventory_source_mode": False,
    }

    if crop_type not in {"outfit", "helmet"}:
        return image, metadata

    # Respect manual adjustments from the UI; those ratios target the original image.
    if custom_grid is not None:
        metadata["inventory_source_mode"] = True
        return crop_region(
            image,
            custom_grid.x_ratio,
            custom_grid.y_ratio,
            custom_grid.w_ratio,
            custom_grid.h_ratio,
        ), metadata

    h, w = image.shape[:2]
    aspect_ratio = w / max(h, 1)
    normalization_config = template.get("input_normalization", {})

    if crop_type == "helmet":
        normalization = normalization_config.get("helmet_landscape_focus")
    else:
        preset_normalizations = normalization_config.get("outfit_preset_regions", {})
        normalization = preset_normalizations.get(outfit_preset)
        lowres_normalization = normalization_config.get("outfit_landscape_focus_lowres")

        if normalization is None:
            if lowres_normalization and w <= lowres_normalization.get("max_width", 800):
                normalization = lowres_normalization
            else:
                normalization = normalization_config.get("outfit_landscape_focus")

    if normalization and aspect_ratio >= normalization.get("min_aspect_ratio", 1.2):
        panel_crop = crop_region(
            image,
            normalization["panel"]["x_ratio"],
            normalization["panel"]["y_ratio"],
            normalization["panel"]["w_ratio"],
            normalization["panel"]["h_ratio"],
        )
        normalized = panel_crop
        grid_focus = normalization.get("grid")
        if grid_focus:
            focused_grid = crop_region(
                panel_crop,
                grid_focus["x_ratio"],
                grid_focus["y_ratio"],
                grid_focus["w_ratio"],
                grid_focus["h_ratio"],
            )
            if focused_grid.size > 0:
                normalized = focused_grid
        if normalized.size > 0:
            metadata["normalized"] = True
            metadata["inventory_source_mode"] = True
            return normalized, metadata

    return image, metadata


def crop_region(image: np.ndarray, x_ratio: float, y_ratio: float,
                w_ratio: float, h_ratio: float) -> np.ndarray:
    """Crop a region from image using ratio-based coordinates."""
    h, w = image.shape[:2]
    x = int(w * x_ratio)
    y = int(h * y_ratio)
    rw = int(w * w_ratio)
    rh = int(h * h_ratio)
    
    # Clamp to image boundaries
    x = max(0, min(x, w - 1))
    y = max(0, min(y, h - 1))
    rw = min(rw, w - x)
    rh = min(rh, h - y)
    
    return image[y:y + rh, x:x + rw].copy()


def ratio_region_to_box(
    image: np.ndarray,
    x_ratio: float,
    y_ratio: float,
    w_ratio: float,
    h_ratio: float,
) -> Tuple[int, int, int, int]:
    """Convert ratio-based crop coordinates into an absolute box."""
    h, w = image.shape[:2]
    x = max(0, min(int(w * x_ratio), w - 1))
    y = max(0, min(int(h * y_ratio), h - 1))
    bw = min(int(w * w_ratio), w - x)
    bh = min(int(h * h_ratio), h - y)
    return x, y, bw, bh


def detect_and_crop_regions(image: np.ndarray, template: dict,
                            crop_type: str = None, custom_grid: Any = None) -> Dict[str, Any]:
    """
    Detect screen type and crop all regions based on template config.
    If crop_type is provided, use it directly instead of auto-detecting.
    Returns dict with region name -> cropped image.
    """
    
    # Map crop_type to screen_type
    type_mapping = {
        "outfit": "outfit_screen",
        "weapon": "weapon_screen",
        "helmet": "helmet_screen",
    }
    
    if crop_type and crop_type in type_mapping:
        screen_type = type_mapping[crop_type]
    else:
        screen_type = detect_screen_type(image)
    
    screen_config = template["screen_types"].get(screen_type, 
                                                   template["screen_types"]["outfit_screen"])
    regions = screen_config["regions"]
    
    # Apply custom grid if provided
    if custom_grid:
        if "inventory_grid" in regions:
            regions["inventory_grid"]["x_ratio"] = custom_grid.x_ratio
            regions["inventory_grid"]["y_ratio"] = custom_grid.y_ratio
            regions["inventory_grid"]["w_ratio"] = custom_grid.w_ratio
            regions["inventory_grid"]["h_ratio"] = custom_grid.h_ratio
    
    result = {
        "screen_type": screen_type,
        "crops": {}
    }
    
    for region_name, ratios in regions.items():
        cropped = crop_region(
            image,
            ratios["x_ratio"],
            ratios["y_ratio"],
            ratios["w_ratio"],
            ratios["h_ratio"]
        )
        result["crops"][region_name] = cropped
    
    # Also extract individual inventory items from the grid
    if "inventory_grid" in result["crops"]:
        grid_config = screen_config.get("grid", {"cols": 3, "rows": 4, "padding_ratio": 0.01})
        items = crop_grid_items(result["crops"]["inventory_grid"], grid_config)
        result["inventory_items"] = items
    
    return result


def build_inventory_result(
    image: np.ndarray,
    template: dict,
    screen_type: str = "outfit_screen",
) -> Dict[str, Any]:
    """
    Build an outfit result from a dedicated inventory/grid source image.

    The large poster crop uses the whole inventory source, while individual
    items are extracted from the same image.
    """
    screen_config = template["screen_types"][screen_type]
    grid_config = screen_config.get("grid", {"cols": 3, "rows": 4, "padding_ratio": 0.01})
    # The preview should stay exactly as the user-selected inventory panel.
    # Unioning detected cells can clip the first/last rows unevenly depending on
    # what items are visible, so keep the original panel untouched.
    preview = image.copy()
    detected_boxes = detect_inventory_cell_boxes(
        image,
        cols=grid_config.get("cols", 3),
        rows=grid_config.get("rows", 4),
    )
    if detected_boxes:
        items = [crop_box(image, box, margin=2) for box in detected_boxes]
    else:
        items = crop_grid_items(image, grid_config)

    return {
        "screen_type": screen_type,
        "crops": {
            "character": preview,
        },
        "inventory_items": items,
    }


def build_weapon_result(
    image: np.ndarray,
    template: dict,
    custom_grid: Any = None,
) -> Dict[str, Any]:
    """
    Build a weapon result by using one sample weapon row to infer the full
    visible weapon list in the same right-hand column.
    """
    screen_config = template["screen_types"]["weapon_screen"]
    region = screen_config["regions"]["inventory_grid"]

    if custom_grid is not None:
        source_box = ratio_region_to_box(
            image,
            custom_grid.x_ratio,
            custom_grid.y_ratio,
            custom_grid.w_ratio,
            custom_grid.h_ratio,
        )
    else:
        source_box = ratio_region_to_box(
            image,
            region["x_ratio"],
            region["y_ratio"],
            region["w_ratio"],
            region["h_ratio"],
        )

    # Small height means the user selected one sample weapon row.
    use_sample_box = source_box[3] <= max(int(image.shape[0] * 0.25), 1)
    if use_sample_box:
        boxes = detect_vertical_card_boxes(image.copy(), source_box)
        panel = None
    else:
        panel = crop_box(image, source_box, margin=0)
        boxes = detect_vertical_card_boxes(panel.copy())

    if use_sample_box:
        preview = crop_to_box_union(image, boxes, margin=6) if boxes else crop_box(image, source_box, margin=4)
        items = [crop_weapon_slot(image, box) for box in boxes] if boxes else [crop_weapon_slot(image, source_box)]
        selected_index = find_best_matching_box_index(source_box, boxes)
    else:
        local_boxes = boxes
        if local_boxes:
            preview = crop_to_box_union(panel, local_boxes, margin=6)
            items = [crop_weapon_slot(panel, box) for box in local_boxes]
        else:
            preview = panel
            items = crop_grid_items(
                panel,
                screen_config.get("grid", {"cols": 1, "rows": 5, "padding_ratio": 0.01}),
            )
        selected_index = 0 if items else None

    return {
        "screen_type": "weapon_screen",
        "crops": {
            "character": preview,
        },
        "inventory_items": items,
    }


def crop_grid_items(grid_image: np.ndarray, grid_config: dict) -> List[np.ndarray]:
    """
    Split inventory grid into individual item cells.
    Uses the grid config (cols, rows, padding) to calculate cell positions.
    """
    h, w = grid_image.shape[:2]
    cols = grid_config.get("cols", 3)
    rows = grid_config.get("rows", 4)
    padding = grid_config.get("padding_ratio", 0.01)
    
    cell_w = w // cols
    cell_h = h // rows
    pad_x = int(cell_w * padding)
    pad_y = int(cell_h * padding)
    
    items = []
    for row in range(rows):
        for col in range(cols):
            x = col * cell_w + pad_x
            y = row * cell_h + pad_y
            cw = cell_w - 2 * pad_x
            ch = cell_h - 2 * pad_y
            
            if x + cw > w:
                cw = w - x
            if y + ch > h:
                ch = h - y
            
            if cw > 0 and ch > 0:
                cell = grid_image[y:y + ch, x:x + cw].copy()
                # Filter out mostly empty cells
                if not is_empty_cell(cell):
                    items.append(cell)
    
    return items


def detect_inventory_cell_boxes(
    image: np.ndarray,
    cols: int = 3,
    rows: int = 4,
) -> List[Tuple[int, int, int, int]]:
    """
    Detect visible inventory cells by finding saturated item-card regions and
    arranging them into a grid. This is more robust than splitting by equal
    fractions when screenshots are slightly offset.
    """
    h, w = image.shape[:2]
    if h == 0 or w == 0:
        return []

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = ((hsv[:, :, 1] > 70) & (hsv[:, :, 2] > 45)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)),
    )

    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(mask)
    candidates = []
    min_area = max(int(h * w * 0.012), 8000)
    for idx in range(1, num_labels):
        x, y, bw, bh, area = stats[idx]
        if area < min_area:
            continue
        if bw < max(int(w * 0.12), 40) or bh < max(int(h * 0.10), 40):
            continue
        candidates.append({
            "box": (x, y, bw, bh),
            "cx": x + bw / 2,
            "cy": y + bh / 2,
            "area": area,
        })

    if len(candidates) < max(4, cols * 2):
        return []

    col_groups = cluster_axis_positions(
        [c["cx"] for c in candidates],
        tolerance=max(w * 0.08, 28),
    )
    row_groups = cluster_axis_positions(
        [c["cy"] for c in candidates],
        tolerance=max(h * 0.08, 28),
    )

    if len(col_groups) < cols or len(row_groups) < min(rows, 3):
        return []

    col_centers = [group["center"] for group in col_groups[:cols]]
    row_centers = [group["center"] for group in row_groups[:rows]]

    slots: Dict[Tuple[int, int], Dict[str, Any]] = {}
    for candidate in candidates:
        col_idx = nearest_center_index(candidate["cx"], col_centers)
        row_idx = nearest_center_index(candidate["cy"], row_centers)
        key = (row_idx, col_idx)
        existing = slots.get(key)
        if existing is None or candidate["area"] > existing["area"]:
            slots[key] = candidate

    ordered_boxes: List[Tuple[int, int, int, int]] = []
    for row_idx in range(len(row_centers)):
        for col_idx in range(len(col_centers)):
            cell = slots.get((row_idx, col_idx))
            if cell is not None:
                ordered_boxes.append(cell["box"])

    return ordered_boxes


def detect_vertical_card_boxes(
    image: np.ndarray,
    sample_box: Tuple[int, int, int, int] = None,
) -> List[Tuple[int, int, int, int]]:
    """
    Detect a vertical stack of wide item cards, used for weapon list screens.
    If sample_box is provided, its width/height is used as the expected card size.
    """
    h, w = image.shape[:2]
    if h == 0 or w == 0:
        return []

    x_offset = 0
    strip = image
    expected_h = None

    if sample_box is not None:
        sx, _, sw, sh = sample_box
        x1 = max(0, sx)
        x2 = min(w, sx + sw)
        if x2 <= x1:
            return []
        strip = image[:, x1:x2]
        x_offset = x1
        expected_h = sh
    else:
        x1 = int(w * 0.65)
        strip = image[:, x1:]
        x_offset = x1

    contour_boxes = detect_weapon_slot_contours(strip, x_offset=x_offset, expected_h=expected_h)
    if contour_boxes:
        return contour_boxes

    return detect_weapon_slot_components(strip, x_offset=x_offset, expected_h=expected_h)


def detect_weapon_slot_contours(
    strip: np.ndarray,
    x_offset: int = 0,
    expected_h: int = None,
) -> List[Tuple[int, int, int, int]]:
    """Detect wide horizontal weapon slots using HSV masking and contour edges."""
    strip_h, strip_w = strip.shape[:2]
    if strip_h == 0 or strip_w == 0:
        return []

    smoothed = cv2.GaussianBlur(strip, (5, 5), 0)
    hsv = cv2.cvtColor(smoothed, cv2.COLOR_BGR2HSV)
    orange_mask = cv2.inRange(
        hsv,
        np.array([5, 120, 120], dtype=np.uint8),
        np.array([30, 255, 255], dtype=np.uint8),
    )
    edges = cv2.Canny(cv2.cvtColor(smoothed, cv2.COLOR_BGR2GRAY), 45, 135)
    mask = cv2.bitwise_or(orange_mask, edges)
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)),
    )

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates: List[Tuple[int, int, int, int]] = []

    min_height = max(int(strip_h * 0.05), 48)
    max_height = max(int(strip_h * 0.22), min_height + 1)
    if expected_h is not None:
        min_height = max(int(expected_h * 0.6), 42)
        max_height = int(expected_h * 1.45)

    min_width = max(int(strip_w * 0.72), 140)
    min_area = max(20000, int(strip_w * min_height * 0.40))

    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        area = bw * bh
        if area < min_area:
            continue
        if bw < min_width or bh < min_height or bh > max_height:
            continue
        aspect_ratio = bw / max(float(bh), 1.0)
        if not 2.0 <= aspect_ratio <= 8.0:
            continue
        candidates.append((x + x_offset, y, bw, bh))

    return dedupe_vertical_boxes(candidates)


def detect_weapon_slot_components(
    strip: np.ndarray,
    x_offset: int = 0,
    expected_h: int = None,
) -> List[Tuple[int, int, int, int]]:
    """Fallback detector for weapon slots when contour mode is too sparse."""
    strip_h, strip_w = strip.shape[:2]
    smoothed = cv2.GaussianBlur(strip, (5, 5), 0)
    hsv = cv2.cvtColor(smoothed, cv2.COLOR_BGR2HSV)
    orange_mask = cv2.inRange(
        hsv,
        np.array([5, 120, 90], dtype=np.uint8),
        np.array([30, 255, 255], dtype=np.uint8),
    )
    vivid_mask = ((hsv[:, :, 1] > 35) & (hsv[:, :, 2] > 25)).astype(np.uint8) * 255
    edges = cv2.Canny(cv2.cvtColor(smoothed, cv2.COLOR_BGR2GRAY), 60, 160)
    mask = cv2.bitwise_or(vivid_mask, orange_mask)
    mask = cv2.bitwise_or(mask, edges)
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)),
    )
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)),
    )

    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(mask)
    candidates: List[Tuple[int, int, int, int]] = []

    min_height = max(int(strip_h * 0.05), 50)
    max_height = strip_h
    if expected_h is not None:
        min_height = max(int(expected_h * 0.55), 40)
        max_height = int(expected_h * 1.8)

    min_width = max(int(strip_w * 0.68), 80)
    min_area = max(int(strip_w * min_height * 0.35), 8000)

    for idx in range(1, num_labels):
        x, y, bw, bh, area = stats[idx]
        if area < min_area:
            continue
        if bw < min_width or bh < min_height or bh > max_height:
            continue
        candidates.append((x + x_offset, y, bw, bh))

    return dedupe_vertical_boxes(candidates)


def dedupe_vertical_boxes(
    boxes: List[Tuple[int, int, int, int]],
) -> List[Tuple[int, int, int, int]]:
    """Sort vertical slots and remove heavy overlap duplicates."""
    boxes = sorted(boxes, key=lambda box: box[1])
    deduped: List[Tuple[int, int, int, int]] = []
    for box in boxes:
        if not deduped:
            deduped.append(box)
            continue

        prev = deduped[-1]
        overlap_top = max(prev[1], box[1])
        overlap_bottom = min(prev[1] + prev[3], box[1] + box[3])
        overlap = max(0, overlap_bottom - overlap_top)
        if overlap > min(prev[3], box[3]) * 0.55:
            if box[2] * box[3] > prev[2] * prev[3]:
                deduped[-1] = box
        else:
            deduped.append(box)

    return deduped


def find_best_matching_box_index(
    target_box: Tuple[int, int, int, int],
    boxes: List[Tuple[int, int, int, int]],
) -> int:
    """Find the detected box that overlaps the sample box the most."""
    if not boxes:
        return -1

    tx, ty, tw, th = target_box
    target_right = tx + tw
    target_bottom = ty + th
    best_index = 0
    best_score = -1

    for idx, (x, y, w, h) in enumerate(boxes):
        right = x + w
        bottom = y + h
        overlap_w = max(0, min(target_right, right) - max(tx, x))
        overlap_h = max(0, min(target_bottom, bottom) - max(ty, y))
        score = overlap_w * overlap_h
        if score > best_score:
            best_score = score
            best_index = idx

    return best_index


def draw_level_on_card(image: np.ndarray, level: int) -> np.ndarray:
    """Draw a visible level badge on a weapon card using OpenCV."""
    output = image.copy()
    h, w = output.shape[:2]
    if h == 0 or w == 0:
        return output

    badge_w = max(int(w * 0.18), 72)
    badge_h = max(int(h * 0.18), 34)
    x1, y1 = 12, 12
    x2, y2 = min(w - 12, x1 + badge_w), min(h - 12, y1 + badge_h)

    overlay = output.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.72, output, 0.28, 0, output)
    cv2.rectangle(output, (x1, y1), (x2, y2), (0, 165, 255), 2)

    text = f"Lv {level}"
    font_scale = max(w / 420.0, 0.65)
    thickness = 2
    (text_w, text_h), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
    text_x = x1 + max(8, (badge_w - text_w) // 2)
    text_y = y1 + max(text_h + 4, (badge_h + text_h) // 2)
    cv2.putText(output, text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
    cv2.putText(output, text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 230, 120), thickness, cv2.LINE_AA)

    return output


def cluster_axis_positions(values: List[float], tolerance: float) -> List[Dict[str, float]]:
    """Cluster 1D positions and return groups sorted by size then position."""
    if not values:
        return []

    sorted_values = sorted(values)
    groups: List[List[float]] = [[sorted_values[0]]]
    for value in sorted_values[1:]:
        if abs(value - np.mean(groups[-1])) <= tolerance:
            groups[-1].append(value)
        else:
            groups.append([value])

    result = [
        {"center": float(np.mean(group)), "count": len(group)}
        for group in groups
    ]
    result.sort(key=lambda item: (-item["count"], item["center"]))
    return result


def nearest_center_index(value: float, centers: List[float]) -> int:
    """Return the index of the nearest center in a sorted center list."""
    return min(range(len(centers)), key=lambda idx: abs(value - centers[idx]))


def crop_box(
    image: np.ndarray,
    box: Tuple[int, int, int, int],
    margin: int = 0,
) -> np.ndarray:
    """Crop an image using an absolute box plus optional pixel margin."""
    h, w = image.shape[:2]
    x, y, bw, bh = box
    x1 = max(0, x - margin)
    y1 = max(0, y - margin)
    x2 = min(w, x + bw + margin)
    y2 = min(h, y + bh + margin)
    return image[y1:y2, x1:x2].copy()


def crop_weapon_slot(
    image: np.ndarray,
    box: Tuple[int, int, int, int],
) -> np.ndarray:
    """Crop tighter inside a weapon slot to remove UI borders and excess padding."""
    x, y, bw, bh = box
    inset_x = max(4, int(bw * 0.018))
    inset_top = max(4, int(bh * 0.032))
    inset_bottom = max(5, int(bh * 0.045))

    inner_box = (
        x + inset_x,
        y + inset_top,
        max(1, bw - inset_x * 2),
        max(1, bh - inset_top - inset_bottom),
    )
    return crop_box(image, inner_box, margin=0)


def crop_to_box_union(
    image: np.ndarray,
    boxes: List[Tuple[int, int, int, int]],
    margin: int = 0,
) -> np.ndarray:
    """Crop to the union of multiple boxes plus optional margin."""
    if not boxes:
        return image.copy()

    xs = [box[0] for box in boxes]
    ys = [box[1] for box in boxes]
    x2s = [box[0] + box[2] for box in boxes]
    y2s = [box[1] + box[3] for box in boxes]
    h, w = image.shape[:2]

    x1 = max(0, min(xs) - margin)
    y1 = max(0, min(ys) - margin)
    x2 = min(w, max(x2s) + margin)
    y2 = min(h, max(y2s) + margin)
    return image[y1:y2, x1:x2].copy()


def is_empty_cell(cell: np.ndarray, threshold: float = 0.92) -> bool:
    """Check if a cell is mostly empty/uniform (single color background)."""
    if cell.size == 0:
        return True
    
    gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
    # Calculate variance — low variance = mostly uniform = empty
    variance = np.var(gray)
    
    return variance < 100


def enhance_crop(image: np.ndarray) -> np.ndarray:
    """
    Enhance a cropped region: slight contrast boost, denoise.
    """
    # Slight contrast enhancement
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_channel)
    
    enhanced = cv2.merge([l_enhanced, a, b])
    result = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
    
    return result
