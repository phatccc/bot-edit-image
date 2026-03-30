# PUBG Mobile Showcase Generator

Web app tự động biến ảnh chụp giao diện acc PUBG Mobile thành ảnh showcase/poster đẹp mắt.

## Tech Stack

- **Backend**: FastAPI + OpenCV + Pillow
- **Frontend**: React + Vite
- **Image Processing**: Rule-based cropping (ratio-based) + poster composition

## Cấu trúc

```
Edit-Image-Web/
├── backend/           # FastAPI server
│   ├── main.py        # Entry point
│   ├── schemas.py     # Pydantic models
│   ├── routes/        # API endpoints
│   ├── services/      # Image processing
│   └── templates/     # Layout configs
├── frontend/          # React app
│   └── src/
│       ├── pages/     # Upload, Preview, Result
│       └── api.js     # API client
└── README.md
```

## Chạy local

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend sẽ chạy tại: http://localhost:8000  
API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend sẽ chạy tại: http://localhost:5173

### 3. Sử dụng

1. Mở http://localhost:5173
2. Upload 1 hoặc nhiều ảnh chụp màn hình PUBG Mobile
3. Preview ảnh → chọn template → click "Tạo Showcase"
4. Xem kết quả → Download từng ảnh hoặc tất cả (ZIP)
# bot-edit-image
