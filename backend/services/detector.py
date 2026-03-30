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
    detected_boxes = detect_inventory_cell_boxes(
        image,
        cols=grid_config.get("cols", 3),
        rows=grid_config.get("rows", 4),
    )

    if detected_boxes:
        preview = crop_to_box_union(image, detected_boxes, margin=8)
        items = [crop_box(image, box, margin=6) for box in detected_boxes]
    else:
        preview = image.copy()
        items = crop_grid_items(image, grid_config)

    return {
        "screen_type": screen_type,
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
