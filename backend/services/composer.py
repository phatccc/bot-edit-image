from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps, ImageEnhance
import numpy as np
import cv2
from typing import List, Dict, Any, Optional, Tuple
import os


def cv2_to_pil(cv_img: np.ndarray) -> Image.Image:
    """Convert OpenCV BGR image to PIL RGB Image."""
    rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def pil_to_cv2(image: Image.Image) -> np.ndarray:
    """Convert PIL RGB Image to OpenCV BGR."""
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def create_gradient_background(width: int, height: int,
                                color_start: Tuple[int, int, int],
                                color_end: Tuple[int, int, int]) -> Image.Image:
    """Create a vertical gradient background."""
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)
    
    for y in range(height):
        ratio = y / height
        r = int(color_start[0] + (color_end[0] - color_start[0]) * ratio)
        g = int(color_start[1] + (color_end[1] - color_start[1]) * ratio)
        b = int(color_start[2] + (color_end[2] - color_start[2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    return img


def add_rounded_border(image: Image.Image, border_width: int = 3,
                       border_color: Tuple[int, int, int] = (255, 165, 0),
                       radius: int = 15) -> Image.Image:
    """Add rounded border to an image."""
    if border_width <= 0 and radius <= 0:
        return image.convert("RGBA")

    w, h = image.size
    new_w = w + border_width * 2
    new_h = h + border_width * 2
    
    # Create border background
    border_img = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(border_img)
    
    # Draw rounded rectangle for border
    draw.rounded_rectangle(
        [(0, 0), (new_w - 1, new_h - 1)],
        radius=radius,
        fill=border_color + (255,),
        outline=None
    )
    
    # Draw inner rounded rectangle (slightly smaller)
    draw.rounded_rectangle(
        [(border_width, border_width), (new_w - border_width - 1, new_h - border_width - 1)],
        radius=max(0, radius - border_width),
        fill=(0, 0, 0, 255),
        outline=None
    )
    
    # Paste original image inside border
    result = border_img.copy()
    
    # Create mask for rounded corners
    mask = Image.new("L", (w, h), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        [(0, 0), (w - 1, h - 1)],
        radius=max(0, radius - border_width),
        fill=255
    )
    
    image_rgba = image.convert("RGBA")
    result.paste(image_rgba, (border_width, border_width), mask)
    
    return result


def add_glow_effect(image: Image.Image, color: Tuple[int, int, int] = (255, 165, 0),
                    intensity: int = 20) -> Image.Image:
    """Add subtle outer glow effect."""
    w, h = image.size
    glow_size = intensity
    
    canvas = Image.new("RGBA", (w + glow_size * 2, h + glow_size * 2), (0, 0, 0, 0))
    
    # Create glow layer
    glow = Image.new("RGBA", (w + glow_size * 2, h + glow_size * 2), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(
        [(0, 0), (w + glow_size * 2 - 1, h + glow_size * 2 - 1)],
        radius=20,
        fill=color + (60,)
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=intensity))
    
    canvas = Image.alpha_composite(canvas, glow)
    canvas.paste(image, (glow_size, glow_size), image if image.mode == "RGBA" else None)
    
    return canvas


def enhance_display_image(image: Image.Image, crop_type: str) -> Image.Image:
    """Apply mild display tuning for specific crop types."""
    if crop_type == "weapon":
        bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.16, 0, 255)
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.04, 0, 255)
        tuned = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
        image = Image.fromarray(tuned)
        image = ImageEnhance.Color(image).enhance(1.06)
        image = ImageEnhance.Contrast(image).enhance(1.08)
        image = ImageEnhance.Sharpness(image).enhance(1.08)
    return image


def get_font(size: int = 24) -> ImageFont.FreeTypeFont:
    """Get a font, falling back to default if custom font not available."""
    font_paths = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSMono.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    
    return ImageFont.load_default()


def compose_showcase(crops: Dict[str, Any], template: dict,
                     inventory_items: Optional[List[np.ndarray]] = None,
                     crop_type: str = "outfit") -> Image.Image:
    """
    Compose the final showcase poster from cropped regions.
    
    Args:
        crops: Dict with region_name -> cv2 image
        template: Template config dict
        inventory_items: List of individual inventory item images
    
    Returns:
        PIL Image of the composed poster
    """
    layout = template["poster_layout"]
    out_w = template["output_width"]
    out_h = template["output_height"]
    bg_config = template["background"]
    weapon_items_only = crop_type == "weapon" and layout.get("weapon_items_only", False)
    single_image_only = (
        crop_type in {"outfit", "helmet"} and layout.get("outfit_single_image_only", False)
    ) or (
        crop_type == "weapon" and layout.get("weapon_single_image_only", False)
    )

    if weapon_items_only and inventory_items:
        inv_config = layout["weapon_items"]
        max_items = inv_config["cols"] * inv_config["rows"]
        item_count = min(len(inventory_items), max_items)
        out_w = inv_config["start_x"] + inv_config["item_width"] + inv_config.get("right_padding", inv_config["start_x"])
        out_h = (
            inv_config["start_y"]
            + item_count * inv_config["item_height"]
            + max(0, item_count - 1) * inv_config["gap"]
            + inv_config.get("bottom_padding", inv_config["start_y"])
        )

    prepared_character = None
    char_config = None
    if "character" in crops and not weapon_items_only:
        if crop_type == "weapon" and "weapon_character" in layout:
            char_config = layout["weapon_character"]
        else:
            char_config = layout["character"]

        char_img = cv2_to_pil(crops["character"])
        if single_image_only:
            char_img = ImageOps.contain(
                char_img,
                (char_config["width"], char_config["height"]),
                method=Image.Resampling.LANCZOS,
            )
        else:
            char_img = ImageOps.fit(
                char_img,
                (char_config["width"], char_config["height"]),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5)
            )

        prepared_character = add_rounded_border(
            char_img,
            border_width=char_config.get("border_width", 3),
            border_color=tuple(char_config.get("border_color", [255, 165, 0])),
            radius=char_config.get("border_radius", 20)
        )

        if single_image_only:
            out_w = char_config["x"] + prepared_character.width + char_config.get("right_padding", char_config["x"])
            out_h = char_config["y"] + prepared_character.height + char_config.get("bottom_padding", 20)
    
    # Create gradient background
    poster = create_gradient_background(
        out_w, out_h,
        tuple(bg_config["color_start"]),
        tuple(bg_config["color_end"])
    )
    poster = poster.convert("RGBA")
    
    # Add subtle pattern overlay
    overlay = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    for y in range(0, out_h, 4):
        overlay_draw.line([(0, y), (out_w, y)], fill=(255, 255, 255, 5))
    poster = Image.alpha_composite(poster, overlay)
    
    # === Place Character / Main Model ===
    if prepared_character is not None and char_config is not None:
        paste_x = char_config["x"]
        if not single_image_only:
            paste_x += max(0, (char_config["width"] - prepared_character.width) // 2)
        poster.paste(prepared_character, (paste_x, char_config["y"]),
                     prepared_character if prepared_character.mode == "RGBA" else None)
    
    # === Place Inventory Items ===
    if not single_image_only and inventory_items and len(inventory_items) > 0:
        if crop_type == "weapon" and "weapon_items" in layout:
            inv_config = layout["weapon_items"]
        else:
            inv_config = layout["inventory_items"]
            
        max_items = inv_config["cols"] * inv_config["rows"]
        items_to_place = inventory_items[:max_items]
        
        for idx, item_cv in enumerate(items_to_place):
            row = idx // inv_config["cols"]
            col = idx % inv_config["cols"]
            
            x = inv_config["start_x"] + col * (inv_config["item_width"] + inv_config["gap"])
            y = inv_config["start_y"] + row * (inv_config["item_height"] + inv_config["gap"])
            
            item_pil = cv2_to_pil(item_cv)
            item_pil = enhance_display_image(item_pil, crop_type)
            if crop_type == "weapon":
                # Use fit instead of contain to ensure the weapon fills the card without padding
                item_pil = ImageOps.fit(
                    item_pil,
                    (inv_config["item_width"], inv_config["item_height"]),
                    method=Image.Resampling.LANCZOS,
                    centering=(0.5, 0.5)
                )
            else:
                item_pil = ImageOps.fit(
                    item_pil,
                    (inv_config["item_width"], inv_config["item_height"]),
                    method=Image.Resampling.LANCZOS,
                    centering=(0.5, 0.5)
                )
            
            bordered_item = add_rounded_border(
                item_pil,
                border_width=inv_config.get("border_width", 2),
                border_color=tuple(inv_config.get("border_color", [255, 140, 0])),
                radius=inv_config.get("border_radius", 12)
            )
            
            poster.paste(bordered_item, (x, y),
                         bordered_item if bordered_item.mode == "RGBA" else None)
    
    # === Place Stats Bar ===
    if "stats_bar" in crops:
        stats_config = layout["stats_bar"]
        stats_img = cv2_to_pil(crops["stats_bar"])
        stats_img = stats_img.resize(
            (stats_config["width"], stats_config["height"]),
            Image.Resampling.LANCZOS
        )
        bordered_stats = add_rounded_border(
            stats_img,
            border_width=stats_config.get("border_width", 2),
            border_color=tuple(stats_config.get("border_color", [100, 100, 100])),
            radius=stats_config.get("border_radius", 10)
        )
        poster.paste(bordered_stats, (stats_config["x"], stats_config["y"]),
                     bordered_stats if bordered_stats.mode == "RGBA" else None)
    
    # === Add Title Text ===
    draw = ImageDraw.Draw(poster)
    title_config = layout.get("title", {})
    if title_config and title_config.get("text"):
        title_font = get_font(title_config.get("font_size", 36))
        draw.text(
            (title_config["x"], title_config["y"]),
            title_config["text"],
            fill=tuple(title_config.get("color", [255, 165, 0])) + (255,),
            font=title_font
        )
    
    # === Add Subtitle ===
    subtitle_config = layout.get("subtitle", {})
    if subtitle_config and subtitle_config.get("text"):
        sub_font = get_font(subtitle_config.get("font_size", 22))
        draw.text(
            (subtitle_config["x"], subtitle_config["y"]),
            subtitle_config["text"],
            fill=tuple(subtitle_config.get("color", [200, 200, 200])) + (255,),
            font=sub_font
        )
    
    # === Add Watermark ===
    wm_config = layout.get("watermark", {})
    if wm_config and wm_config.get("text"):
        wm_font = get_font(wm_config.get("font_size", 16))
        wm_y = out_h - wm_config.get("y_offset", 50)
        wm_text = wm_config.get("text", "")
        bbox = draw.textbbox((0, 0), wm_text, font=wm_font)
        wm_w = bbox[2] - bbox[0]
        wm_x = (out_w - wm_w) // 2
        draw.text(
            (wm_x, wm_y),
            wm_text,
            fill=tuple(wm_config.get("color", [120, 120, 120, 180])),
            font=wm_font
        )
    
    return poster.convert("RGB")


def merge_images_vertically(filenames: List[str], output_dir: str) -> str:
    """
    Merge multiple images vertically into a single image.
    All images are resized to the same width (width of the first image).
    """
    import uuid
    from PIL import Image

    if not filenames:
        return ""
    
    valid_images = []
    max_width = 0
    total_height = 0
    
    for fname in filenames:
        path = os.path.join(output_dir, fname)
        if os.path.exists(path):
            try:
                img = Image.open(path)
                valid_images.append(img)
                if max_width == 0:
                    max_width = img.size[0]
            except Exception:
                continue
            
    if not valid_images:
        return ""
        
    # Calculate total height after resizing
    resized_images = []
    for img in valid_images:
        if img.size[0] != max_width:
            w_percent = (max_width / float(img.size[0]))
            h_size = int((float(img.size[1]) * float(w_percent)))
            img = img.resize((max_width, h_size), Image.Resampling.LANCZOS)
        resized_images.append(img)
        total_height += img.size[1]
        
    merged_img = Image.new("RGB", (max_width, total_height), (18, 18, 28))
    current_y = 0
    
    for img in resized_images:
        merged_img.paste(img, (0, current_y))
        current_y += img.size[1]
        
    out_filename = f"merged_{uuid.uuid4().hex[:8]}.jpg"
    merged_img.save(os.path.join(output_dir, out_filename), "JPEG", quality=90)
    return out_filename


def compose_inventory_tight_grid(items: List[np.ndarray], cols: int = 3) -> Image.Image:
    """
    Compose a tight grid (collage) of the inventory items without gaps.
    """
    if not items:
        return Image.new("RGB", (100, 100), (0, 0, 0))
        
    pil_items = [cv2_to_pil(item) for item in items]
    
    max_w = max(item.width for item in pil_items)
    max_h = max(item.height for item in pil_items)
    
    # Resize items uniformly
    resized = []
    for item in pil_items:
        resized.append(ImageOps.fit(item, (max_w, max_h), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)))
        
    rows = (len(resized) + cols - 1) // cols
    
    grid_w = max_w * cols
    grid_h = max_h * rows
    
    grid_img = Image.new("RGB", (grid_w, grid_h), (0, 0, 0))
    
    for idx, item in enumerate(resized):
        row = idx // cols
        col = idx % cols
        grid_img.paste(item, (col * max_w, row * max_h))
        
    return grid_img
