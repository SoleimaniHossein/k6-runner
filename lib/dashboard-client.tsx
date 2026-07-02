// lib/dashboard-client.ts
import { EventEmitter } from 'events';
import WebSocket from 'ws';

export interface DashboardMetrics {
  progress: number;
  vu: number;
  iterations: number;
  http_req_duration: number;
  http_reqs: number;
  http_req_failed: number;
  data_received: number;
  data_sent: number;
  status: 'running' | 'completed' | 'failed' | 'terminated';
  timestamp: number;
  stage?: string;
  currentTime?: string;
  totalTime?: string;
}

/**
 * K6 Dashboard Client - Connects to K6 WebSocket for real-time metrics
 */
export class K6DashboardClient extends EventEmitter {
  private port: number;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private metrics: DashboardMetrics = {
    progress: 0,
    vu: 0,
    iterations: 0,
    http_req_duration: 0,
    http_reqs: 0,
    http_req_failed: 0,
    data_received: 0,
    data_sent: 0,
    status: 'running',
    timestamp: Date.now(),
  };

  constructor(port: number = 5665) {
    super();
    this.port = port;
  }

  /**
   * Connect to K6 WebSocket Dashboard
   */
  connect(): void {
    try {
      const wsUrl = `ws://localhost:${this.port}/ws`;
      console.log(`🔌 Connecting to K6 WebSocket: ${wsUrl}`);

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected to K6 Dashboard');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = data.toString();
          const parsed = JSON.parse(message);
          this.processMetrics(parsed);
        } catch (err) {
          // Silent fail for invalid JSON
        }
      });

      this.ws.on('error', (error) => {
        console.warn('⚠️ WebSocket error:', error.message);
        this.isConnected = false;
        this.emit('error', error);
      });

      this.ws.on('close', () => {
        console.warn('⚠️ WebSocket closed');
        this.isConnected = false;
        this.emit('disconnected');
        this.reconnect();
      });

    } catch (error) {
      console.error('❌ Failed to connect to WebSocket:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process incoming metrics from WebSocket
   */
  private processMetrics(data: any): void {
    let changed = false;

    // Update metrics
    if (data.progress !== undefined && data.progress !== this.metrics.progress) {
      this.metrics.progress = data.progress;
      changed = true;
    }

    if (data.vu !== undefined && data.vu !== this.metrics.vu) {
      this.metrics.vu = data.vu;
      changed = true;
    }

    if (data.iterations !== undefined && data.iterations !== this.metrics.iterations) {
      this.metrics.iterations = data.iterations;
      changed = true;
    }

    if (data.http_req_duration !== undefined && data.http_req_duration !== this.metrics.http_req_duration) {
      this.metrics.http_req_duration = data.http_req_duration;
      changed = true;
    }

    if (data.http_reqs !== undefined && data.http_reqs !== this.metrics.http_reqs) {
      this.metrics.http_reqs = data.http_reqs;
      changed = true;
    }

    if (data.http_req_failed !== undefined && data.http_req_failed !== this.metrics.http_req_failed) {
      this.metrics.http_req_failed = data.http_req_failed;
      changed = true;
    }

    if (data.status && data.status !== this.metrics.status) {
      this.metrics.status = data.status;
      changed = true;
    }

    // Stage information
    if (data.stage) {
      this.metrics.stage = data.stage;
      changed = true;
    }

    if (data.currentTime) {
      this.metrics.currentTime = data.currentTime;
      changed = true;
    }

    if (data.totalTime) {
      this.metrics.totalTime = data.totalTime;
      changed = true;
    }

    this.metrics.timestamp = Date.now();

    // Emit update if anything changed
    if (changed) {
      this.emit('metrics', this.metrics);
      this.emit('progress', this.metrics.progress);
    }

    // Check if test is complete
    if (data.status === 'completed' || data.status === 'failed' || data.status === 'terminated') {
      this.emit('complete', this.metrics);
      this.disconnect();
    }
  }

  /**
   * Reconnect with exponential backoff
   */
  private reconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Get current metrics
   */
  getMetrics(): DashboardMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if connected
   */
  isConnectedToDashboard(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from dashboard
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isConnected = false;
    this.emit('disconnected');
  }
}
