import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { JogPanel } from './components/JogPanel';
import { Viewport3D } from './components/Viewport3D';
import { TcpDisplay } from './components/TcpDisplay';
import { TrajectoryPanel } from './components/TrajectoryPanel';
import { SystemPanel } from './components/SystemPanel';
import { ConnectModal } from './components/ConnectModal';
import { UrdfModal } from './components/UrdfModal';
import { robotWs } from './services/robotWs';
import {
  AlarmItem,
  ConnectionStatus,
  ControlMode,
  JointMeta,
  LogItem,
  PortInfo,
  TcpPosition
} from './types/robot';
import {
  BuiltinArm,
  buildBuiltinArm,
  buildRobot,
  BuiltRobot,
  fsFromFileList,
  parseURDF
} from './lib/urdf-kit';

const DEFAULT_JOINTS_6DOF: JointMeta[] = [
  { name: 'J1', min: -170, max: 170, maxTq: 90, home: 20 },
  { name: 'J2', min: -120, max: 120, maxTq: 90, home: -35 },
  { name: 'J3', min: -150, max: 150, maxTq: 70, home: 55 },
  { name: 'J4', min: -180, max: 180, maxTq: 35, home: 0 },
  { name: 'J5', min: -120, max: 120, maxTq: 35, home: 50 },
  { name: 'J6', min: -360, max: 360, maxTq: 20, home: 0 }
];

export function App() {
  const [mode, setMode] = useState<ControlMode>('monitor');
  const [modelName, setModelName] = useState<string>('hibot_arm_6dof');
  const [joints, setJoints] = useState<JointMeta[]>(DEFAULT_JOINTS_6DOF);
  const [angles, setAngles] = useState<number[]>(DEFAULT_JOINTS_6DOF.map((j) => j.home));
  const [torques, setTorques] = useState<number[]>(DEFAULT_JOINTS_6DOF.map(() => 0));
  const [currents, setCurrents] = useState<number[]>(DEFAULT_JOINTS_6DOF.map(() => 0));
  const [tcp, setTcp] = useState<TcpPosition>({ x: 0, y: 0, z: 820, rx: 20, ry: 0, rz: 0 });

  const [enabled, setEnabled] = useState<boolean>(true);
  const [estop, setEstop] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(45);

  const [trajPlaying, setTrajPlaying] = useState<boolean>(false);
  const [trajProgress, setTrajProgress] = useState<number>(0);

  const [connStatus, setConnStatus] = useState<ConnectionStatus>({
    state: 'disconnected',
    transport: null,
    message: 'Chưa kết nối'
  });
  const [ports, setPorts] = useState<PortInfo[]>([]);

  const [alarms, setAlarms] = useState<AlarmItem[]>([
    {
      id: '1',
      title: 'Hệ thống sẵn sàng',
      sub: 'Mô hình robot HiBot Arm 6-DOF hoạt động bình thường',
      time: '10:25:02',
      color: '#10b981',
      level: 'info'
    }
  ]);

  const [logs, setLogs] = useState<LogItem[]>([
    { t: '10:25:02', m: 'Nạp cánh tay công nghiệp 6-DOF hibot_arm_6dof', c: '#10b981' }
  ]);

  const [isConnModalOpen, setIsConnModalOpen] = useState<boolean>(false);
  const [isUrdfModalOpen, setIsUrdfModalOpen] = useState<boolean>(false);

  // Khởi tạo ngay cánh tay robot công nghiệp 6-DOF chính thống làm mặc định
  const [builtinArm] = useState<BuiltinArm | null>(() => buildBuiltinArm());
  const [customRobot, setCustomRobot] = useState<BuiltRobot | null>(null);

  const addLog = (m: string, c: string = '#64748b') => {
    const d = new Date();
    const t = [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((v) => String(v).padStart(2, '0'))
      .join(':');
    setLogs((prev) => [{ t, m, c }, ...prev.slice(0, 49)]);
  };

  const handleRestoreDefaultArm = () => {
    setCustomRobot(null);
    setModelName('hibot_arm_6dof');
    setJoints(DEFAULT_JOINTS_6DOF);
    setAngles(DEFAULT_JOINTS_6DOF.map((j) => j.home));
    addLog('Đã khôi phục mô hình cánh tay robot công nghiệp 6-DOF mặc định', '#10b981');
  };

  const handleLoadRobotPath = async (targetPath: string) => {
    try {
      addLog(`Đang tìm và nạp mô hình từ: ${targetPath}...`, '#3b82f6');
      const res = await fetch('/api/robots/locate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Không thể đọc file URDF' }));
        throw new Error(err.detail || 'Không tìm thấy file URDF');
      }
      const data = await res.json();
      const parsed = parseURDF(data.urdfText);
      const built = await buildRobot(parsed, undefined, data.urdfPath);
      setCustomRobot(built);
      setModelName(built.name);

      const jMeta: JointMeta[] = parsed.joints
        .filter((j) => j.type !== 'fixed')
        .map((j) => ({
          name: j.name,
          min: j.limit ? Math.round((j.limit.lower * 180) / Math.PI) : -180,
          max: j.limit ? Math.round((j.limit.upper * 180) / Math.PI) : 180,
          maxTq: j.limit ? j.limit.effort : 50,
          home: 0,
          prism: j.type === 'prismatic'
        }));
      setJoints(jMeta);
      setAngles(jMeta.map(() => 0));
      addLog(
        `Nạp thành công ${built.name}: ${built.loadedMesh}/${built.meshTotal} mesh STL 3D (${jMeta.length} DOF)`,
        built.loadedMesh > 0 ? '#10b981' : '#f59e0b'
      );
    } catch (e: any) {
      console.error(e);
      addLog('Lỗi nạp URDF: ' + e.message, '#ef4444');
      throw e;
    }
  };

  const handleLoadFiles = async (files: FileList | File[]) => {
    try {
      const fs = fsFromFileList(files);
      const list = await fs.list();
      const urdfFile = list.find((p) => p.toLowerCase().endsWith('.urdf'));
      if (!urdfFile) {
        alert('Không tìm thấy file .urdf trong các file/thư mục đã chọn!');
        return;
      }
      const urdfText = await fs.getText(urdfFile);
      const parsed = parseURDF(urdfText);
      const built = await buildRobot(parsed, fs, urdfFile);
      setCustomRobot(built);
      setModelName(built.name);

      const jMeta: JointMeta[] = parsed.joints
        .filter((j) => j.type !== 'fixed')
        .map((j) => ({
          name: j.name,
          min: j.limit ? Math.round((j.limit.lower * 180) / Math.PI) : -180,
          max: j.limit ? Math.round((j.limit.upper * 180) / Math.PI) : 180,
          maxTq: j.limit ? j.limit.effort : 50,
          home: 0,
          prism: j.type === 'prismatic'
        }));
      setJoints(jMeta);
      setAngles(jMeta.map(() => 0));
      addLog(
        `Nạp thành công ${built.name}: ${built.loadedMesh}/${built.meshTotal} mesh STL 3D`,
        built.loadedMesh > 0 ? '#10b981' : '#f59e0b'
      );
    } catch (e: any) {
      console.error(e);
      alert('Lỗi nạp URDF: ' + e.message);
      addLog('Lỗi nạp URDF: ' + e.message, '#ef4444');
    }
  };

  // WebSocket Subscription
  useEffect(() => {
    robotWs.init();

    const unsubTelem = robotWs.onTelemetry((data) => {
      if (Array.isArray(data.angles)) setAngles(data.angles);
      if (Array.isArray(data.torques)) setTorques(data.torques);
      if (Array.isArray(data.current)) setCurrents(data.current);
      if (data.tcp) setTcp(data.tcp);
      if (data.servo) {
        setEstop(data.servo === 'fault');
        setEnabled(data.servo !== 'off');
      }
      if (data.traj) {
        if (typeof data.traj.progress === 'number') setTrajProgress(data.traj.progress);
        if (typeof data.traj.playing === 'boolean') setTrajPlaying(data.traj.playing);
      }
    });

    const unsubPorts = robotWs.onPorts((pList) => {
      setPorts(pList);
    });

    const unsubStatus = robotWs.onStatus((st) => {
      setConnStatus(st);
      const isOk = st.state === 'connected';
      addLog(
        `Kênh ${(st.transport || 'hệ thống').toUpperCase()}: ${st.message}`,
        isOk ? '#10b981' : st.state === 'error' ? '#ef4444' : '#64748b'
      );
      if (st.state === 'error') {
        setAlarms((prev) => [
          {
            id: String(Date.now()),
            title: 'Lỗi kết nối',
            sub: st.message,
            time: new Date().toLocaleTimeString(),
            color: '#ef4444',
            level: 'error'
          },
          ...prev
        ]);
      }
    });

    return () => {
      unsubTelem();
      unsubPorts();
      unsubStatus();
    };
  }, []);

  // UI Handlers
  const handleModeChange = (newMode: ControlMode) => {
    setMode(newMode);
    robotWs.setMode(newMode);
    addLog(`Chuyển sang chế độ: ${newMode.toUpperCase()}`, '#3b82f6');
  };

  const handleJogJoint = (index: number, angle: number) => {
    const updated = [...angles];
    updated[index] = angle;
    setAngles(updated);
    robotWs.jog(index, angle);
  };

  const handleSpeedChange = (val: number) => {
    setSpeed(val);
    robotWs.setSpeed(val);
  };

  const handleToggleEnable = () => {
    const next = !enabled;
    setEnabled(next);
    robotWs.setEnable(next);
    addLog(next ? 'Đã bật Servo (Enable)' : 'Đã tắt Servo (Disable)', next ? '#10b981' : '#f59e0b');
  };

  const handleHome = () => {
    robotWs.home();
    addLog('Lệnh đưa robot về vị trí Home', '#3b82f6');
  };

  const handleToggleEstop = () => {
    const next = !estop;
    setEstop(next);
    robotWs.setEstop(next);
    addLog(
      next ? 'KÍCH HOẠT DỪNG KHẨN (E-STOP)!' : 'Đã giải tỏa dừng khẩn cấp',
      next ? '#ef4444' : '#10b981'
    );
  };

  const handleTrajPlayToggle = () => {
    const next = !trajPlaying;
    setTrajPlaying(next);
    robotWs.traj(next ? 'play' : 'pause');
  };

  const handleTrajReset = () => {
    setTrajPlaying(false);
    setTrajProgress(0);
    robotWs.traj('reset');
  };

  const handleTrajScrub = (val: number) => {
    setTrajProgress(val);
    robotWs.traj('seek', val);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-900 font-sans">
      {/* Header */}
      <Header
        mode={mode}
        onModeChange={handleModeChange}
        modelName={modelName}
        dofCount={joints.length}
        onOpenUrdfModal={() => setIsUrdfModalOpen(true)}
        connStatus={connStatus}
        onOpenConnModal={() => setIsConnModalOpen(true)}
        enabled={enabled}
        onToggleEnable={handleToggleEnable}
        onHome={handleHome}
        estop={estop}
        onToggleEstop={handleToggleEstop}
      />

      {/* 3-Column Layout */}
      <main className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        {/* Left Column: Jog */}
        <JogPanel
          joints={joints}
          angles={angles}
          torques={torques}
          currents={currents}
          speed={speed}
          onJogJoint={handleJogJoint}
          onSpeedChange={handleSpeedChange}
        />

        {/* Center Column: TCP + 3D Viewport + Trajectory */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <TcpDisplay tcp={tcp} />
          <Viewport3D
            builtinArm={builtinArm}
            customRobot={customRobot}
            angles={angles}
            isLive={connStatus.state === 'connected'}
            estop={estop}
          />
          <TrajectoryPanel
            playing={trajPlaying}
            progress={trajProgress}
            onPlayToggle={handleTrajPlayToggle}
            onReset={handleTrajReset}
            onScrub={handleTrajScrub}
          />
        </div>

        {/* Right Column: System info, Alarms & Logs */}
        <SystemPanel
          connStatus={connStatus}
          modelName={modelName}
          servo={estop ? 'fault' : enabled ? 'on' : 'off'}
          alarms={alarms}
          logs={logs}
        />
      </main>

      {/* Hardware Connection Modal */}
      <ConnectModal
        isOpen={isConnModalOpen}
        onClose={() => setIsConnModalOpen(false)}
        connStatus={connStatus}
        ports={ports}
        onRefreshPorts={() => robotWs.refreshPorts()}
        onConnect={(params) => {
          robotWs.connectHardware(params);
          setIsConnModalOpen(false);
        }}
        onDisconnect={() => {
          robotWs.disconnectHardware();
          setIsConnModalOpen(false);
        }}
      />

      {/* URDF Loader Modal */}
      <UrdfModal
        isOpen={isUrdfModalOpen}
        onClose={() => setIsUrdfModalOpen(false)}
        modelName={modelName}
        joints={joints}
        onLoadFiles={handleLoadFiles}
        onLoadPath={handleLoadRobotPath}
        onRestoreDefault={handleRestoreDefaultArm}
      />
    </div>
  );
}

export default App;
