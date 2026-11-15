import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  BuiltinArm,
  BuiltRobot,
  applyBuiltinArmAngles,
  setJoint
} from '../lib/urdf-kit';

interface Viewport3DProps {
  builtinArm: BuiltinArm | null;
  customRobot: BuiltRobot | null;
  angles: number[];
  isLive: boolean;
  estop: boolean;
  onResetView?: () => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  builtinArm,
  customRobot,
  angles,
  isLive,
  estop
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showTcpAxis, setShowTcpAxis] = useState<boolean>(true);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const tcpAxesRef = useRef<THREE.AxesHelper | null>(null);

  // Camera parameters theo chuẩn công nghiệp
  const camCtrlRef = useRef({
    az: 0.75,
    pol: 1.08,
    rad: 13.5,
    tx: 0,
    ty: 2.2,
    tz: 0,
    home: { az: 0.75, pol: 1.08, rad: 13.5, tx: 0, ty: 2.2, tz: 0 }
  });

  const updateCamera = () => {
    const cam = cameraRef.current;
    if (!cam) return;
    const c = camCtrlRef.current;
    const pol = Math.max(0.06, Math.min(Math.PI - 0.06, c.pol));
    c.pol = pol;
    const sp = Math.sin(pol);
    const x = c.tx + c.rad * sp * Math.cos(c.az);
    const y = c.ty + c.rad * Math.cos(pol);
    const z = c.tz + c.rad * sp * Math.sin(c.az);
    cam.position.set(x, y, z);
    cam.lookAt(c.tx, c.ty, c.tz);
  };

  const handleResetCamera = () => {
    const c = camCtrlRef.current;
    Object.assign(c, c.home);
    updateCamera();
  };

  // Khởi tạo Scene Three.js
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 560;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCamera();

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;
    } catch (err) {
      console.warn('Không thể khởi tạo WebGLRenderer (có thể GPU bị vô hiệu hóa):', err);
      return;
    }

    // Ánh sáng chiếu sáng công nghiệp
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc2ccc6, 0.72));
    scene.add(new THREE.AmbientLight(0xffffff, 0.28));

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(6, 11, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x88ffbb, 0.16);
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);

    // Sàn bóng & Lưới tọa độ
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.16 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(28, 28, 0x28ab67, 0xcbd5e1);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Trục TCP AxesHelper
    const tcpAxes = new THREE.AxesHelper(0.5);
    tcpAxesRef.current = tcpAxes;
    scene.add(tcpAxes);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      if (renderer) renderer.dispose();
    };
  }, []);

  // Gắn mô hình Robot vào Scene (ưu tiên customRobot, nếu không có thì dùng builtinArm)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (customRobot) {
      scene.add(customRobot.root);
      if (customRobot.tip && tcpAxesRef.current) {
        customRobot.tip.add(tcpAxesRef.current);
      }

      // Tự động căn chỉnh góc nhìn camera theo kích thước thực của mô hình URDF vừa nạp
      customRobot.root.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(customRobot.root);
      if (box.isEmpty() || !isFinite(box.min.x)) {
        box = new THREE.Box3(
          new THREE.Vector3(-0.5, 0, -0.5),
          new THREE.Vector3(0.5, 1.2, 0.5)
        );
      }
      const c = box.getCenter(new THREE.Vector3());
      const sz = box.getSize(new THREE.Vector3());
      const rad = Math.max(sz.x, sz.y, sz.z, 0.2) * 0.5;

      const ct = camCtrlRef.current;
      ct.tx = c.x;
      ct.ty = c.y;
      ct.tz = c.z;
      ct.rad = Math.max(1.5, rad * 3.5);
      ct.home = { az: 0.66, pol: 0.95, rad: ct.rad, tx: c.x, ty: c.y, tz: c.z };
      updateCamera();
    } else if (builtinArm) {
      scene.add(builtinArm.group);
      if (builtinArm.flange && tcpAxesRef.current) {
        builtinArm.flange.add(tcpAxesRef.current);
      }
      // Camera cho hibot_arm_6dof
      const ct = camCtrlRef.current;
      ct.tx = 0;
      ct.ty = 2.2;
      ct.tz = 0;
      ct.rad = 13.5;
      ct.home = { az: 0.75, pol: 1.08, rad: 13.5, tx: 0, ty: 2.2, tz: 0 };
      updateCamera();
    }

    return () => {
      if (customRobot) scene.remove(customRobot.root);
      if (builtinArm) scene.remove(builtinArm.group);
    };
  }, [builtinArm, customRobot]);

  // Cập nhật góc quay các khớp
  useEffect(() => {
    if (customRobot) {
      for (let i = 0; i < customRobot.movable.length; i++) {
        if (angles[i] !== undefined) {
          setJoint(customRobot.movable[i], angles[i]);
        }
      }
      customRobot.root.updateMatrixWorld(true);
    } else if (builtinArm) {
      applyBuiltinArmAngles(builtinArm, angles);
      builtinArm.group.updateMatrixWorld(true);
    }
  }, [angles, builtinArm, customRobot]);

  // Bật/Tắt Grid & TCP
  useEffect(() => {
    if (gridHelperRef.current) gridHelperRef.current.visible = showGrid;
  }, [showGrid]);

  useEffect(() => {
    if (tcpAxesRef.current) tcpAxesRef.current.visible = showTcpAxis;
  }, [showTcpAxis]);

  // Tương tác chuột Orbit / Pan / Zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isPointerDown = false;
    let button = 0;
    let prevX = 0;
    let prevY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isPointerDown = true;
      button = e.button;
      prevX = e.clientX;
      prevY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;

      const c = camCtrlRef.current;
      const cam = cameraRef.current;
      const isPan = button === 1 || button === 2 || (button === 0 && (e.shiftKey || e.ctrlKey));

      if (isPan && cam) {
        // Pan
        const k = c.rad * 0.0016;
        const right = new THREE.Vector3(),
          up = new THREE.Vector3();
        cam.matrixWorld.extractBasis(right, up, new THREE.Vector3());
        c.tx += (-dx * right.x + dy * up.x) * k;
        c.ty += (-dx * right.y + dy * up.y) * k;
        c.tz += (-dx * right.z + dy * up.z) * k;
      } else {
        // Orbit
        c.az += dx * 0.007;
        c.pol -= dy * 0.007;
      }
      updateCamera();
    };

    const onPointerUp = (e: PointerEvent) => {
      isPointerDown = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = camCtrlRef.current;
      const factor = Math.exp((e.deltaY || 0) * 0.0012);
      c.rad = Math.max(0.5, Math.min(100, c.rad * factor));
      updateCamera();
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 rounded-xl overflow-hidden border border-slate-200/80 min-h-0 select-none shadow-xs transition-all ${
        estop ? 'ring-4 ring-rose-500/60' : ''
      }`}
      style={{
        background:
          'radial-gradient(125% 120% at 50% 0%, #ffffff 0%, #eef3f0 52%, #dfe7e2 100%)'
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Badges Top Left */}
      <div className="absolute top-3.5 left-3.5 flex items-center gap-2 bg-white/85 backdrop-blur-md rounded-full py-1 px-3 shadow-xs border border-slate-200/60 pointer-events-none">
        <span
          className={`w-2 h-2 rounded-full ${
            isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
          }`}
        />
        <span className="text-xs font-semibold text-slate-800">
          {isLive ? 'LIVE' : 'MÔ PHỎNG'}
        </span>
      </div>

      {/* Badges Top Right */}
      <div className="absolute top-3.5 right-3.5 text-[11px] font-medium text-slate-500 bg-white/75 backdrop-blur-md rounded-full py-1 px-3 border border-slate-200/60 pointer-events-none">
        25 Hz Telemetry
      </div>

      {/* Hint Bottom Left */}
      <div className="absolute bottom-11 left-3.5 text-[10.5px] text-slate-400 pointer-events-none">
        Cuộn: zoom · Kéo chuột trái: xoay · Chuột phải/Shift: di chuyển
      </div>

      {/* Model Name Bottom Left */}
      <div className="absolute bottom-3 left-3.5 font-mono text-[11px] text-slate-500 pointer-events-none">
        {customRobot
          ? `${customRobot.name}.urdf · ${customRobot.movable.length} joints`
          : 'hibot_arm_6dof.urdf · base_link → tool0 · 6 joint'}
      </div>

      {/* Action Buttons Bottom Right */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10">
        <button
          onClick={handleResetCamera}
          className="text-[11px] font-medium bg-white/90 hover:bg-white text-slate-700 rounded-lg px-2.5 py-1.5 shadow-xs border border-slate-200/80 transition cursor-pointer"
        >
          Đặt lại góc nhìn
        </button>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 shadow-xs border transition cursor-pointer ${
            showGrid
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white/90 text-slate-700 border-slate-200/80'
          }`}
        >
          Khung lưới
        </button>
        <button
          onClick={() => setShowTcpAxis(!showTcpAxis)}
          className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 shadow-xs border transition cursor-pointer ${
            showTcpAxis
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white/90 text-slate-700 border-slate-200/80'
          }`}
        >
          Trục TCP
        </button>
      </div>
    </div>
  );
};
