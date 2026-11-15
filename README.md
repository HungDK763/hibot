# HiBot Studio (ROBOT_studio)

Hệ thống HMI & Digital Twin 3D điều khiển, giám sát robot n-bậc tự do (Robot HiBot / Industrial Arm) cho **Windows & Ubuntu/Linux**.

---

## 🏗️ Kiến trúc dự án

```
ROBOT_studio/
├── backend/
│   ├── server.py              # Server FastAPI + WebSocket + Mô phỏng + Phục vụ UI
│   ├── robot_state.py         # [CỐT LÕI] State & ControlParams (Thread-safe Lock)
│   ├── protocol.py            # [TÙY BIẾN GHÉP ROBOT] Parse incoming & Build frame
│   ├── transport.py           # Quản lý kênh UART (pyserial) và TCP Socket (ESP32)
│   ├── requirements.txt
│   ├── venv/                  # Môi trường ảo Python
│   └── ui/
│       ├── dist/              # [MỚI] Bản build từ frontend React/Vite (tự động phục vụ)
│       └── control_desk.html  # Bản giao diện cũ (dự phòng)
│
└── frontend/                  # [MỚI] Frontend chuẩn công nghiệp (Vite + React + Tailwind + Three.js)
    ├── src/
    │   ├── components/        # Header, JogPanel, Viewport3D, TcpDisplay, TrajectoryPanel, SystemPanel...
    │   ├── lib/urdf-kit.ts    # Thư viện 3D nạp URDF (XML) & STL Mesh (nhị phân / ASCII)
    │   ├── services/          # robotWs.ts (quản lý WebSocket 2 chiều thời gian thực)
    │   ├── types/             # Định nghĩa kiểu dữ liệu TypeScript
    │   ├── App.tsx            # Bố cục 3 cột điều khiển & giám sát
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

---

## 🚀 Hướng dẫn khởi chạy

### Cách 1: Chạy ứng dụng sản xuất (Production / Khuyên dùng)
Backend sẽ tự động nạp giao diện React mới đã build sẵn trong `backend/ui/dist`:

```bash
# 1. Kích hoạt môi trường Python và chạy server
cd backend
source venv/bin/activate    # Trên Windows: venv\Scripts\activate
python server.py
```
👉 Mở trình duyệt tại: **http://localhost:8765**

---

### Cách 2: Phát triển giao diện (Frontend Development với Hot Reload)
Khi bạn muốn chỉnh sửa, thêm nút, đổi màu sắc, thêm biểu đồ:

```bash
# Terminal 1: Chạy backend Python
cd backend
source venv/bin/activate
python server.py

# Terminal 2: Chạy Frontend Vite dev server (Hot Reload cực nhanh)
cd frontend
npm run dev
```
👉 Mở trình duyệt tại: **http://localhost:5173** (Mọi thay đổi trong code React/CSS sẽ cập nhật tức thì trên màn hình).

Sau khi chỉnh sửa xong, chỉ cần build lại:
```bash
cd frontend
npm run build
```
*(File build sẽ tự động xuất thẳng vào `backend/ui/dist/` để `server.py` phục vụ).*

---

## ⚡ Các tính năng chính

1. **Digital Twin 3D thời gian thực:**
   - Dựng trực tiếp mô hình cánh tay robot từ file URDF và các file lưới STL (cả nhị phân và ASCII).
   - Tự động nhận diện số bậc tự do ($n$-DOF), loại khớp (`revolute`, `continuous`, `prismatic`), trục xoay và giới hạn mềm.
   - Hỗ trợ chuột: Xoay quanh tâm (Orbit), Di chuyển (Pan), Phóng to/thu nhỏ (Zoom), Bật/Tắt lưới tọa độ và Trục TCP.

2. **Điều khiển trục (Jog Panel):**
   - Điều khiển từng trục khớp độc lập bằng Slider kéo hoặc nút `+` / `−`.
   - Lựa chọn bước nhảy góc: `1°`, `5°`, `15°`.
   - Hiển thị mô-men xoắn (Nm) và dòng điện (A) theo thời gian thực; tự động chuyển màu đỏ cảnh báo khi vượt ngưỡng an toàn.
   - Thanh trượt điều chỉnh tốc độ tổng của hệ thống.

3. **Thực thi Quỹ đạo (Trajectory):**
   - Chạy/Tạm dừng/Đặt lại quỹ đạo chu trình Pick & Place (`Home` $\rightarrow$ `Tiếp cận` $\rightarrow$ `Gắp` $\rightarrow$ `Nâng` $\rightarrow$ `Đặt` $\rightarrow$ `Home`).
   - Thanh tua tiến trình trực quan theo thời gian thực.

4. **Tọa độ đầu công cụ (TCP Strip):**
   - Hiển thị chính xác tọa độ $X, Y, Z$ (mm) và góc xoay $Rx, Ry, Rz$ (độ) của đầu công cụ.

5. **Cơ chế an toàn & Chẩn đoán:**
   - Nút **Dừng khẩn cấp (E-Stop)** kích hoạt viền đỏ cảnh báo toàn màn hình.
   - Nút **Servo Enable** và **Về Home**.
   - Bảng chẩn đoán cảnh báo (Alarms) và Hộp nhật ký sự kiện thời gian thực (Event Log).

6. **Kết nối phần cứng:**
   - **UART / USB-TTL**: Tự động quét danh sách cổng COM, tùy chọn baudrate lên tới 6 Mbps.
   - **TCP/IP (ESP32)**: Kết nối socket qua WiFi/Ethernet.
   - **Mô phỏng dự phòng (Fallback Sim)**: Khi chưa kết nối robot thật, hệ thống tự động sinh chuyển động hình sin để kiểm tra giao diện.
