from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from typing import List
import os
import io
import zipfile

from schemas import ProcessRequest, ProcessResponse, OutputInfo, DownloadZipRequest
from services.processor import process_multiple


router = APIRouter(prefix="/api", tags=["process"])

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")


@router.post("/process", response_model=ProcessResponse)
async def process_images(request: ProcessRequest):
    """
    Process uploaded PUBG Mobile screenshots into showcase posters.
    """
    if not request.filenames:
        raise HTTPException(status_code=400, detail="No filenames provided")
    
    results = process_multiple(
        request.filenames,
        request.template,
        crop_type=request.crop_type,
        outfit_preset=request.outfit_preset,
        custom_grid=request.custom_grid,
    )
    
    outputs = []
    errors = []
    
    for result in results:
        if result.get("error"):
            errors.append(f"{result['source_name']}: {result['error']}")
        elif result.get("filename"):
            outputs.append(OutputInfo(
                filename=result["filename"],
                source_name=result["source_name"],
                url=f"/api/outputs/{result['filename']}",
                width=result["width"],
                height=result["height"]
            ))
    
    message = f"Processed {len(outputs)} image(s)"
    if errors:
        message += f". Errors: {'; '.join(errors)}"
    
    return ProcessResponse(outputs=outputs, message=message)


@router.get("/outputs/{filename}")
async def get_output_file(filename: str):
    """Serve a processed output image."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath, media_type="image/png")


@router.post("/download-zip")
async def download_zip(request: DownloadZipRequest):
    """Create and return a ZIP file containing selected output images."""
    if not request.filenames:
        raise HTTPException(status_code=400, detail="No filenames provided")
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename in request.filenames:
            filepath = os.path.join(OUTPUT_DIR, filename)
            if os.path.exists(filepath):
                zf.write(filepath, arcname=filename)
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=pubg_showcase.zip"
        }
    )


@router.get("/templates")
async def list_templates():
    """List available templates."""
    template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
    templates = []
    
    if os.path.exists(template_dir):
        for f in os.listdir(template_dir):
            if f.endswith(".json"):
                templates.append({
                    "name": os.path.splitext(f)[0],
                    "filename": f
                })
    
    return {"templates": templates}
