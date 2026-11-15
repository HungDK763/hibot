#!/usr/bin/env python3
"""
server.py — CẦU NỐI GIỮA GIAO DIỆN VÀ ROBOT
===========================================

Chạy:
    pip install -r requirements.txt
    python server.py
    # mở http://localhost:8765

Vai trò:
  * Phục vụ giao diện ui/control_desk.html
  * WebSocket /ws:
      - UI -> server: liệt kê cổng, connect (uart|tcp), disconnect, và các lệnh
        điều khiển (jog/home/enable/estop/speed/mode/traj).
      - server -> UI: danh sách cổng, trạng thái kết nối, telemetry (~25 Hz).
  * Khi có kênh (UART/TCP) mở: byte nhận về -> protocol.parse_incoming ->
    cập nhật STATE; lệnh từ UI -> protocol.build_frame -> gửi xuống robot.
  * Khi CHƯA kết nối phần cứng: server chạy bộ MÔ PHỎNG để UI vẫn có dữ liệu
    (chế độ demo). Kết nối thật xong thì mô phỏng tự tắt.

Bạn hầu như không cần sửa file này — logic robot nằm ở protocol.py + robot_state.py.
"""

import asyncio
import json
import math
import pathlib
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

import robot_state as rs
import protocol
from transport import ConnectionManager, available_ports

HERE = pathlib.Path(__file__).parent
UI_FILE = HERE / "ui" / "control_desk.html"
DIST_DIR = HERE / "ui" / "dist"

app = FastAPI(title="HiBot Control Desk")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Phục vụ static assets khi đã build frontend mới
if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

# hàng đợi sự kiện kết nối để đẩy về mọi client UI
_status_events = []


def _on_rx(data: bytes):
    protocol.parse_incoming(data)          # -> cập nhật STATE


def _on_status(transport, state, message):
    _status_events.append({"type": "conn_status", "transport": transport,
                           "state": state, "message": message})


conn = ConnectionManager(_on_rx, _on_status)


# ---------------- Bộ mô phỏng (chỉ chạy khi CHƯA kết nối) ------------------
class Sim:
    def __init__(self):
        self.t0 = time.time()

    def step(self):
        if conn.is_connected():
            return                              # có phần cứng thật -> không mô phỏng
        c = rs.snapshot_control()
        t = time.time() - self.t0
        n = rs.STATE.dof
        if c.estop or not c.enabled:
            rs.update_servo(servo="fault" if c.estop else "off")
        else:
            rs.update_servo(servo="on")
            if c.mode == "monitor":
                home = [20.0, -35.0, 55.0, 0.0, 50.0, 0.0]
                amp = [25.0, 15.0, 18.0, 35.0, 20.0, 45.0]
                rs.update_joint_positions([home[i % 6] + amp[i % 6] * math.sin(0.18 * t + i) for i in range(n)])
            elif c.mode == "jog":
                cur = rs.STATE.joint_pos
                rs.update_joint_positions([cur[i] + (c.jog_target[i] - cur[i]) * 0.2 for i in range(n)])
        rs.update_torque([12 * math.sin(t + i) + 15 for i in range(n)])
        # TCP xấp xỉ
        rs.update_tcp(x=200 * math.sin(0.1 * t), y=120 * math.cos(0.1 * t), z=820,
                      rx=rs.STATE.joint_pos[0] if n else 0, ry=0, rz=0)


sim = Sim()


import os
import glob
import re
import urllib.parse
import xml.etree.ElementTree as ET
from fastapi import HTTPException
from fastapi.responses import PlainTextResponse

@app.get("/")
@app.head("/")
async def index():
    if (DIST_DIR / "index.html").exists():
        return FileResponse(DIST_DIR / "index.html")
    return FileResponse(UI_FILE)


def resolve_mesh_file(mesh_uri: str, urdf_path: str = None, urdf_dir: str = None) -> str:
    """Tìm file STL trên ổ đĩa dựa trên URI trong URDF và thư mục dự án."""
    if not mesh_uri:
        return None
    mesh_uri = urllib.parse.unquote(mesh_uri).strip()
    rel = mesh_uri
    for prefix in ["package://", "model://", "file://"]:
        if rel.startswith(prefix):
            rel = rel[len(prefix):]
            parts = rel.split("/", 1)
            if len(parts) > 1:
                rel = parts[1]
            break
    rel = rel.lstrip("/").lstrip("./")

    search_dirs = []
    if urdf_path and os.path.isfile(urdf_path):
        u_dir = os.path.dirname(urdf_path)
        search_dirs.append(u_dir)
        search_dirs.append(os.path.dirname(u_dir))
    if urdf_dir and os.path.isdir(urdf_dir):
        search_dirs.append(urdf_dir)
        search_dirs.append(os.path.dirname(urdf_dir))

    # Thêm các thư mục CAD phổ biến trên máy
    home_dir = os.path.expanduser("~")
    for extra in ["Documents/CAD", "Documents/Code/VD_project/controls/src/vd_robot_description", "Documents/Code"]:
        p = os.path.join(home_dir, extra)
        if os.path.isdir(p) and p not in search_dirs:
            search_dirs.append(p)

    # 1. Thử các đường dẫn trực tiếp
    for s in search_dirs:
        candidates = [
            os.path.normpath(os.path.join(s, rel)),
            os.path.normpath(os.path.join(s, "meshes", os.path.basename(rel))),
            os.path.normpath(os.path.join(s, "..", "meshes", os.path.basename(rel)))
        ]
        for c in candidates:
            if os.path.isfile(c):
                return c

    # 2. Tìm kiếm theo tên file (không phân biệt hoa thường và khoảng trắng)
    target_base = os.path.basename(rel).strip().lower()
    for s in search_dirs:
        for root, _, files in os.walk(s):
            for f in files:
                if f.strip().lower() == target_base:
                    return os.path.join(root, f)

    return None


@app.get("/api/robots")
async def list_available_robots():
    """Tự động quét các dự án robot CAD / ROS có sẵn trong máy tính."""
    home_dir = os.path.expanduser("~")
    scan_roots = [
        os.path.join(home_dir, "Documents", "CAD"),
        os.path.join(home_dir, "Documents", "Code", "VD_project", "controls", "src", "vd_robot_description"),
        str(HERE.parent)
    ]
    robots = []
    seen = set()
    for s_dir in scan_roots:
        if not os.path.isdir(s_dir):
            continue
        for urdf_path in glob.glob(os.path.join(s_dir, "**", "*.urdf"), recursive=True):
            if "training" in urdf_path.lower():
                continue
            norm = os.path.normpath(urdf_path)
            if norm in seen:
                continue
            seen.add(norm)
            try:
                tree = ET.parse(norm)
                root = tree.getroot()
                name = root.attrib.get("name") or os.path.basename(norm).replace(".urdf", "")
                joints = [j for j in root.findall(".//joint") if j.attrib.get("type") != "fixed"]
                meshes = root.findall(".//visual//mesh")
                folder = os.path.dirname(norm)
                if os.path.basename(folder) == "urdf":
                    folder = os.path.dirname(folder)
                robots.append({
                    "id": re.sub(r"[^a-zA-Z0-9_]", "_", name.lower()),
                    "name": name,
                    "path": norm,
                    "folder": folder,
                    "jointCount": len(joints),
                    "meshCount": len(meshes)
                })
            except Exception:
                pass
    return {"robots": robots}


@app.get("/api/robots/urdf")
async def get_robot_urdf(path: str):
    """Đọc nội dung XML của file URDF từ ổ đĩa."""
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Không tìm thấy file URDF")
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return PlainTextResponse(content, media_type="application/xml")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/robots/mesh")
async def get_robot_mesh(path: str, urdf_path: str = None, urdf_dir: str = None):
    """Phục vụ file STL nhị phân/ASCII cho Three.js."""
    resolved = resolve_mesh_file(path, urdf_path=urdf_path, urdf_dir=urdf_dir)
    if not resolved or not os.path.isfile(resolved):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy mesh: {path}")
    return FileResponse(resolved, media_type="application/octet-stream")


@app.post("/api/robots/locate")
async def locate_robot(data: dict):
    """Nhận diện đường dẫn file hoặc thư mục người dùng nhập vào."""
    raw_path = data.get("path", "").strip()
    if not raw_path:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp đường dẫn")
    p = os.path.expanduser(raw_path)
    if not os.path.exists(p):
        raise HTTPException(status_code=404, detail="Đường dẫn không tồn tại trên máy")

    urdf_file = None
    if os.path.isfile(p) and p.lower().endswith(".urdf"):
        urdf_file = p
    elif os.path.isdir(p):
        for root, _, files in os.walk(p):
            for f in files:
                if f.lower().endswith(".urdf"):
                    urdf_file = os.path.join(root, f)
                    break
            if urdf_file:
                break

    if not urdf_file:
        raise HTTPException(status_code=404, detail="Không tìm thấy file .urdf trong thư mục")

    try:
        with open(urdf_file, "r", encoding="utf-8") as f:
            content = f.read()
        tree = ET.fromstring(content)
        name = tree.attrib.get("name") or os.path.basename(urdf_file).replace(".urdf", "")
        return {"name": name, "urdfPath": urdf_file, "urdfText": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc URDF: {str(e)}")



@app.websocket("/ws")
async def ws(sock: WebSocket):
    await sock.accept()
    print("UI đã kết nối")
    # gửi ngay danh sách cổng + trạng thái hiện tại
    await sock.send_text(json.dumps({"type": "ports", "ports": available_ports()}))
    await sock.send_text(json.dumps({"type": "conn_status", "transport": conn.transport,
                                     "state": conn.state, "message": conn.message}))

    async def receiver():
        try:
            while True:
                msg = json.loads(await sock.receive_text())
                await handle_ui_message(msg)
        except WebSocketDisconnect:
            pass

    rx = asyncio.create_task(receiver())
    try:
        while True:
            sim.step()
            # đẩy các sự kiện kết nối (nếu có)
            while _status_events:
                await sock.send_text(json.dumps(_status_events.pop(0)))
            # đẩy telemetry
            await sock.send_text(json.dumps(rs.snapshot_state()))
            await asyncio.sleep(0.04)              # ~25 Hz
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        rx.cancel()
        print("UI đã ngắt kết nối")


async def handle_ui_message(msg: dict):
    t = msg.get("type")
    if t == "list_ports":
        _status_events.append({"type": "ports", "ports": available_ports()})
    elif t == "connect":
        if msg.get("transport") == "uart":
            conn.connect_uart(msg.get("port"), msg.get("baud", 115200))
        elif msg.get("transport") == "tcp":
            conn.connect_tcp(msg.get("ip"), msg.get("port", 5000))
    elif t == "disconnect":
        conn.disconnect()
        _on_status(conn.transport, "disconnected", "Đã ngắt kết nối")
    else:
        # lệnh điều khiển -> ghi vào CONTROL, rồi build frame gửi xuống robot
        if rs.apply_ui_command(msg):
            if conn.is_connected():
                frame = protocol.build_frame(rs.snapshot_control())
                conn.send(frame)


if __name__ == "__main__":
    import socket
    port = 8765
    print(f"HiBot Control Desk → http://localhost:{port} or http://127.0.0.1:{port}")
    sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
    sock.bind(("::", port))
    sock.listen(2048)

    config = uvicorn.Config(app, log_level="info")
    server = uvicorn.Server(config)
    server.run(sockets=[sock])
