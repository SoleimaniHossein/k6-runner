'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface KeyValueEditorProps {
  title: string;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  placeholderKey?: string;
  placeholderValue?: string;
  keyLabel?: string;
  valueLabel?: string;
  allowExcelUpload?: boolean;
}

export default function KeyValueEditor({
  title,
  values,
  onChange,
  placeholderKey = 'Key',
  placeholderValue = 'Value',
  keyLabel = 'Key',
  valueLabel = 'Value',
  allowExcelUpload = false,
}: KeyValueEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPair = () => {
    if (newKey.trim() && newValue.trim()) {
      onChange({ ...values, [newKey.trim()]: newValue.trim() });
      setNewKey('');
      setNewValue('');
    }
  };

  const removePair = (key: string) => {
    const newValues = { ...values };
    delete newValues[key];
    onChange(newValues);
  };

  const updateKey = (oldKey: string, newKey: string) => {
    if (newKey.trim() && oldKey !== newKey) {
      const newValues = { ...values };
      const value = newValues[oldKey];
      delete newValues[oldKey];
      newValues[newKey.trim()] = value;
      onChange(newValues);
    }
  };

  const updateValue = (key: string, newValue: string) => {
    onChange({ ...values, [key]: newValue });
  };

  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Convert Excel data to key-value pairs
        const newValues: Record<string, string> = { ...values };
        
        jsonData.forEach((row: any) => {
          const keys = Object.keys(row);
          if (keys.length >= 2) {
            // Use first column as key, second as value
            const key = String(row[keys[0]] || '').trim();
            const value = String(row[keys[1]] || '').trim();
            if (key && value) {
              newValues[key] = value;
            }
          }
        });

        onChange(newValues);
        setUploadError(null);
      } catch (err) {
        setUploadError('Invalid Excel file. Please upload a valid .xlsx or .xls file.');
        console.error('Error parsing Excel:', err);
      }
    };

    reader.onerror = () => {
      setUploadError('Error reading file.');
    };

    reader.readAsArrayBuffer(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-[var(--text-secondary)]">
          {title}
        </label>
        {allowExcelUpload && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition flex items-center gap-1"
            >
              📊 Upload Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="hidden"
            />
          </div>
        )}
      </div>
      
      {uploadError && (
        <div className="p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg text-sm">
          ❌ {uploadError}
        </div>
      )}
      
      {/* Existing key-value pairs */}
      {Object.entries(values).length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {Object.entries(values).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => updateKey(key, e.target.value)}
                className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500"
                placeholder={placeholderKey}
              />
              <input
                type="text"
                value={value}
                onChange={(e) => updateValue(key, e.target.value)}
                className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500"
                placeholder={placeholderValue}
              />
              <button
                onClick={() => removePair(key)}
                className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new pair */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder={placeholderKey}
          className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500"
        />
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={placeholderValue}
          className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500"
        />
        <button
          onClick={addPair}
          disabled={!newKey.trim() || !newValue.trim()}
          className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    </div>
  );
}
