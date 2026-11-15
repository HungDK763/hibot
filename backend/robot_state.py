#!/usr/bin/env python3
"""
robot_state.py — STRUCT TOÀN CỤC + HÀM CẬP NHẬT
================================================

Đây là "nguồn sự thật" duy nhất về trạng thái robot và các tham số điều khiển.
Bạn PARSE gói tin nhận về (trong protocol.parse_incoming) rồi gọi các hàm
update_* ở file này để nạp giá trị. Còn khi cần gửi lệnh xuống robot, bạn đọc
CONTROL (ControlParams) rồi tự build frame (trong protocol.build_frame).

Tất cả đều thread-safe (có Lock) vì transport chạy ở thread riêng, còn
WebSocket/asyncio ở thread chính.
"""

from dataclasses import dataclass, field
from threading import Lock
from typing import List
import time

DOF_DEFAULT = 6


# ============================================================================
#  STRUCT 1 — TRẠNG THÁI ROBOT (robot -> máy tính)
# ============================================================================
@dataclass
class RobotState:
    dof: int = DOF_DEFAULT
    # theo từng khớp
    joint_pos: List[float] = field(default_factory=lambda: [0.0] * DOF_DEFAULT)  # góc (độ) hoặc mm nếu prismatic
    joint_vel: List[float] = field(default_factory=lambda: [0.0] * DOF_DEFAULT)  # độ/s hoặc mm/s
    torque:    List[float] = field(default_factory=lambda: [0.0] * DOF_DEFAULT)  # mô-men xoắn (Nm)
    current:   List[float] = field(default_factory=lambda: [0.0] * DOF_DEFAULT)  # dòng điện (A)
    # đầu công cụ (TCP) trong hệ toạ độ gốc
    x: float = 0.0; y: float = 0.0; z: float = 0.0        # mm
    rx: float = 0.0; ry: float = 0.0; rz: float = 0.0     # độ
    # trạng thái hệ thống
    servo: str = "off"          # "on" | "off" | "fault"
    estop: bool = False
    fault_code: int = 0
    stamp: float = field(default_factory=time.time)

    def to_ui(self) -> dict:
        """Đóng gói đúng định dạng mà giao diện (control_desk.html) mong đợi."""
        return {
            "type": "state",
            "angles":  [round(v, 3) for v in self.joint_pos],
            "torques": [round(v, 3) for v in self.torque],
            "vel":     [round(v, 3) for v in self.joint_vel],
            "current": [round(v, 3) for v in self.current],
            "tcp": {"x": round(self.x, 2), "y": round(self.y, 2), "z": round(self.z, 2),
                    "rx": round(self.rx, 2), "ry": round(self.ry, 2), "rz": round(self.rz, 2)},
            "servo": "fault" if self.estop else self.servo,
            "fault_code": self.fault_code,
        }


# ============================================================================
#  STRUCT 2 — THAM SỐ ĐIỀU KHIỂN (máy tính -> robot)
# ============================================================================
@dataclass
class ControlParams:
    mode: str = "monitor"                                   # "monitor" | "jog" | "traj"
    enabled: bool = True                                    # servo enable
    estop: bool = False                                     # dừng khẩn
    speed: float = 45.0                                     # 0..100 (%)
    jog_target: List[float] = field(default_factory=lambda: [0.0] * DOF_DEFAULT)  # setpoint khớp
    # quỹ đạo
    traj_action: str = ""                                   # "play"|"pause"|"reset"|"seek"
    traj_progress: float = 0.0                              # 0..1
    # nút/cờ tức thời — bạn tự map xuống frame
    button_home: bool = False
    seq: int = 0                                            # số thứ tự lệnh (tăng dần)


# ============================================================================
#  BIẾN TOÀN CỤC + KHÓA
# ============================================================================
STATE = RobotState()
CONTROL = ControlParams()
_lock = Lock()


def set_dof(n: int):
    """Đổi số bậc tự do (khi nạp URDF khác). Cấp phát lại các mảng."""
    with _lock:
        STATE.dof = n
        for name in ("joint_pos", "joint_vel", "torque", "current"):
            setattr(STATE, name, [0.0] * n)
        CONTROL.jog_target = [0.0] * n


# --------- HÀM CẬP NHẬT TRẠNG THÁI (gọi từ protocol.parse_incoming) ---------
def update_joint_positions(values: List[float]):
    with _lock:
        for i in range(min(len(values), STATE.dof)):
            STATE.joint_pos[i] = float(values[i])
        STATE.stamp = time.time()


def update_joint_velocities(values: List[float]):
    with _lock:
        for i in range(min(len(values), STATE.dof)):
            STATE.joint_vel[i] = float(values[i])


def update_torque(values: List[float]):
    with _lock:
        for i in range(min(len(values), STATE.dof)):
            STATE.torque[i] = float(values[i])


def update_current(values: List[float]):
    with _lock:
        for i in range(min(len(values), STATE.dof)):
            STATE.current[i] = float(values[i])


def update_tcp(x=None, y=None, z=None, rx=None, ry=None, rz=None):
    """Cập nhật vị trí đầu công cụ. Truyền cái nào thì cập nhật cái đó."""
    with _lock:
        if x is not None: STATE.x = float(x)
        if y is not None: STATE.y = float(y)
        if z is not None: STATE.z = float(z)
        if rx is not None: STATE.rx = float(rx)
        if ry is not None: STATE.ry = float(ry)
        if rz is not None: STATE.rz = float(rz)


def update_servo(servo: str = None, estop: bool = None, fault_code: int = None):
    with _lock:
        if servo is not None: STATE.servo = servo
        if estop is not None: STATE.estop = estop
        if fault_code is not None: STATE.fault_code = fault_code


def snapshot_state() -> dict:
    with _lock:
        return STATE.to_ui()


# --------- CẬP NHẬT THAM SỐ ĐIỀU KHIỂN (gọi từ server khi UI ra lệnh) -------
def apply_ui_command(msg: dict):
    """Nhận lệnh JSON từ giao diện, ghi vào CONTROL. Trả về True nếu là lệnh
    điều khiển (cần build frame gửi xuống robot)."""
    t = msg.get("type")
    with _lock:
        CONTROL.seq += 1
        if t == "jog":
            j = int(msg["joint"])
            if 0 <= j < STATE.dof:
                CONTROL.jog_target[j] = float(msg["angle"])
            CONTROL.mode = "jog"
        elif t == "jog_all":
            for i, v in enumerate(msg.get("angles", [])[:STATE.dof]):
                CONTROL.jog_target[i] = float(v)
            CONTROL.mode = "jog"
        elif t == "home":
            CONTROL.button_home = True
            CONTROL.mode = "jog"
        elif t == "enable":
            CONTROL.enabled = bool(msg["value"])
        elif t == "estop":
            CONTROL.estop = bool(msg["value"])
        elif t == "speed":
            CONTROL.speed = float(msg["value"])
        elif t == "set_mode":
            CONTROL.mode = msg["mode"]
        elif t == "traj":
            CONTROL.traj_action = msg.get("action", "")
            if "value" in msg:
                CONTROL.traj_progress = float(msg["value"])
        else:
            return False
    return True


def snapshot_control() -> ControlParams:
    with _lock:
        # trả bản sao nông để build_frame đọc an toàn
        import copy
        return copy.copy(CONTROL)
