import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  FolderOpen,
  FileCode,
  UploadCloud,
  Cpu,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { JointMeta } from '../types/robot';

interface DetectedRobot {
  id: string;
  name: string;
  path: string;
  folder: string;
  jointCount: number;
  meshCount: number;
}

interface UrdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelName: string;
  joints: JointMeta[];
  onLoadFiles: (files: FileList | File[]) => void;
  onLoadPath: (path: string) => Promise<void>;
  onRestoreDefault: () => void;
}

export const UrdfModal: React.FC<UrdfModalProps> = ({
  isOpen,
  onClose,
  modelName,
  joints,
  onLoadFiles,
  onLoadPath,
  onRestoreDefault
}) => {
  const [activeTab, setActiveTab] = useState<'detected' | 'custom'>('detected');
  const [robots, setRobots] = useState<DetectedRobot[]>([]);
  const [isLoadingRobots, setIsLoadingRobots] = useState<boolean>(false);
  const [customPath, setCustomPath] = useState<string>('');
  const [isSubmittingPath, setIsSubmittingPath] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quét danh sách robot có sẵn trên máy từ backend
  const fetchRobots = async () => {
    setIsLoadingRobots(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/robots');
      if (res.ok) {
        const data = await res.json();
        setRobots(data.robots || []);
      }
    } catch (err: any) {
      console.warn('Không thể kết nối API /api/robots:', err);
    } finally {
      setIsLoadingRobots(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRobots();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectRobot = async (robotPath: string) => {
    setErrorMsg(null);
    setIsSubmittingPath(true);
    try {
      await onLoadPath(robotPath);
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi nạp mô hình');
    } finally {
      setIsSubmittingPath(false);
    }
  };

  const handlePathSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPath.trim()) return;
    setErrorMsg(null);
    setIsSubmittingPath(true);
    try {
      await onLoadPath(customPath.trim());
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Không thể nạp đường dẫn này');
    } finally {
      setIsSubmittingPath(false);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onLoadFiles(e.target.files);
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onLoadFiles(e.target.files);
      onClose();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onLoadFiles(e.dataTransfer.files);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs select-none p-4">
      <div className="w-[740px] max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">Quản lý & nạp mô hình 3D (URDF + STL)</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Hỗ trợ tự động nhận diện file STL 3D từ các dự án CAD/ROS trên máy hoặc tải từ thư mục.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 pt-3 bg-slate-50/50 border-b border-slate-200/80">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('detected')}
              className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
                activeTab === 'detected'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              Robot có sẵn trong máy ({robots.length})
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
                activeTab === 'custom'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Chọn file / thư mục / đường dẫn
            </button>
          </div>

          <button
            onClick={() => {
              onRestoreDefault();
              onClose();
            }}
            className="pb-2.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition"
            title="Quay về cánh tay robot công nghiệp 6-DOF kim loại"
          >
            <RefreshCw className="w-3 h-3" />
            Khôi phục 6-DOF mặc định
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 flex-none" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body content */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
          {/* TAB 1: Robot có sẵn trong máy */}
          {activeTab === 'detected' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Các gói robot phát hiện được trong <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">~/Documents/CAD</code> và <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">vd_robot_description</code>:</span>
                <button
                  onClick={fetchRobots}
                  disabled={isLoadingRobots}
                  className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingRobots ? 'animate-spin' : ''}`} />
                  Quét lại
                </button>
              </div>

              {isLoadingRobots ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                  <span className="text-xs">Đang quét thư mục CAD và ROS...</span>
                </div>
              ) : robots.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Chưa tìm thấy file URDF nào trong các thư mục mặc định. Vui lòng chọn thẻ "Chọn file / thư mục".
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {robots.map((r) => {
                    const isCurrent = modelName === r.name;
                    return (
                      <div
                        key={r.path}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                          isCurrent
                            ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 truncate">
                              {r.name}
                            </span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Đang hiển thị
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>
                              Khớp động:{' '}
                              <strong className="text-slate-800 font-semibold">{r.jointCount} DOF</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Meshes:{' '}
                              <strong className="text-emerald-700 font-semibold">{r.meshCount} STL</strong>
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                            {r.path}
                          </div>
                        </div>

                        <button
                          onClick={() => handleSelectRobot(r.path)}
                          disabled={isSubmittingPath}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex-none ${
                            isCurrent
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-slate-100 text-slate-700 hover:bg-emerald-600 hover:text-white'
                          }`}
                        >
                          {isCurrent ? 'Nạp lại' : 'Nạp mô hình'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Tự chọn File / Thư mục / Nhập đường dẫn */}
          {activeTab === 'custom' && (
            <div className="flex flex-col gap-4">
              {/* Nhập trực tiếp đường dẫn */}
              <form onSubmit={handlePathSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập đường dẫn thư mục hoặc file .urdf trên máy tính..."
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  className="flex-1 h-10 px-3.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={isSubmittingPath || !customPath.trim()}
                  className="px-4 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Nạp đường dẫn
                </button>
              </form>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="file"
                  ref={folderInputRef}
                  onChange={handleFolderChange}
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                />
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                >
                  <FolderOpen className="w-4 h-4 text-emerald-600" />
                  Chọn cả thư mục dự án (kèm meshes/)
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept=".urdf,.stl,.STL"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                >
                  <FileCode className="w-4 h-4 text-emerald-600" />
                  Chọn file (.urdf và .stl cùng lúc)
                </button>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-xl p-6 flex flex-col items-center justify-center text-center transition cursor-pointer"
              >
                <UploadCloud className="w-8 h-8 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-slate-700">
                  Kéo thả thư mục hoặc các file .urdf &amp; .stl vào đây
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Trình duyệt sẽ tự động giải mã các lưới STL nhị phân/ASCII
                </span>
              </div>
            </div>
          )}

          {/* Model information Table */}
          <div className="mt-1 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Thông tin mô hình hiện tại
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {modelName} ·{' '}
                <span className="text-emerald-600 font-bold">{joints.length} bậc tự do</span>
              </span>
            </div>

            {/* Joints Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-4 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <span>Khớp (Joint)</span>
                <span>Kiểu</span>
                <span className="text-center">Vị trí Home</span>
                <span className="text-right">Giới hạn mềm</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                {joints.map((j) => (
                  <div key={j.name} className="grid grid-cols-4 px-4 py-1.5 text-xs items-center">
                    <span className="font-semibold text-slate-800 truncate">{j.name}</span>
                    <span className="text-slate-500 font-normal">
                      {j.prism ? 'prismatic' : 'revolute'}
                    </span>
                    <span className="text-center font-mono text-emerald-600 font-medium">
                      {j.home}°
                    </span>
                    <span className="text-right font-mono text-slate-600">
                      {j.min}° … {j.max}°
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
