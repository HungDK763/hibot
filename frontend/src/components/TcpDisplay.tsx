import React from 'react';
import { TcpPosition } from '../types/robot';

interface TcpDisplayProps {
  tcp: TcpPosition;
}

export const TcpDisplay: React.FC<TcpDisplayProps> = ({ tcp }) => {
  return (
    <div className="flex-none bg-white rounded-xl shadow-sm border border-slate-200/80 px-5 py-3 flex items-center justify-between">
      <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 mr-4">
        Đầu công cụ (TCP)
      </span>
      <div className="flex-1 flex items-center justify-around divide-x divide-slate-100">
        <div className="text-center px-4">
          <div className="text-[10px] font-medium text-slate-400">X mm</div>
          <div className="text-lg font-semibold text-slate-800 tabular-nums">
            {tcp.x.toFixed(2)}
          </div>
        </div>
        <div className="text-center px-4">
          <div className="text-[10px] font-medium text-slate-400">Y mm</div>
          <div className="text-lg font-semibold text-slate-800 tabular-nums">
            {tcp.y.toFixed(2)}
          </div>
        </div>
        <div className="text-center px-4">
          <div className="text-[10px] font-medium text-slate-400">Z mm</div>
          <div className="text-lg font-semibold text-slate-800 tabular-nums">
            {tcp.z.toFixed(2)}
          </div>
        </div>
        <div className="text-center px-4">
          <div className="text-[10px] font-medium text-slate-400">Rx °</div>
          <div className="text-lg font-semibold text-slate-800 tabular-nums">
            {tcp.rx.toFixed(2)}
          </div>
        </div>
        <div className="text-center px-4">
          <div className="text-[10px] font-medium text-slate-400">Ry °</div>
          <div className="text-lg font-semibold text-slate-800 tabular-nums">
            {tcp.ry.toFixed(2)}
          </div>
        </div>
        <div className="text-center px-4">
          <div className="text-[10px] font-medium text-slate-400">Rz °</div>
          <div className="text-lg font-semibold text-slate-800 tabular-nums">
            {tcp.rz.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};
