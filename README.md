# Game Account Showcase Generator

Web app tự động phân tích và biến đổi ảnh chụp màn hình giao diện tài khoản game thành những tấm ảnh showcase/poster cực chất và chuyên nghiệp.

## Công nghệ sử dụng
- **Backend**: FastAPI + Python (OpenCV + Pillow để xử lý hình ảnh)
- **Frontend**: React + Vite
- **Tính năng chính**: Nhận diện khung hình, cắt lọc vật phẩm theo tỷ lệ thông minh và ghép vào template poster ấn tượng. Có tích hợp công cụ tùy chỉnh vùng cắt (Crop) thủ công trực tiếp trên web.

## Yêu cầu hệ thống
- Máy tính cần cài đặt sẵn **Python 3.9+** và **Node.js (npm)**.

---

## Hướng dẫn cài đặt và chạy Local

Ứng dụng chia làm 2 phần độc lập: **Backend** (xử lý ảnh) và **Frontend** (giao diện người dùng). Bạn cần mở 2 cửa sổ Terminal để chạy song song cả 2 phần này.

### Bước 1: Khởi chạy Backend (Server xử lý)

Mở Terminal / Command Prompt và gõ lần lượt các lệnh sau:

```bash
# 1. Đi tới thư mục backend
cd backend

# 2. Tạo môi trường ảo để cài thư viện
python3 -m venv venv

# 3. Kích hoạt môi trường ảo
# - Nếu dùng Mac/Linux:
source venv/bin/activate
# - Nếu dùng Windows:
# venv\Scripts\activate

# 4. Cài đặt các thư viện cần thiết
pip install -r requirements.txt

# 5. Khởi chạy server FastAPI
uvicorn main:app --reload --port 8000 --host 127.0.0.1
```
*(Backend sẽ chạy tại địa chỉ `http://127.0.0.1:8000`. Bạn có thể để cửa sổ này tự chạy và mở một cửa sổ khác cho Frontend)*

### Bước 2: Khởi chạy Frontend (Giao diện API)

Mở một cửa sổ Terminal **MỚI** (vẫn giữ cửa sổ cũ đang chạy Backend) và gõ:

```bash
# 1. Đi tới thư mục frontend
cd frontend

# 2. Cài đặt package của React
npm install

# 3. Chạy giao diện web
npm run dev
```

### Bước 3: Sử dụng ứng dụng

1. Mở trình duyệt và truy cập vào địa chỉ **`http://localhost:5173`**
2. Upload (Tải lên) 1 hoặc nhiều ảnh chụp màn hình kho đồ trong game của bạn.
3. Chọn chế độ cắt (Trang phục hoặc Vũ khí...) và dùng thanh trượt để tinh chỉnh khung cắt nếu cần.
4. Xem trước ảnh (Preview) và nhấn **Tạo Showcase**.
5. Tải xuống thành phẩm từng tấm hoặc tải hàng loạt bằng file `.ZIP`.

---

## Cấu trúc thư mục

```text
Edit-Image-Web/
├── backend/           # Server FastAPI (Python)
│   ├── main.py        # Điểm khởi chạy backend
│   ├── schemas.py     # Định nghĩa dữ liệu (Pydantic)
│   ├── routes/        # Các API Endpoint
│   ├── services/      # Xử lý hình ảnh lõi (Cắt, ghép, áp filter)
│   └── templates/     # Chứa config Json định vị Layout ghép ảnh
└── frontend/          # Ứng dụng React
    └── src/
        ├── pages/     # Giao diện từng bước (Upload, CropType, Preview, Result)
        └── api.js     # Hàm chuẩn bị dữ liệu gửi lên Backend
```
