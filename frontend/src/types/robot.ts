export interface TcpPosition {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface RobotTelemetry {
  type: 'state';
  angles: number[];
  torques: number[];
  vel: number[];
  current: number[];
  tcp: TcpPosition;
  servo: 'on' | 'off' | 'fault';
  fault_code: number;
  traj?: {
    progress?: number;
    playing?: boolean;
  };
}

export interface JointMeta {
  name: string;
  min: number;
  max: number;
  maxTq: number;
  home: number;
  prism?: boolean;
}

export interface PortInfo {
  device: string;
  description: string;
}

export interface ConnectionStatus {
  state: 'connected' | 'connecting' | 'disconnected' | 'error';
  transport: 'uart' | 'tcp' | null;
  message: string;
}

export interface AlarmItem {
  id: string;
  title: string;
  sub: string;
  time: string;
  color: string;
  level: 'info' | 'warn' | 'error';
}

export interface LogItem {
  t: string;
  m: string;
  c: string;
}

export type ControlMode = 'monitor' | 'jog' | 'traj';
