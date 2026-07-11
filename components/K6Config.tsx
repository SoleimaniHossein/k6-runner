'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, Users, Timer, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Toggle from '@/components/ui/Toggle';
import Button from '@/components/ui/Button';

interface K6ConfigProps {
  options: { vus: number; duration: string; stages?: string; thresholds?: string };
  envVars: Record<string, string>;
  args: string;
  output: string;
  useDashboard?: boolean;
  dashboardPort?: number;
  restAPIPort?: number;
  useRestAPI?: boolean;
  useInfluxDB?: boolean;
  influxDBURL?: string;
  influxDBUser?: string;
  influxDBPass?: string;
  runnerTag?: string;
  onChange: (updates: any) => void;
}

export default function K6Config({
  options, envVars, args, output,
  useDashboard = true, dashboardPort = 5665, restAPIPort = 6565, useRestAPI = true,
  useInfluxDB = false, influxDBURL = '', influxDBUser = '', influxDBPass = '',
  runnerTag = '', onChange,
}: K6ConfigProps) {
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [useStages, setUseStages] = useState(!!options.stages);
  const [useThresholds, setUseThresholds] = useState(!!options.thresholds);
  const [tagHint, setTagHint] = useState(false);
  const tagHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!unitDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target as Node)) {
        setUnitDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [unitDropdownOpen]);

  const addEnv = () => {
    if (newEnvKey && newEnvValue) {
      onChange({ envVars: { ...envVars, [newEnvKey]: newEnvValue } });
      setNewEnvKey(''); setNewEnvValue('');
    }
  };

  const removeEnv = (key: string) => {
    const env = { ...envVars }; delete env[key]; onChange({ envVars: env });
  };

  const outputOptions = [{ value: 'text', label: 'Text' }, { value: 'json', label: 'JSON' }];

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Settings className="h-4 w-4 text-blue-500" />}>
          K6 Configuration
        </CardTitle>
      </CardHeader>

      <div className="space-y-4">
        {/* VUs + Duration */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Virtual Users"
            type="number"
            value={options.vus}
            onChange={(e) => onChange({ options: { ...options, vus: parseInt(e.target.value) || 1 } })}
            min="1"
            icon={<Users className="h-4 w-4 text-[var(--text-muted)]" />}
          />
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Duration</label>
            <div className="flex items-center border border-[var(--border-color)] rounded-lg transition-colors focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/20 bg-[var(--bg-input)]">
              <div className="flex items-center justify-center w-10 h-full shrink-0 rounded-l-lg" style={{ backgroundColor: 'var(--icon-duration-bg)', color: 'var(--icon-duration-fg)' }}>
                <Timer className="h-4 w-4" />
              </div>
              {(() => {
                const match = options.duration.match(/^(\d+)(ms|s|m|h)$/);
                const num = match ? parseInt(match[1]) : 30;
                const unit = match ? match[2] : 's';
                const units = ['ms', 's', 'm', 'h'] as const;
                return (
                  <>
                    <input
                      type="number"
                      min="1"
                      value={num}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 1;
                        onChange({ options: { ...options, duration: `${v}${unit}` } });
                      }}
                      className="flex-1 px-2.5 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] text-sm font-mono focus:outline-none min-w-0"
                    />
                    <div className="h-6 w-px bg-[var(--border-color)]" />
                    <div className="relative" ref={unitDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setUnitDropdownOpen(!unitDropdownOpen)}
                        className="h-full px-2.5 py-2 pr-7 text-sm font-semibold focus:outline-none cursor-pointer transition-colors rounded-r-lg"
                        style={{ backgroundColor: 'rgba(124,58,237,0.75)', color: '#ffffff' }}
                      >
                        {unit}
                      </button>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60 pointer-events-none" />
                      {unitDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-card)] rounded-lg shadow-lg border border-[var(--border-color)] overflow-hidden min-w-[60px]">
                          {units.map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => {
                                onChange({ options: { ...options, duration: `${num}${u}` } });
                                setUnitDropdownOpen(false);
                              }}
                              className={`block w-full text-left px-3 py-1.5 text-sm font-medium transition-colors ${
                                u === unit
                                  ? 'bg-violet-600 text-white'
                                  : 'text-[var(--text-primary)] hover:bg-violet-50 dark:hover:bg-violet-950/40'
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Runner Tag */}
        <Input
          label="Runner Tag"
          value={runnerTag}
          onChange={(e) => {
            const raw = e.target.value;
            const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '');
            onChange({ runnerTag: cleaned });
            if (cleaned !== raw) {
              setTagHint(true);
              if (tagHintTimer.current) clearTimeout(tagHintTimer.current);
              tagHintTimer.current = setTimeout(() => setTagHint(false), 2500);
            }
          }}
          error={tagHint ? 'Invalid characters were removed' : undefined}
          placeholder="e.g. login-test-001"
          hint="Letters, numbers, dots, hyphens, or underscores"
        />

        {/* Integrations */}
        <div className="space-y-3 pt-2">
          <div className="p-3 border rounded-xl space-y-3" style={{ background: 'var(--panel-dashboard-bg)', borderColor: 'var(--panel-dashboard-border)' }}>
            <Toggle
              checked={!!useDashboard}
              onChange={() => onChange({ useDashboard: !useDashboard })}
              label="Web Dashboard"
              statusText={useDashboard ? 'Enabled' : 'Disabled'}
              activeColor="bg-violet-600"
            />
            {useDashboard && (
              <Input
                label="Dashboard Port"
                type="number"
                value={dashboardPort}
                onChange={(e) => onChange({ dashboardPort: parseInt(e.target.value) || 5665 })}
                min="1024"
                max="65535"
              />
            )}
          </div>

          <div className="p-3 border rounded-xl space-y-3" style={{ background: 'var(--panel-dashboard-bg)', borderColor: 'var(--panel-dashboard-border)' }}>
            <Toggle
              checked={!!useRestAPI}
              onChange={() => onChange({ useRestAPI: !useRestAPI })}
              label="REST API"
              statusText={useRestAPI ? 'Enabled' : 'Disabled'}
              activeColor="bg-violet-600"
            />
            {useRestAPI && (
              <div className="space-y-1.5">
                <Input
                  label="REST API Port"
                  type="number"
                  value={restAPIPort}
                  onChange={(e) => onChange({ restAPIPort: parseInt(e.target.value) || 6565 })}
                  min="1024"
                  max="65535"
                />
                <p className="text-[10px] text-[var(--text-muted)] font-mono">localhost:{restAPIPort}/v1/status</p>
              </div>
            )}
          </div>

          <div className="p-3 border rounded-xl space-y-3" style={{ background: 'var(--panel-dashboard-bg)', borderColor: 'var(--panel-dashboard-border)' }}>
            <Toggle
              checked={!!useInfluxDB}
              onChange={() => onChange({ useInfluxDB: !useInfluxDB })}
              label="InfluxDB Output"
              statusText={useInfluxDB ? 'Enabled' : 'Disabled'}
              activeColor="bg-violet-600"
            />
            {useInfluxDB && (
              <div className="space-y-2">
                <Input
                  label="InfluxDB URL"
                  value={influxDBURL}
                  onChange={(e) => onChange({ influxDBURL: e.target.value })}
                  placeholder="http://localhost:8086/k6"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Username" value={influxDBUser} onChange={(e) => onChange({ influxDBUser: e.target.value })} placeholder="Optional" />
                  <Input label="Password" type="password" value={influxDBPass} onChange={(e) => onChange({ influxDBPass: e.target.value })} placeholder="Optional" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Options */}
        <div className="pt-1">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Advanced Options
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Stages */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Stages</label>
                <Button variant="ghost" size="sm" onClick={() => setUseStages(!useStages)}>
                  {useStages ? 'Disable' : 'Enable'}
                </Button>
              </div>
              {useStages && (
                <Textarea
                  value={options.stages || ''}
                  onChange={(e) => onChange({ options: { ...options, stages: e.target.value } })}
                  placeholder='[{"duration":"30s","target":20},{"duration":"1m","target":50}]'
                  rows={3}
                />
              )}
            </div>

            {/* Thresholds */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Thresholds</label>
                <Button variant="ghost" size="sm" onClick={() => setUseThresholds(!useThresholds)}>
                  {useThresholds ? 'Disable' : 'Enable'}
                </Button>
              </div>
              {useThresholds && (
                <Textarea
                  value={options.thresholds || ''}
                  onChange={(e) => onChange({ options: { ...options, thresholds: e.target.value } })}
                  placeholder='{"http_req_duration":["p(95)<500"],"http_req_failed":["rate<0.01"]}'
                  rows={3}
                />
              )}
            </div>

            {/* Output + Args */}
            <Select label="Output Format" value={output} onChange={(e) => onChange({ output: e.target.value })} options={outputOptions} />
            <Input
              label="Additional Arguments"
              value={args}
              onChange={(e) => onChange({ args: e.target.value })}
              placeholder="--no-connection-reuse --no-summary"
            />

            {/* Env Vars */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Environment Variables</label>
              {Object.entries(envVars).map(([key, value]) => (
                <div key={key} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => { const env = { ...envVars }; const old = env[key]; delete env[key]; env[e.target.value] = old; onChange({ envVars: env }); }}
                    className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange({ envVars: { ...envVars, [key]: e.target.value } })}
                    className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                  />
                  <button onClick={() => removeEnv(key)} className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  placeholder="Name"
                  className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                />
                <input
                  type="text"
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                />
                <button onClick={addEnv} className="p-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
