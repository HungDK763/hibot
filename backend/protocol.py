#!/usr/bin/env python3
"""
protocol.py — TÁCH GÓI TIN & DỰNG FRAME  (PHẦN BẠN TỰ VIẾT)
===========================================================

Đây là nơi DUY NHẤT bạn cần chỉnh khi ghép robot thật. Hai chiều:

  parse_incoming(data: bytes)  — robot -> máy tính:
      tách các byte nhận từ UART/TCP, rồi gọi robot_state.update_* để nạp
      góc khớp / mô-men / dòng điện / vị trí TCP / trạng thái servo.

  build_frame(control) -> bytes — máy tính -> robot:
      từ ControlParams (nút, mode, jog target, speed, estop, home...) dựng
      chuỗi byte đúng định dạng frame của bạn để đẩy xuống robot.

Bên dưới là bản MẪU dùng khung tin ASCII đơn giản, phân tách bằng dấu phẩy,
để bạn chạy thử ngay. Thay bằng frame nhị phân/CRC thật của bạn khi cần.
"""

import struct
import robot_state as rs

# ---- ví dụ hằng số frame (đổi theo giao thức của bạn) ----
HEADER = 0xAA
FOOTER = 0x55


# ============================================================================
#  ROBOT -> MÁY TÍNH : tách gói tin
# ============================================================================
_rx_buffer = bytearray()


def parse_incoming(data: bytes):
    """Được transport gọi mỗi khi có byte mới. Gom buffer, tách từng frame
    hoàn chỉnh và cập nhật STATE.

    === PHIÊN BẢN MẪU (ASCII) ===
    Mỗi dòng kết thúc bằng '\\n', ví dụ:
      S,<j1..jn>,T,<t1..tn>,P,<x>,<y>,<z>,<rx>,<ry>,<rz>,SV,<on|off|fault>
    """
    global _rx_buffer
    _rx_buffer.extend(data)
    while b"\n" in _rx_buffer:
        line, _, rest = _rx_buffer.partition(b"\n")
        _rx_buffer = bytearray(rest)
        try:
            _parse_ascii_line(line.decode("ascii", "ignore").strip())
        except Exception as e:
            print("parse lỗi:", e)


def _parse_ascii_line(line: str):
    if not line:
        return
    tok = line.split(",")
    i = 0
    while i < len(tok):
        key = tok[i]
        if key == "S":          # joint positions cho tới token chữ tiếp theo
            vals, i = _read_floats(tok, i + 1)
            rs.update_joint_positions(vals)
        elif key == "V":
            vals, i = _read_floats(tok, i + 1)
            rs.update_joint_velocities(vals)
        elif key == "T":
            vals, i = _read_floats(tok, i + 1)
            rs.update_torque(vals)
        elif key == "C":
            vals, i = _read_floats(tok, i + 1)
            rs.update_current(vals)
        elif key == "P":        # x,y,z,rx,ry,rz
            vals, i = _read_floats(tok, i + 1)
            v = (vals + [None] * 6)[:6]
            rs.update_tcp(*v)
        elif key == "SV":
            rs.update_servo(servo=tok[i + 1] if i + 1 < len(tok) else "off")
            i += 2
        else:
            i += 1


def _read_floats(tok, i):
    out = []
    while i < len(tok):
        try:
            out.append(float(tok[i])); i += 1
        except ValueError:
            break
    return out, i


# ============================================================================
#  MÁY TÍNH -> ROBOT : dựng frame
# ============================================================================
def build_frame(c: rs.ControlParams) -> bytes:
    """Từ tham số điều khiển hiện tại, dựng frame gửi xuống robot.

    === PHIÊN BẢN MẪU (ASCII) ===
    CMD,<seq>,MODE,<mode>,EN,<0|1>,ES,<0|1>,SPD,<speed>,JOG,<j1..jn>[,HOME][,TRAJ,<action>,<progress>]\\n
    """
    parts = ["CMD", str(c.seq), "MODE", c.mode,
             "EN", "1" if c.enabled else "0",
             "ES", "1" if c.estop else "0",
             "SPD", f"{c.speed:.1f}",
             "JOG"] + [f"{v:.2f}" for v in c.jog_target]
    if c.button_home:
        parts.append("HOME")
    if c.traj_action:
        parts += ["TRAJ", c.traj_action, f"{c.traj_progress:.3f}"]
    line = ",".join(parts) + "\n"
    return line.encode("ascii")


# ---- Ví dụ frame NHỊ PHÂN (tham khảo, đang tắt) --------------------------
def build_frame_binary(c: rs.ControlParams) -> bytes:
    """Mẫu frame nhị phân có header/footer + CRC8. Bật khi cần tốc độ cao.
       [HEADER][seq u8][mode u8][flags u8][speed u8][j1..jn float32][CRC8][FOOTER]
    """
    mode_map = {"monitor": 0, "jog": 1, "traj": 2}
    flags = (1 if c.enabled else 0) | ((1 if c.estop else 0) << 1) | ((1 if c.button_home else 0) << 2)
    body = struct.pack("<BBBB", c.seq & 0xFF, mode_map.get(c.mode, 0), flags, int(c.speed) & 0xFF)
    body += b"".join(struct.pack("<f", v) for v in c.jog_target)
    crc = _crc8(body)
    return bytes([HEADER]) + body + bytes([crc, FOOTER])


def _crc8(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = ((crc << 1) ^ 0x07) & 0xFF if (crc & 0x80) else (crc << 1) & 0xFF
    return crc
