import React from 'react';
import { ControlMode, ConnectionStatus } from '../types/robot';
import { Folder, ChevronDown, RobotArm } from 'lucide-react';

interface HeaderProps {
  mode: ControlMode;
  onModeChange: (m: ControlMode) => void;
  modelName: string;
  dofCount: number;
  onOpenUrdfModal: () => void;
  connStatus: ConnectionStatus;
  onOpenConnModal: () => void;
  enabled: boolean;
  onToggleEnable: () => void;
  onHome: () => void;
  estop: boolean;
  onToggleEstop: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  modelName,
  dofCount,
  onOpenUrdfModal,
  connStatus,
  onOpenConnModal,
  enabled,
  onToggleEnable,
  onHome,
  estop,
  onToggleEstop
}) => {
  const isConnected = connStatus.state === 'connected';
  const connDot = isConnected
    ? 'bg-emerald-500 shadow-emerald-400'
    : connStatus.state === 'connecting'
    ? 'bg-amber-500 shadow-amber-400'
    : connStatus.state === 'error'
    ? 'bg-rose-500 shadow-rose-400'
    : 'bg-slate-400 shadow-slate-300';

  const connLabel = isConnected
    ? (connStatus.transport || 'Robot').toUpperCase()
    : connStatus.state === 'connecting'
    ? 'Đang nối...'
    : 'Chưa kết nối';

  return (
    <header className="h-16 flex-none flex items-center justify-between px-6 bg-white/80 backdrop-blur border-b border-slate-200/80 z-20 select-none">
      {/* Left: Brand + Nav tabs + Open URDF */}
      <div className="flex items-center gap-5">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm text-white">
            <RobotArm className="w-5 h-5 stroke-[1.75]" />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-[15px] tracking-tight">HiBot Control Desk</span>
              <RobotArm className="w-4 h-4 text-slate-600 stroke-[1.8]" />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Robot Digital Twin · Visual Live</span>
          </div>
        </div>

        <div className="w-[1px] h-6 bg-slate-200" />

        {/* Mode Tabs */}
        <div className="flex bg-slate-100 rounded-full p-1 border border-slate-200/50">
          {(
            [
              { id: 'monitor', label: 'Giám sát' },
              { id: 'jog', label: 'Jog' },
              { id: 'traj', label: 'Quỹ đạo' }
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => onModeChange(t.id)}
              className={`text-xs font-semibold px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                mode === t.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="w-[1px] h-6 bg-slate-200" />

        {/* Open URDF Project */}
        <button
          onClick={onOpenUrdfModal}
          className="flex items-center gap-2.5 border border-slate-200/90 bg-white hover:bg-slate-50 rounded-xl h-10 px-3.5 transition cursor-pointer shadow-xs"
        >
          <Folder className="w-4 h-4 text-emerald-600" />
          <div className="flex flex-col items-start leading-tight">
            <span className="text-xs font-semibold text-slate-800">{modelName}</span>
            <span className="text-[10px] text-slate-400 font-normal">
              {dofCount} bậc · Mở dự án
            </span>
          </div>
        </button>
      </div>

      {/* Right: Connect chip + Controls */}
      <div className="flex items-center gap-4">
        {/* Connection status chip */}
        <button
          onClick={onOpenConnModal}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 rounded-full py-1.5 px-3.5 transition cursor-pointer"
        >
          <span className={`w-2 h-2 rounded-full ${connDot} shadow-sm`} />
          <span className="text-xs font-semibold text-slate-800">{connLabel}</span>
          <span className="text-[11px] text-slate-500">{connStatus.message}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        </button>

        <div className="w-[1px] h-6 bg-slate-200" />

        {/* Safety & Action buttons */}
        <div className="flex items-center gap-2.5">
          {/* Servo Enable */}
          <button
            onClick={onToggleEnable}
            className={`text-xs font-semibold rounded-xl h-10 px-4 flex items-center gap-2 transition cursor-pointer border ${
              enabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-400'}`}
            />
            {enabled ? 'Servo BẬT' : 'Servo TẮT'}
          </button>

          {/* Home button */}
          <button
            onClick={onHome}
            className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl h-10 px-4 transition cursor-pointer shadow-xs active:scale-95"
          >
            Về Home
          </button>

          {/* Emergency Stop (E-Stop) */}
          <button
            onClick={onToggleEstop}
            className={`text-xs font-bold tracking-wide rounded-xl h-10 px-5 text-white transition cursor-pointer shadow-md ${
              estop
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/40 ring-4 ring-rose-400/50 animate-pulse'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
            }`}
          >
            {estop ? 'E-STOP ĐANG BẬT' : 'DỪNG KHẨN'}
          </button>
        </div>
      </div>
    </header>
  );
};
