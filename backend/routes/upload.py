from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from typing import List
from PIL import Image
import os
import uuid
import shutil

from schemas import FileInfo, UploadResponse


router = APIRouter(prefix="/api", tags=["upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


@router.post("/upload", response_model=UploadResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload one or more PUBG Mobile screenshots."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    uploaded = []
    allowed_types = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
    
    for file in files:
        # Validate file type
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file.content_type} not allowed. Use PNG, JPEG, or WebP."
            )
        
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1] or ".png"
        unique_name = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, unique_name)
        
        # Save uploaded file
        with open(filepath, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Get image dimensions
        try:
            with Image.open(filepath) as img:
                width, height = img.size
        except Exception:
            os.remove(filepath)
            raise HTTPException(status_code=400, detail=f"Cannot read image: {file.filename}")
        
        file_size = os.path.getsize(filepath)
        
        uploaded.append(FileInfo(
            filename=unique_name,
            original_name=file.filename,
            size=file_size,
            width=width,
            height=height,
            url=f"/api/uploads/{unique_name}"
        ))
    
    return UploadResponse(
        files=uploaded,
        message=f"Successfully uploaded {len(uploaded)} file(s)"
    )


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve an uploaded image."""
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)
