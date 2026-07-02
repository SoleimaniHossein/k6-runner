// lib/dashboard-client.ts
import { EventEmitter } from 'events';

export interface DashboardMetrics {
  progress: number;
  vu: number;
  iterations: number;
  http_req_duration: number;
  http_reqs: number;
  http_req_failed: number;
  status: 'running' | 'completed' | 'failed' | 'terminated';
  timestamp: number;
  stage?: string;
  currentTime?: string;
  totalTime?: string;
}

/**
 * K6 Dashboard Client - Uses HTTP API for real-time metrics
 * Most reliable method as it uses standard HTTP requests
 */
export class K6DashboardClient extends EventEmitter {
  private port: number;
  private pollTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private lastMetrics: DashboardMetrics = {
    progress: 0,
    vu: 0,
    iterations: 0,
    http_req_duration: 0,
    http_reqs: 0,
    http_req_failed: 0,
    status: 'running',
    timestamp: Date.now(),
  };
  private lastProgress: number = -1;
  private lastStatus: string = '';

  constructor(port: number = 5665) {
    super();
    this.port = port;
  }

  /**
   * Start polling the K6 Dashboard API every 500ms
   */
  connect(): void {
    console.log(`📊 Connecting to K6 Dashboard API on port ${this.port}...`);
    this.isConnected = true;
    this.emit('connected', 'http-api');

    // Clear any existing timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    // Poll every 500ms for real-time updates
    this.pollTimer = setInterval(async () => {
      try {
        await this.fetchMetrics();
      } catch (error) {
        // Silent fail - keep polling
      }
    }, 500);
  }

  /**
   * Fetch metrics from K6 Dashboard API
   */
  private async fetchMetrics(): Promise<void> {
    try {
      // Try to get status first
      const statusRes = await fetch(`http://localhost:${this.port}/api/v1/status`);
      if (!statusRes.ok) {
        // Try alternative endpoint
        const altRes = await fetch(`http://localhost:${this.port}/api/status`);
        if (!altRes.ok) {
          return;
        }
        const data = await altRes.json();
        this.processMetrics(data);
        return;
      }

      const data = await statusRes.json();
      this.processMetrics(data);

      // Also try to get detailed metrics if available
      try {
        const metricsRes = await fetch(`http://localhost:${this.port}/api/v1/metrics`);
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          // Merge metrics
          this.processMetrics({ ...data, ...metricsData });
        }
      } catch {
        // Metrics endpoint might not exist, skip
      }

    } catch (error) {
      // Silent fail - server might not be ready yet
    }
  }

  /**
   * Process incoming metrics from API
   */
  private processMetrics(data: any): void {
    let changed = false;
    const metrics = { ...this.lastMetrics };

    // Progress
    if (data.progress !== undefined && data.progress !== metrics.progress) {
      metrics.progress = data.progress;
      changed = true;
    }

    // VUs
    if (data.vu !== undefined && data.vu !== metrics.vu) {
      metrics.vu = data.vu;
      changed = true;
    }

    // Iterations
    if (data.iterations !== undefined && data.iterations !== metrics.iterations) {
      metrics.iterations = data.iterations;
      changed = true;
    }

    // HTTP metrics
    if (data.http_req_duration !== undefined && data.http_req_duration !== metrics.http_req_duration) {
      metrics.http_req_duration = data.http_req_duration;
      changed = true;
    }

    if (data.http_reqs !== undefined && data.http_reqs !== metrics.http_reqs) {
      metrics.http_reqs = data.http_reqs;
      changed = true;
    }

    if (data.http_req_failed !== undefined && data.http_req_failed !== metrics.http_req_failed) {
      metrics.http_req_failed = data.http_req_failed;
      changed = true;
    }

    // Status
    if (data.status && data.status !== metrics.status) {
      metrics.status = data.status;
      changed = true;
    }

    // Stage info
    if (data.stage) {
      metrics.stage = data.stage;
      changed = true;
    }

    if (data.currentTime) {
      metrics.currentTime = data.currentTime;
      changed = true;
    }

    if (data.totalTime) {
      metrics.totalTime = data.totalTime;
      changed = true;
    }

    metrics.timestamp = Date.now();

    // Update last metrics
    this.lastMetrics = metrics;

    // Emit if changed or if we haven't emitted in a while
    if (changed || metrics.progress !== this.lastProgress) {
      this.lastProgress = metrics.progress;
      this.emit('metrics', metrics);
      this.emit('progress', metrics.progress);
    }

    // Check if test is complete
    if (metrics.status === 'completed' || metrics.status === 'failed' || metrics.status === 'terminated') {
      if (this.lastStatus !== metrics.status) {
        this.lastStatus = metrics.status;
        this.emit('complete', metrics);
        this.disconnect();
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): DashboardMetrics {
    return { ...this.lastMetrics };
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
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isConnected = false;
    this.emit('disconnected');
  }
}
