// components/RequestForm.tsx
'use client';
import { useState } from 'react';

export default function RequestForm({ request, onChange }: any) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const addHeader = () => {
    if (newKey && newValue) {
      onChange({ ...request, headers: { ...request.headers, [newKey]: newValue } });
      setNewKey('');
      setNewValue('');
    }
  };

  const removeHeader = (key: string) => {
    const headers = { ...request.headers };
    delete headers[key];
    onChange({ ...request, headers });
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow)] p-6 border border-[var(--border-color)]">
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6 pb-2 border-b border-[var(--border-color)]">
        📝 Request Configuration
      </h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Method</label>
          <select
            value={request.method}
            onChange={(e) => onChange({ ...request, method: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {['GET','POST','PUT','DELETE','PATCH','HEAD'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">URL</label>
          <input
            type="text"
            value={request.url}
            onChange={(e) => onChange({ ...request, url: e.target.value })}
            placeholder="https://api.example.com/endpoint"
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Headers</label>
          {Object.entries(request.headers).map(([key, value]) => (
            <div key={key} className="flex gap-2 mb-2">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const headers = { ...request.headers };
                  const old = headers[key];
                  delete headers[key];
                  headers[e.target.value] = old;
                  onChange({ ...request, headers });
                }}
                className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onChange({ ...request, headers: { ...request.headers, [key]: e.target.value } })}
                className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
              />
              <button onClick={() => removeHeader(key)} className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200">✕</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Header name"
              className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Header value"
              className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
            />
            <button onClick={addHeader} className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">+</button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Request Body</label>
          <textarea
            value={request.body}
            onChange={(e) => onChange({ ...request, body: e.target.value })}
            placeholder='{"key": "value"}'
            rows={4}
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}
