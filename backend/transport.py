#!/usr/bin/env python3
"""
transport.py — KÊNH GIAO TIẾP  (UART hoặc TCP — CHỌN MỘT)
=========================================================

ConnectionManager đảm bảo tại một thời điểm CHỈ có MỘT kênh hoạt động: mở UART
sẽ tự đóng TCP và ngược lại. Mỗi kênh chạy 1 thread đọc, mọi byte nhận được
được đưa vào protocol.parse_incoming().

Phụ thuộc: pyserial (chỉ cần cho UART). Nếu chưa cài, kênh TCP vẫn dùng được.
"""

import socket
import threading
import time

try:
    import serial                       # pyserial
    import serial.tools.list_ports as list_ports
    HAVE_SERIAL = True
except Exception:
    HAVE_SERIAL = False


def available_ports():
    """Danh sách cổng COM/tty hiện có -> [{device, description}]."""
    if not HAVE_SERIAL:
        return []
    out = []
    for p in list_ports.comports():
        out.append({"device": p.device, "description": (p.description or "").strip()})
    return out


class _Base(threading.Thread):
    def __init__(self, on_rx, on_status):
        super().__init__(daemon=True)
        self._on_rx = on_rx            # callback(bytes)
        self._on_status = on_status    # callback(state:str, message:str)
        self._stop = threading.Event()
        self.kind = "base"

    def send(self, data: bytes):
        raise NotImplementedError

    def close(self):
        self._stop.set()


class UartTransport(_Base):
    def __init__(self, port, baud, on_rx, on_status):
        super().__init__(on_rx, on_status)
        self.kind = "uart"
        self.port = port
        self.baud = int(baud)
        self._ser = None

    def run(self):
        if not HAVE_SERIAL:
            self._on_status("error", "Chưa cài pyserial (pip install pyserial)")
            return
        try:
            self._ser = serial.Serial(self.port, self.baud, timeout=0.05)
        except Exception as e:
            self._on_status("error", f"Không mở được {self.port}: {e}")
            return
        self._on_status("connected", f"UART {self.port} @ {self.baud}")
        while not self._stop.is_set():
            try:
                n = self._ser.in_waiting
                data = self._ser.read(n or 1)
                if data:
                    self._on_rx(data)
            except Exception as e:
                self._on_status("error", f"Lỗi đọc UART: {e}")
                break
        try:
            if self._ser:
                self._ser.close()
        except Exception:
            pass
        self._on_status("disconnected", "Đã đóng UART")

    def send(self, data: bytes):
        if self._ser and self._ser.is_open:
            self._ser.write(data)


class TcpTransport(_Base):
    def __init__(self, ip, port, on_rx, on_status):
        super().__init__(on_rx, on_status)
        self.kind = "tcp"
        self.ip = ip
        self.port = int(port)
        self._sock = None

    def run(self):
        try:
            self._sock = socket.create_connection((self.ip, self.port), timeout=4)
            self._sock.settimeout(0.05)
        except Exception as e:
            self._on_status("error", f"Không kết nối được {self.ip}:{self.port}: {e}")
            return
        self._on_status("connected", f"TCP {self.ip}:{self.port}")
        while not self._stop.is_set():
            try:
                data = self._sock.recv(4096)
                if data == b"":
                    break                       # peer đóng
                self._on_rx(data)
            except socket.timeout:
                continue
            except Exception as e:
                self._on_status("error", f"Lỗi đọc TCP: {e}")
                break
        try:
            if self._sock:
                self._sock.close()
        except Exception:
            pass
        self._on_status("disconnected", "Đã đóng TCP")

    def send(self, data: bytes):
        if self._sock:
            try:
                self._sock.sendall(data)
            except Exception:
                pass


class ConnectionManager:
    """Giữ duy nhất một transport. connect() tự ngắt cái đang mở."""

    def __init__(self, on_rx, on_status):
        self._on_rx = on_rx
        self._on_status = on_status
        self.active = None                  # UartTransport | TcpTransport | None
        self.state = "disconnected"
        self.transport = None               # "uart" | "tcp" | None
        self.message = "Chưa kết nối"

    def _status(self, state, message):
        self.state = state
        self.message = message
        self._on_status(self.transport, state, message)

    def connect_uart(self, port, baud):
        self.disconnect()
        self.transport = "uart"
        self._status("connecting", f"Đang mở {port}…")
        self.active = UartTransport(port, baud, self._on_rx, self._status)
        self.active.start()

    def connect_tcp(self, ip, port):
        self.disconnect()
        self.transport = "tcp"
        self._status("connecting", f"Đang kết nối {ip}:{port}…")
        self.active = TcpTransport(ip, port, self._on_rx, self._status)
        self.active.start()

    def disconnect(self):
        if self.active:
            self.active.close()
            self.active.join(timeout=1.0)
            self.active = None
        self.state = "disconnected"
        self.message = "Chưa kết nối"

    def send(self, data: bytes):
        if self.active and self.state == "connected":
            self.active.send(data)

    def is_connected(self):
        return self.state == "connected"
