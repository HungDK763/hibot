import React from 'react';
import { AlarmItem, ConnectionStatus, LogItem } from '../types/robot';

interface SystemPanelProps {
  connStatus: ConnectionStatus;
  modelName: string;
  servo: 'on' | 'off' | 'fault';
  alarms: AlarmItem[];
  logs: LogItem[];
}

export const SystemPanel: React.FC<SystemPanelProps> = ({
  connStatus,
  modelName,
  servo,
  alarms,
  logs
}) => {
  const servoColor =
    servo === 'on' ? 'text-emerald-600' : servo === 'fault' ? 'text-rose-600' : 'text-slate-400';
  const servoDot =
    servo === 'on' ? 'bg-emerald-500' : servo === 'fault' ? 'bg-rose-500' : 'bg-slate-300';
  const servoText = servo === 'on' ? 'BẬT' : servo === 'fault' ? 'LỖI' : 'TẮT';

  return (
    <div className="w-[400px] flex-none flex flex-col gap-3 h-full select-none">
      {/* Box 1: System Info */}
      <div className="flex-none bg-white rounded-xl shadow-sm border border-slate-200/80 p-4">
        <div className="font-semibold text-slate-800 text-sm mb-3">Kết nối &amp; hệ thống</div>
        <div className="flex flex-col gap-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Bộ điều khiển</span>
            <span className="font-medium text-slate-700">VD‑CTRL‑6</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Kênh kết nối</span>
            <span className="font-medium text-slate-700 uppercase">
              {connStatus.transport || 'Chưa mở'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Mô hình URDF</span>
            <span className="font-medium text-slate-700">{modelName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Trạng thái Servo</span>
            <span className={`inline-flex items-center gap-1.5 font-semibold ${servoColor}`}>
              <span className={`w-2 h-2 rounded-full ${servoDot}`} />
              {servoText}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Nền tảng</span>
            <span className="font-medium text-slate-700">Windows · Ubuntu</span>
          </div>
        </div>
      </div>

      {/* Box 2: Alarms & Diagnostics */}
      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-800 text-sm">Chẩn đoán &amp; cảnh báo</span>
          <span className="text-[10px] font-semibold text-white bg-emerald-600 rounded-full px-2.5 py-0.5">
            {alarms.length > 0 ? `${alarms.length} báo` : 'ỔN ĐỊNH'}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
          {alarms.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Không có cảnh báo hoạt động
            </div>
          ) : (
            alarms.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 py-2">
                <span
                  className="mt-1.5 w-2 h-2 flex-none rounded-full"
                  style={{ backgroundColor: a.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs text-slate-800 truncate">{a.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{a.sub}</div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono flex-none">{a.time}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Box 3: Event Log */}
      <div className="flex-none h-48 bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-800 text-sm">Nhật ký sự kiện</span>
          <span className="text-[11px] text-slate-400">mới nhất ở trên</span>
        </div>
        <div className="flex-1 bg-slate-50/80 rounded-lg p-2.5 overflow-y-auto font-mono text-[11px] leading-relaxed border border-slate-100">
          {logs.map((l, idx) => (
            <div key={idx} className="flex gap-2 py-0.5">
              <span className="text-slate-400 flex-none">{l.t}</span>
              <span style={{ color: l.c }} className="truncate">
                {l.m}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
