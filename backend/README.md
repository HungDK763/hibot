# HiBot Control Desk — gói bàn giao (frontend + backend)

HMI robot n‑bậc tự do (Robot HiBot) cho **Windows + Ubuntu**. Giao diện là một
file HTML tự chứa; backend Python phục vụ nó và giao tiếp với robot qua **một
trong hai** kênh loại trừ nhau: **UART/USB‑TTL** hoặc **TCP/IP (ESP32)**.

```
backend/
├─ server.py          # cầu nối UI ↔ robot (WebSocket + phục vụ UI + mô phỏng dự phòng)
├─ robot_state.py     # ★ STRUCT TOÀN CỤC: RobotState, ControlParams + hàm update_*
├─ protocol.py        # ★ BẠN VIẾT: parse_incoming() tách gói · build_frame() dựng frame
├─ transport.py       # kênh UART (pyserial) & TCP (socket) + ConnectionManager (chỉ 1 kênh)
├─ requirements.txt
├─ README.md
├─ frontend_src/       # mã nguồn giao diện ĐỂ CHỈNH SỬA (Control Desk.dc.html + urdf-kit.js + support.js)
└─ ui/
   └─ control_desk.html  # giao diện đã gộp (tự chứa, không cần internet) — server phục vụ file này
```

Dấu ★ = hai file bạn sẽ chỉnh khi ghép robot thật. Các file còn lại dùng nguyên.

---

## 1. Chạy

```bash
cd backend
pip install -r requirements.txt
python server.py
```

Mở **http://localhost:8765**. Bấm chip kết nối ở góc phải header để mở hộp thoại
**Kết nối robot**.

- **UART · USB‑TTL**: chọn cổng COM (nút ⟳ quét lại), nhập/chọn **baud** (tới
  **6 Mbps**), bấm **Kết nối**.
- **TCP/IP · ESP32**: nhập **địa chỉ IP** (ESP32 ở chế độ AP/STA) + **cổng**,
  bấm **Kết nối**.
- Chỉ **một** kênh hoạt động: chọn kênh này tự tắt kênh kia.
- Chưa kết nối phần cứng → server chạy **mô phỏng** để UI vẫn có dữ liệu.

> Kênh UART/serial phải chạy qua backend (trình duyệt không mở COM 6 Mbps ổn
> định). Mở file `ui/control_desk.html` trực tiếp chỉ để xem giao diện (demo).

---

## 2. Hai STRUCT toàn cục (robot_state.py)

**`RobotState`** — trạng thái robot (robot → máy tính):
`joint_pos[]`, `joint_vel[]`, `torque[]`, `current[]`, `x y z rx ry rz`,
`servo` ("on"|"off"|"fault"), `estop`, `fault_code`.

**`ControlParams`** — tham số điều khiển (máy tính → robot):
`mode`, `enabled`, `estop`, `speed`, `jog_target[]`, `traj_action`,
`traj_progress`, `button_home`, `seq`.

Hai biến toàn cục: `STATE` và `CONTROL`. Mọi truy cập đều **thread‑safe** (Lock).

### Hàm cập nhật trạng thái — gọi khi bạn tách gói tin
```python
import robot_state as rs
rs.update_joint_positions([j1, j2, j3, j4, j5, j6])   # góc (độ) / mm
rs.update_joint_velocities([...])
rs.update_torque([...])          # Nm
rs.update_current([...])         # A
rs.update_tcp(x=..., y=..., z=..., rx=..., ry=..., rz=...)   # mm & độ
rs.update_servo(servo="on", estop=False, fault_code=0)
```
Đổi số bậc tự do khi nạp URDF khác: `rs.set_dof(3)`.

---

## 3. Ghép robot thật — chỉ sửa `protocol.py`

```python
def parse_incoming(data: bytes):
    # gom buffer, tách frame của bạn, rồi gọi rs.update_*(...)
    ...

def build_frame(c: rs.ControlParams) -> bytes:
    # từ c.mode / c.enabled / c.estop / c.speed / c.jog_target / c.button_home
    # dựng đúng chuỗi byte frame của bạn để đẩy xuống robot
    return b"..."
```

- Bản mẫu đang dùng khung **ASCII** phân tách bằng dấu phẩy để chạy thử ngay.
- Có sẵn **mẫu frame nhị phân + CRC8** (`build_frame_binary`, `_crc8`) để bạn
  bật khi cần tốc độ cao — chỉ việc trỏ `build_frame` sang nó.
- `parse_incoming` được gọi tự động mỗi khi kênh (UART/TCP) có byte mới.
- `build_frame` được gọi mỗi khi UI ra lệnh (và đang có kết nối) — server tự
  gửi kết quả xuống robot.

---

## 4. Luồng dữ liệu

```
   Robot ──bytes──► transport ──► protocol.parse_incoming ──► STATE (update_*)
                                                                  │
                                                    server đẩy 25 Hz ▼
   Robot ◄─frame── transport ◄── protocol.build_frame ◄── CONTROL ◄── lệnh UI
                                                                  ▲  (jog/estop…)
                                                        WebSocket │
                                                            Giao diện (UI)
```

---

## 5. Giao thức WebSocket UI ↔ server (tham khảo)

UI → server: `{"type":"list_ports"}`,
`{"type":"connect","transport":"uart","port":"COM5","baud":6000000}`,
`{"type":"connect","transport":"tcp","ip":"192.168.4.1","port":5000}`,
`{"type":"disconnect"}`, và lệnh điều khiển
`{"type":"jog","joint":2,"angle":-35}` / `home` / `enable` / `estop` / `speed`
/ `set_mode` / `traj`.

server → UI: `{"type":"ports","ports":[{device,description}]}`,
`{"type":"conn_status","transport","state","message"}`,
`{"type":"state", angles, torques, vel, current, tcp, servo}`.

---

## 6. Đóng gói thành app desktop (tuỳ chọn)

- **Python cửa sổ riêng**: `pywebview`/`PyQt QWebEngineView` mở
  `http://localhost:8765`.
- Đóng gói: PyInstaller (`.exe`), AppImage/`.deb` (Ubuntu).

## 7. Cập nhật giao diện

`ui/control_desk.html` sinh từ thiết kế nguồn (`Control Desk.dc.html`). Chỉnh ở
công cụ thiết kế rồi xuất lại; đừng sửa tay file đã gộp.
