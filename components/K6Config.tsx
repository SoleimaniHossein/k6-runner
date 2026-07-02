// components/K6Config.tsx
'use client';
import { useState } from 'react';

export default function K6Config({ options, envVars, args, output, useDashboard, dashboardPort, onChange }: any) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [useStages, setUseStages] = useState(!!options.stages);
  const [useThresholds, setUseThresholds] = useState(!!options.thresholds);

  const addEnv = () => {
    if (newKey && newValue) {
      onChange({ envVars: { ...envVars, [newKey]: newValue } });
      setNewKey('');
      setNewValue('');
    }
  };

  const removeEnv = (key: string) => {
    const env = { ...envVars };
    delete env[key];
    onChange({ envVars: env });
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow)] p-6 border border-[var(--border-color)]">
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6 pb-2 border-b border-[var(--border-color)]">
        ⚙️ K6 Configuration
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Virtual Users (VUs)</label>
            <input
              type="number"
              value={options.vus}
              onChange={(e) => onChange({ options: { ...options, vus: parseInt(e.target.value) || 1 } })}
              min="1"
              className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Duration</label>
            <input
              type="text"
              value={options.duration}
              onChange={(e) => onChange({ options: { ...options, duration: e.target.value } })}
              placeholder="30s, 1m, 2h"
              className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg"
            />
          </div>
        </div>

        <div className="border-t border-[var(--border-color)] pt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-secondary)]">📊 Live Dashboard</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">{useDashboard ? 'Enabled' : 'Disabled'}</span>
              <button
                onClick={() => onChange({ useDashboard: !useDashboard })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useDashboard ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useDashboard ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          {useDashboard && (
            <div className="mt-2">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Dashboard Port</label>
              <input
                type="number"
                value={dashboardPort}
                onChange={(e) => onChange({ dashboardPort: parseInt(e.target.value) || 5665 })}
                min="1024"
                max="65535"
                className="w-full px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">Access at http://localhost:{dashboardPort}</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Stages</label>
            <button onClick={() => setUseStages(!useStages)} className="text-sm text-purple-600 dark:text-purple-400 hover:underline">
              {useStages ? 'Disable' : 'Enable'}
            </button>
          </div>
          {useStages && (
            <textarea
              value={options.stages || ''}
              onChange={(e) => onChange({ options: { ...options, stages: e.target.value } })}
              placeholder='[{"duration":"30s","target":20},{"duration":"1m","target":50}]'
              rows={3}
              className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg font-mono text-sm"
            />
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Thresholds</label>
            <button onClick={() => setUseThresholds(!useThresholds)} className="text-sm text-purple-600 dark:text-purple-400 hover:underline">
              {useThresholds ? 'Disable' : 'Enable'}
            </button>
          </div>
          {useThresholds && (
            <textarea
              value={options.thresholds || ''}
              onChange={(e) => onChange({ options: { ...options, thresholds: e.target.value } })}
              placeholder='{"http_req_duration":["p(95)<500"],"http_req_failed":["rate<0.01"]}'
              rows={3}
              className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg font-mono text-sm"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Output Format</label>
          <select
            value={output}
            onChange={(e) => onChange({ output: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg"
          >
            <option value="text">Text</option>
            <option value="json">JSON</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Additional Arguments</label>
          <input
            type="text"
            value={args}
            onChange={(e) => onChange({ args: e.target.value })}
            placeholder="--no-connection-reuse --no-summary"
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Environment Variables</label>
          {Object.entries(envVars).map(([key, value]) => (
            <div key={key} className="flex gap-2 mb-2">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const env = { ...envVars };
                  const old = env[key];
                  delete env[key];
                  env[e.target.value] = old;
                  onChange({ envVars: env });
                }}
                className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onChange({ envVars: { ...envVars, [key]: e.target.value } })}
                className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
              />
              <button onClick={() => removeEnv(key)} className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200">✕</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Variable name"
              className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Variable value"
              className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
            />
            <button onClick={addEnv} className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">+</button>
          </div>
        </div>
      </div>
    </div>
  );
}
