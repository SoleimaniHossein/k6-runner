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
        headers: { ...request.headers, [newHeaderKey]: newHeaderValue }
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

  const updateHeader = (key: string, value: string) => {
    const newHeaders = { ...request.headers, [key]: value };
    onChange({ ...request, headers: newHeaders });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
        📝 Request Configuration
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Method</label>
          <select
            value={request.method}
            onChange={(e) => onChange({ ...request, method: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
          <input
            type="text"
            value={request.url}
            onChange={(e) => onChange({ ...request, url: e.target.value })}
            placeholder="https://api.example.com/endpoint"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Headers</label>
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
                placeholder="Header name"
                className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => updateHeader(key, e.target.value)}
                placeholder="Header value"
                className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
              <button
                onClick={() => removeHeader(key)}
                className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition"
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
              className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
            <input
              type="text"
              value={newHeaderValue}
              onChange={(e) => setNewHeaderValue(e.target.value)}
              placeholder="Header value"
              className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
            <button
              onClick={addHeader}
              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Request Body</label>
          <textarea
            value={request.body}
            onChange={(e) => onChange({ ...request, body: e.target.value })}
            placeholder='{"key": "value"}'
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
          />
        </div>
      </div>
    </div>
  );
}
