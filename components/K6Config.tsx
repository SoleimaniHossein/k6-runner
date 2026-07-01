'use client';

import { useState } from 'react';

interface K6ConfigProps {
  options: {
    vus: number;
    duration: string;
    stages?: string;
  };
  envVars: Record<string, string>;
  args: string;
  output: string;
  onChange: (updates: any) => void;
}

export default function K6Config({ options, envVars, args, output, onChange }: K6ConfigProps) {
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  const addEnvVar = () => {
    if (newEnvKey && newEnvValue) {
      onChange({ envVars: { ...envVars, [newEnvKey]: newEnvValue } });
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const removeEnvVar = (key: string) => {
    const newEnv = { ...envVars };
    delete newEnv[key];
    onChange({ envVars: newEnv });
  };

  const updateEnvVar = (key: string, value: string) => {
    const newEnv = { ...envVars, [key]: value };
    onChange({ envVars: newEnv });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
        ⚙️ K6 Configuration
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Virtual Users (VUs)</label>
          <input
            type="number"
            value={options.vus}
            onChange={(e) => onChange({ options: { ...options, vus: parseInt(e.target.value) || 1 } })}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
          <input
            type="text"
            value={options.duration}
            onChange={(e) => onChange({ options: { ...options, duration: e.target.value } })}
            placeholder="30s, 1m, 2h"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stages (Optional)</label>
          <input
            type="text"
            value={options.stages || ''}
            onChange={(e) => onChange({ options: { ...options, stages: e.target.value } })}
            placeholder='[{"duration": "30s", "target": 20}]'
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">JSON array for load stages</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Output Format</label>
          <select
            value={output}
            onChange={(e) => onChange({ output: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="text">Text</option>
            <option value="json">JSON</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Additional Arguments</label>
          <input
            type="text"
            value={args}
            onChange={(e) => onChange({ args: e.target.value })}
            placeholder="--no-connection-reuse --no-summary"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Environment Variables</label>
          {Object.entries(envVars).map(([key, value]) => (
            <div key={key} className="flex gap-2 mb-2">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const newEnv = { ...envVars };
                  const oldValue = newEnv[key];
                  delete newEnv[key];
                  newEnv[e.target.value] = oldValue;
                  onChange({ envVars: newEnv });
                }}
                placeholder="Variable name"
                className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => updateEnvVar(key, e.target.value)}
                placeholder="Variable value"
                className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
              <button
                onClick={() => removeEnvVar(key)}
                className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value)}
              placeholder="Variable name"
              className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
            <input
              type="text"
              value={newEnvValue}
              onChange={(e) => setNewEnvValue(e.target.value)}
              placeholder="Variable value"
              className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
            <button
              onClick={addEnvVar}
              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
