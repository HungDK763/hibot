import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface TrajectoryPanelProps {
  playing: boolean;
  progress: number;
  onPlayToggle: () => void;
  onReset: () => void;
  onScrub: (val: number) => void;
}

const WAYPOINTS = [
  { name: 'Home', pos: 0 },
  { name: 'Tiếp cận', pos: 0.18 },
  { name: 'Gắp', pos: 0.38 },
  { name: 'Nâng', pos: 0.56 },
  { name: 'Đặt', pos: 0.8 },
  { name: 'Home', pos: 1.0 }
];

export const TrajectoryPanel: React.FC<TrajectoryPanelProps> = ({
  playing,
  progress,
  onPlayToggle,
  onReset,
  onScrub
}) => {
  const percent = Math.min(Math.max(progress * 100, 0), 100);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const update = (clientX: number) => {
      const x = clientX - rect.left;
      const frac = Math.max(0, Math.min(1, x / rect.width));
      onScrub(frac);
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
    <div className="flex-none bg-white rounded-xl shadow-sm border border-slate-200/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-semibold text-slate-800 text-sm">Quỹ đạo</span>{' '}
          <span className="text-xs text-slate-500 font-medium">
            pick_place_01 · {Math.round(percent)}% · {playing ? 'Đang chạy' : 'Tạm dừng'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            title="Đặt lại quỹ đạo"
            className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onPlayToggle}
            className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition shadow-sm shadow-emerald-600/30 cursor-pointer"
          >
            {playing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white translate-x-0.5" />}
          </button>
        </div>
      </div>

      {/* Scrub bar */}
      <div
        onPointerDown={handlePointerDown}
        className="relative h-6 flex items-center my-4 cursor-pointer select-none"
      >
        <div className="relative w-full h-2 rounded-full bg-slate-100">
          <div
            className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-full transition-all duration-75"
            style={{ width: `${percent}%` }}
          />

          {WAYPOINTS.map((wp, idx) => {
            const isReached = percent >= wp.pos * 100;
            return (
              <div
                key={idx}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: `${wp.pos * 100}%` }}
              >
                <span
                  className={`w-3 h-3 rounded-full border-2 border-emerald-500 shadow-sm transition-colors ${
                    isReached ? 'bg-emerald-500' : 'bg-white'
                  }`}
                />
                <span className="text-[10px] font-medium text-slate-400 mt-2 whitespace-nowrap">
                  {wp.name}
                </span>
              </div>
            );
          })}

          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-md shadow-emerald-500/50 pointer-events-none"
            style={{ left: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
