import cv2
import os
import uuid
from typing import Optional, Any, List, Dict
from .detector import (
    build_inventory_result,
    build_weapon_result,
    detect_and_crop_regions,
    load_template,
    enhance_crop,
    normalize_image_for_crop_type,
    draw_level_on_card,
)
from .composer import compose_showcase
from .weapon_level import detect_weapon_level


OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


def save_item_outputs(
    filepath: str,
    items: List[cv2.typing.MatLike],
    suffix: str,
    detected_level: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Save each detected inventory item as its own standalone output image."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(filepath))[0]
    source_name = os.path.basename(filepath)
    results: List[Dict[str, Any]] = []

    for idx, item in enumerate(items, start=1):
        if item is None or getattr(item, "size", 0) == 0:
            continue

        output_name = f"showcase_{base_name}_{suffix}_{idx:02d}_{uuid.uuid4().hex[:6]}.png"
        output_path = os.path.join(OUTPUT_DIR, output_name)
        cv2.imwrite(output_path, item)

        height, width = item.shape[:2]
        result = {
            "filename": output_name,
            "source_name": f"{source_name} • item {idx:02d}",
            "width": width,
            "height": height,
            "path": output_path,
        }
        if detected_level is not None:
            result["detected_level"] = str(detected_level)
        results.append(result)

    return results


def process_image(filepath: str, template_name: str = "default",
                  crop_type: str = "outfit", outfit_preset: Optional[str] = None,
                  custom_grid: Any = None, detect_level: bool = False) -> dict:
    """
    Full processing pipeline for a single PUBG Mobile screenshot.
    
    1. Load image
    2. Load template
    3. Detect screen type & crop regions (based on crop_type)
    4. Enhance crops
    5. Compose showcase poster
    6. Save output
    
    Returns dict with output info.
    """
    # Load image
    image = cv2.imread(filepath)
    if image is None:
        raise ValueError(f"Cannot read image: {filepath}")
    
    # Load template
    template = load_template(template_name)

    working_image, normalization_meta = normalize_image_for_crop_type(
        image,
        template,
        crop_type=crop_type,
        outfit_preset=outfit_preset,
        custom_grid=custom_grid,
    )
    
    # Outfit mode is inventory-focused, so always use the inventory/grid source directly.
    if crop_type in {"outfit", "helmet"}:
        screen_type = "helmet_screen" if crop_type == "helmet" else "outfit_screen"
        detection_result = build_inventory_result(working_image, template, screen_type=screen_type)
    elif crop_type == "weapon":
        detection_result = build_weapon_result(working_image, template, custom_grid=custom_grid)
    else:
        # Detect and crop using user-selected crop_type and custom grid
        detection_result = detect_and_crop_regions(
            working_image,
            template,
            crop_type=crop_type,
            custom_grid=custom_grid,
        )
    crops = detection_result["crops"]
    inventory_items = detection_result.get("inventory_items", [])

    if crop_type == "weapon":
        detected_level = None
        if detect_level and inventory_items:
            detected_level = detect_weapon_level(filepath)
        item_results = save_item_outputs(filepath, inventory_items, suffix="weapon", detected_level=detected_level)
        if item_results:
            return item_results
            
    if crop_type == "character":
        # For character crop, we just want the character crop itself
        character_crop = crops.get("character")
        if character_crop is not None:
            item_results = save_item_outputs(filepath, [character_crop], suffix="character")
            if item_results:
                return item_results
    
    # Keep inventory colors identical to the original screenshot.
    if "character" in crops and crop_type not in {"outfit", "helmet", "weapon"}:
        crops["character"] = enhance_crop(crops["character"])
    
    if crop_type in {"outfit", "helmet"} and inventory_items:
        from .composer import compose_inventory_tight_grid
        poster = compose_inventory_tight_grid(inventory_items, cols=3)
    else:
        # Compose poster
        poster = compose_showcase(crops, template, inventory_items, crop_type=crop_type)
    
    # Save output
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(filepath))[0]
    output_name = f"showcase_{base_name}_{uuid.uuid4().hex[:6]}.png"
    output_path = os.path.join(OUTPUT_DIR, output_name)
    poster.save(output_path, "PNG", quality=95)
    
    return {
        "filename": output_name,
        "source_name": os.path.basename(filepath),
        "width": poster.width,
        "height": poster.height,
        "path": output_path
    }


def process_multiple(filenames: list, template_name: str = "default",
                     crop_type: str = "outfit", outfit_preset: Optional[str] = None,
                     custom_grid: Any = None, detect_level: bool = False) -> list:
    """Process multiple images in parallel and return list of output info."""
    from concurrent.futures import ThreadPoolExecutor
    
    def process_single(filename):
        filepath = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(filepath):
            return {"filename": None, "source_name": filename, "error": "File not found"}
            
        try:
            return process_image(
                filepath,
                template_name,
                crop_type=crop_type,
                outfit_preset=outfit_preset,
                custom_grid=custom_grid,
                detect_level=detect_level,
            )
        except Exception as e:
            return {"filename": None, "source_name": filename, "error": str(e)}

    results = []
    # Use max 4 workers to avoid overwhelming CPU/Memory (EasyOCR uses some RAM)
    with ThreadPoolExecutor(max_workers=4) as executor:
        batch_results = list(executor.map(process_single, filenames))
        
    for res in batch_results:
        if isinstance(res, list):
            results.extend(res)
        else:
            results.append(res)
            
    return results
