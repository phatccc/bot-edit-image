from pydantic import BaseModel
from typing import List, Optional


class FileInfo(BaseModel):
    filename: str
    original_name: str
    size: int
    width: int
    height: int
    url: str


class UploadResponse(BaseModel):
    files: List[FileInfo]
    message: str


class CustomRegion(BaseModel):
    x_ratio: float
    y_ratio: float
    w_ratio: float
    h_ratio: float


class ProcessRequest(BaseModel):
    filenames: List[str]
    template: str = "default"
    crop_type: str = "outfit"  # "outfit" or "weapon"
    outfit_preset: Optional[str] = None
    custom_grid: Optional[CustomRegion] = None


class OutputInfo(BaseModel):
    filename: str
    source_name: str
    url: str
    width: int
    height: int


class ProcessResponse(BaseModel):
    outputs: List[OutputInfo]
    message: str


class DownloadZipRequest(BaseModel):
    filenames: List[str]


class CropRegion(BaseModel):
    name: str
    x: int
    y: int
    width: int
    height: int
    label: Optional[str] = None
