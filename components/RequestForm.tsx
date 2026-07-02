// components/RequestForm.tsx
'use client';

import { useState } from 'react';

interface RequestFormProps {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  };
  onChange: (request: any) => void;
}

export default function RequestForm({ request, onChange }: RequestFormProps) {
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');

  const addHeader = () => {
    if (newHeaderKey && newHeaderValue) {
      onChange({
        ...request,
        headers: { ...request.headers, [newHeaderKey]: newHeaderValue },
      });
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...request.headers };
    delete newHeaders[key];
    onChange({ ...request, headers: newHeaders });
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
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
            <option value="HEAD">HEAD</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">URL</label>
          <input
            type="text"
            value={request.url}
            onChange={(e) => onChange({ ...request, url: e.target.value })}
            placeholder="https://api.example.com/endpoint"
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg"
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
                  const newHeaders = { ...request.headers };
                  const oldValue = newHeaders[key];
                  delete newHeaders[key];
                  newHeaders[e.target.value] = oldValue;
                  onChange({ ...request, headers: newHeaders });
                }}
                className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  const newHeaders = { ...request.headers };
                  newHeaders[key] = e.target.value;
                  onChange({ ...request, headers: newHeaders });
                }}
                className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
              />
              <button
                onClick={() => removeHeader(key)}
                className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newHeaderKey}
              onChange={(e) => setNewHeaderKey(e.target.value)}
              placeholder="Header name"
              className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
            />
            <input
              type="text"
              value={newHeaderValue}
              onChange={(e) => setNewHeaderValue(e.target.value)}
              placeholder="Header value"
              className="flex-1 px-3 py-1 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded text-sm"
            />
            <button
              onClick={addHeader}
              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Request Body</label>
          <textarea
            value={request.body}
            onChange={(e) => onChange({ ...request, body: e.target.value })}
            placeholder='{"key": "value"}'
            rows={4}
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg font-mono text-sm"
          />
        </div>
      </div>
    </div>
  );
}
