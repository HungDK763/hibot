import React, { useState } from 'react';
import { ConnectionStatus, PortInfo } from '../types/robot';
import { X, RefreshCw, Radio, Wifi } from 'lucide-react';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  connStatus: ConnectionStatus;
  ports: PortInfo[];
  onRefreshPorts: () => void;
  onConnect: (params: {
    transport: 'uart' | 'tcp';
    port?: string;
    baud?: number;
    ip?: string;
    tcpPort?: number;
  }) => void;
  onDisconnect: () => void;
}

const COMMON_BAUDS = [9600, 115200, 230400, 460800, 921600, 1000000, 2000000, 3000000, 6000000];

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  connStatus,
  ports,
  onRefreshPorts,
  onConnect,
  onDisconnect
}) => {
  const [transport, setTransport] = useState<'uart' | 'tcp'>('uart');
  const [selectedPort, setSelectedPort] = useState<string>(ports[0]?.device || '');
  const [baud, setBaud] = useState<number>(115200);
  const [ip, setIp] = useState<string>('192.168.4.1');
  const [tcpPort, setTcpPort] = useState<number>(5000);

  if (!isOpen) return null;

  const isConnected = connStatus.state === 'connected';

  const handleConnect = () => {
    if (transport === 'uart') {
      const portToUse = selectedPort || (ports[0]?.device ?? '');
      onConnect({ transport: 'uart', port: portToUse, baud });
    } else {
      onConnect({ transport: 'tcp', ip, tcpPort });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs select-none">
      <div className="w-[580px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between p-6 pb-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Kết nối robot</h2>
            <p className="text-xs text-slate-500 mt-1">
              Chọn <strong className="text-slate-800 font-semibold">một</strong> kênh giao tiếp.
              Bật kênh này sẽ tự động ngắt kênh kia.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 pt-3 flex flex-col gap-5">
          {/* Transport Selector Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* UART option */}
            <button
              onClick={() => !isConnected && setTransport('uart')}
              className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${
                transport === 'uart'
                  ? 'border-emerald-500 bg-emerald-50/40'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    transport === 'uart' ? 'border-emerald-600' : 'border-slate-300'
                  }`}
                >
                  {transport === 'uart' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  )}
                </div>
                <Radio className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-800">UART · USB‑TTL</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 pl-6">
                Cổng COM nối tiếp · baud tùy chọn lên tới 6 Mbps
              </p>
            </button>

            {/* TCP option */}
            <button
              onClick={() => !isConnected && setTransport('tcp')}
              className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${
                transport === 'tcp'
                  ? 'border-emerald-500 bg-emerald-50/40'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    transport === 'tcp' ? 'border-emerald-600' : 'border-slate-300'
                  }`}
                >
                  {transport === 'tcp' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  )}
                </div>
                <Wifi className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-800">TCP/IP · ESP32</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 pl-6">
                ESP32 chế độ AP/STA · socket thời gian thực
              </p>
            </button>
          </div>

          {/* Form Fields */}
          {transport === 'uart' ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Cổng COM / TTY
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedPort}
                      onChange={(e) => setSelectedPort(e.target.value)}
                      className="flex-1 h-11 bg-slate-100 border-none rounded-xl px-3 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    >
                      {ports.length > 0 ? (
                        ports.map((p) => (
                          <option key={p.device} value={p.device}>
                            {p.device} {p.description ? `· ${p.description}` : ''}
                          </option>
                        ))
                      ) : (
                        <option value="">— Không thấy cổng COM (bấm quét lại) —</option>
                      )}
                    </select>
                    <button
                      onClick={onRefreshPorts}
                      title="Quét lại cổng"
                      className="w-11 h-11 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-700 transition cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Baud Rate
                  </label>
                  <input
                    type="number"
                    value={baud}
                    onChange={(e) => setBaud(parseInt(e.target.value, 10) || 115200)}
                    className="w-full h-11 bg-slate-100 border-none rounded-xl px-3 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Baud chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COMMON_BAUDS.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBaud(b)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition cursor-pointer ${
                      baud === b
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {b >= 1000000 ? `${b / 1000000}M` : b}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                  Địa chỉ IP ESP32
                </label>
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="192.168.4.1"
                  className="w-full h-11 bg-slate-100 border-none rounded-xl px-3 font-mono text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                  Cổng TCP
                </label>
                <input
                  type="number"
                  value={tcpPort}
                  onChange={(e) => setTcpPort(parseInt(e.target.value, 10) || 5000)}
                  className="w-full h-11 bg-slate-100 border-none rounded-xl px-3 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Status Bar */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected
                  ? 'bg-emerald-500'
                  : connStatus.state === 'connecting'
                  ? 'bg-amber-500'
                  : connStatus.state === 'error'
                  ? 'bg-rose-500'
                  : 'bg-slate-400'
              }`}
            />
            <span className="text-xs text-slate-600 font-medium">
              {connStatus.message || (isConnected ? 'Đã kết nối' : 'Chưa kết nối')}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleConnect}
              disabled={isConnected}
              className={`flex-1 h-12 rounded-xl text-sm font-semibold text-white transition shadow-sm cursor-pointer ${
                isConnected
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30 active:scale-98'
              }`}
            >
              {isConnected ? 'Đang kết nối' : 'Kết nối'}
            </button>
            <button
              onClick={onDisconnect}
              disabled={!isConnected}
              className={`px-5 h-12 rounded-xl text-sm font-semibold border transition cursor-pointer ${
                isConnected
                  ? 'border-rose-300 text-rose-600 hover:bg-rose-50'
                  : 'border-slate-200 text-slate-300 cursor-not-allowed'
              }`}
            >
              Ngắt kết nối
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
