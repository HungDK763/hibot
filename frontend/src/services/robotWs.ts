import { ConnectionStatus, PortInfo, RobotTelemetry } from '../types/robot';

type TelemetryCallback = (data: RobotTelemetry) => void;
type PortsCallback = (ports: PortInfo[]) => void;
type StatusCallback = (status: ConnectionStatus) => void;

class RobotWsService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private reconnectTimer: any = null;
  private isManualClose: boolean = false;

  private onTelemetryCbs: Set<TelemetryCallback> = new Set();
  private onPortsCbs: Set<PortsCallback> = new Set();
  private onStatusCbs: Set<StatusCallback> = new Set();

  public isConnected: boolean = false;

  constructor() {
    this.determineUrl();
  }

  private determineUrl() {
    if (typeof window !== 'undefined') {
      const loc = window.location;
      if (loc.port === '5173') {
        // Vite dev server -> trỏ sang cổng 8765 của backend
        this.url = 'ws://localhost:8765/ws';
      } else {
        const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
        this.url = `${proto}//${loc.host}/ws`;
      }
    }
  }

  public init() {
    if (!this.url) this.determineUrl();
    this.connect();
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.isManualClose = false;
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emitStatus({
          state: 'connected',
          transport: null,
          message: 'Đã kết nối máy chủ điều khiển (backend)'
        });
        // Lấy danh sách cổng ngay sau khi nối
        this.send({ type: 'list_ports' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'state') {
            this.onTelemetryCbs.forEach((cb) => cb(data));
          } else if (data.type === 'ports') {
            const ports: PortInfo[] = Array.isArray(data.ports)
              ? data.ports.map((p: any) =>
                  typeof p === 'string' ? { device: p, description: '' } : p
                )
              : [];
            this.onPortsCbs.forEach((cb) => cb(ports));
          } else if (data.type === 'conn_status') {
            this.emitStatus({
              state: data.state || 'disconnected',
              transport: data.transport || null,
              message: data.message || ''
            });
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WS error:', err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emitStatus({
          state: 'disconnected',
          transport: null,
          message: 'Mất kết nối backend — đang ở chế độ demo'
        });
        if (!this.isManualClose) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.connect(), 2500);
        }
      };
    } catch (e) {
      console.error('WebSocket connection failed:', e);
    }
  }

  public send(obj: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  public onTelemetry(cb: TelemetryCallback) {
    this.onTelemetryCbs.add(cb);
    return () => this.onTelemetryCbs.delete(cb);
  }

  public onPorts(cb: PortsCallback) {
    this.onPortsCbs.add(cb);
    return () => this.onPortsCbs.delete(cb);
  }

  public onStatus(cb: StatusCallback) {
    this.onStatusCbs.add(cb);
    return () => this.onStatusCbs.delete(cb);
  }

  private emitStatus(st: ConnectionStatus) {
    this.onStatusCbs.forEach((cb) => cb(st));
  }

  // Tiện ích gửi lệnh
  public jog(joint: number, angle: number) {
    this.send({ type: 'jog', joint, angle });
  }

  public jogAll(angles: number[]) {
    this.send({ type: 'jog_all', angles });
  }

  public home() {
    this.send({ type: 'home' });
  }

  public setEnable(value: boolean) {
    this.send({ type: 'enable', value });
  }

  public setEstop(value: boolean) {
    this.send({ type: 'estop', value });
  }

  public setSpeed(value: number) {
    this.send({ type: 'speed', value });
  }

  public setMode(mode: string) {
    this.send({ type: 'set_mode', mode });
  }

  public traj(action: string, value?: number) {
    this.send({ type: 'traj', action, value });
  }

  public refreshPorts() {
    this.send({ type: 'list_ports' });
  }

  public connectHardware(params: {
    transport: 'uart' | 'tcp';
    port?: string;
    baud?: number;
    ip?: string;
    tcpPort?: number;
  }) {
    if (params.transport === 'uart') {
      this.send({
        type: 'connect',
        transport: 'uart',
        port: params.port,
        baud: params.baud || 115200
      });
    } else {
      this.send({
        type: 'connect',
        transport: 'tcp',
        ip: params.ip,
        port: params.tcpPort || 5000
      });
    }
  }

  public disconnectHardware() {
    this.send({ type: 'disconnect' });
  }
}

export const robotWs = new RobotWsService();
