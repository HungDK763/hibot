import React, { useState } from 'react';
import { JointMeta } from '../types/robot';

interface JogPanelProps {
  joints: JointMeta[];
  angles: number[];
  torques: number[];
  currents: number[];
  speed: number;
  onJogJoint: (jointIndex: number, angle: number) => void;
  onSpeedChange: (speed: number) => void;
}

export const JogPanel: React.FC<JogPanelProps> = ({
  joints,
  angles,
  torques,
  currents,
  speed,
  onJogJoint,
  onSpeedChange
}) => {
  const [step, setStep] = useState<number>(5);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const handleSliderPointerDown = (index: number, e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const meta = joints[index];
    const update = (clientX: number) => {
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetAngle = meta.min + frac * (meta.max - meta.min);
      onJogJoint(index, targetAngle);
    };
    update(e.clientX);

    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleSpeedPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const update = (clientX: number) => {
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSpeedChange(Math.round(frac * 100));
    };
    update(e.clientX);

    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="w-[410px] flex-none bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex flex-col h-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-slate-800 text-base">Điều khiển trục</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400">Bước</span>
          <div className="flex bg-slate-100 rounded-full p-0.5">
            {[1, 5, 15].map((s) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  step === s
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s}°
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="text-xs text-slate-400 mb-3 font-normal">
        Kéo thanh hoặc dùng −/+ · giữ trong giới hạn mềm
      </div>

      {/* Joint Rows List */}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
        {joints.map((meta, i) => {
          const ang = angles[i] ?? meta.home;
          const tq = torques[i] ?? 0;
          const cur = currents[i] ?? Math.abs(tq * 0.55);
          const range = meta.max - meta.min;
          const posPct = range > 0 ? clamp(((ang - meta.min) / range) * 100, 0, 100) : 50;
          const isHot = Math.abs(tq) > meta.maxTq * 0.82;

          return (
            <div
              key={meta.name || i}
              className={`p-2.5 rounded-lg border transition-colors ${
                isHot
                  ? 'bg-rose-50/60 border-rose-200'
                  : 'bg-slate-50/70 border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-medium text-slate-800">
                  {meta.name}{' '}
                  <span className="text-[11px] font-normal text-slate-400">
                    · {meta.min}…{meta.max}
                    {meta.prism ? ' mm' : '°'}
                  </span>
                </span>
                <span className="text-sm font-semibold text-slate-800 tabular-nums">
                  {ang.toFixed(1)}°
                </span>
              </div>

              {/* Slider & Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onJogJoint(i, clamp(ang - step, meta.min, meta.max))}
                  className="w-7 h-7 flex-none border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-md flex items-center justify-center transition cursor-pointer active:scale-95 text-sm"
                >
                  −
                </button>

                <div
                  onPointerDown={(e) => handleSliderPointerDown(i, e)}
                  className="flex-1 h-5 flex items-center cursor-pointer relative"
                >
                  <div className="relative w-full h-2 rounded-full bg-slate-200/80">
                    <div
                      className={`absolute left-0 top-0 bottom-0 rounded-full ${
                        isHot ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${posPct}%` }}
                    />
                    <div
                      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 shadow-sm pointer-events-none ${
                        isHot ? 'border-rose-500' : 'border-emerald-600'
                      }`}
                      style={{ left: `${posPct}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => onJogJoint(i, clamp(ang + step, meta.min, meta.max))}
                  className="w-7 h-7 flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md flex items-center justify-center transition cursor-pointer active:scale-95 text-sm"
                >
                  +
                </button>
              </div>

              {/* Torque & Current */}
              <div className="flex justify-between items-center mt-1.5 text-[11px]">
                <span className="text-slate-400 font-normal">Mô‑men · dòng điện</span>
                <span
                  className={`font-medium tabular-nums ${
                    isHot ? 'text-rose-600 font-semibold' : 'text-slate-600'
                  }`}
                >
                  {Math.round(Math.abs(tq))} Nm · {cur.toFixed(1)} A
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Speed Slider */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
        <span className="text-xs font-medium text-slate-500 flex-none">Tốc độ</span>
        <div
          onPointerDown={handleSpeedPointerDown}
          className="flex-1 h-5 flex items-center cursor-pointer relative"
        >
          <div className="relative w-full h-1.5 rounded-full bg-slate-200">
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full bg-emerald-500"
              style={{ width: `${speed}%` }}
            />
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-600 shadow pointer-events-none"
              style={{ left: `${speed}%` }}
            />
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-800 w-10 text-right tabular-nums">
          {speed}%
        </span>
      </div>
    </div>
  );
};
