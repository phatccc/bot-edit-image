import cv2
import os
import uuid
from typing import Optional, Any
from .detector import (
    build_inventory_result,
    detect_and_crop_regions,
    load_template,
    enhance_crop,
    normalize_image_for_crop_type,
)
from .composer import compose_showcase


OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


def process_image(filepath: str, template_name: str = "default",
                  crop_type: str = "outfit", outfit_preset: Optional[str] = None,
                  custom_grid: Any = None) -> dict:
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
    
    # Enhance character crop
    if "character" in crops:
        crops["character"] = enhance_crop(crops["character"])
    
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
                     custom_grid: Any = None) -> list:
    """Process multiple images and return list of output info."""
    results = []
    for filename in filenames:
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(filepath):
            try:
                result = process_image(
                    filepath,
                    template_name,
                    crop_type=crop_type,
                    outfit_preset=outfit_preset,
                    custom_grid=custom_grid,
                )
                results.append(result)
            except Exception as e:
                results.append({
                    "filename": None,
                    "source_name": filename,
                    "error": str(e)
                })
    return results
