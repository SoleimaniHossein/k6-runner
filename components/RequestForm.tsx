'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { parseCurlCommand } from '@/lib/curl-parser';

interface RequestFormProps {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    useExcelLoop?: boolean;
    excelData?: any[];
    selectedExcelColumns?: string[];
  };
  onChange: (request: any) => void;
}

export default function RequestForm({ request, onChange }: RequestFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [showExcelOptions, setShowExcelOptions] = useState(false);
  const [curlInput, setCurlInput] = useState('');
  const [showCurlImport, setShowCurlImport] = useState(false);
  const [curlError, setCurlError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const DYNAMIC_TOKENS = [
    { label: 'UUID', token: '{{$uuid}}', title: 'Generate UUID v4 per iteration' },
    { label: 'Increment', token: '{{$increment}}', title: 'Auto-incrementing number per VU' },
    { label: 'Timestamp', token: '{{$timestamp}}', title: 'Current timestamp in ms' },
    { label: 'Random Int', token: '{{$randomInt}}', title: 'Random integer 0-999999' },
    { label: 'Random Str', token: '{{$randomString}}', title: 'Random alphanumeric string' },
  ];

  const insertAtCursor = (el: HTMLInputElement | HTMLTextAreaElement | null, field: string, token: string, setter: (v: string) => void) => {
    if (!el) return;
    el.focus();
    const start = el.selectionStart ?? field.length;
    const end = el.selectionEnd ?? field.length;

    let success = false;
    try {
      success = document.execCommand('insertText', false, token);
    } catch {}

    if (success) {
      return;
    }

    const newVal = field.slice(0, start) + token + field.slice(end);
    setter(newVal);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    }, 0);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'json') {
      handleJSONUpload(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      handleExcelUpload(file);
    } else {
      setUploadError('Please upload a .json, .xlsx, or .xls file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleJSONUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const json = JSON.parse(content);
        
        if (typeof json === 'object' && json !== null) {
          onChange({ 
            ...request, 
            body: JSON.stringify(json, null, 2),
            useExcelLoop: false,
            excelData: undefined,
            selectedExcelColumns: undefined,
          });
        } else {
          onChange({ ...request, body: content });
        }
        setUploadSuccess('JSON file loaded successfully!');
        setTimeout(() => setUploadSuccess(null), 3000);
      } catch (err) {
        setUploadError('Invalid JSON file. Please upload a valid JSON file.');
        console.error('Error parsing JSON:', err);
      }
    };

    reader.onerror = () => {
      setUploadError('Error reading file.');
    };

    reader.readAsText(file);
  };

  const handleExcelUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length === 0) {
          setUploadError('Excel file is empty. Please upload a file with data.');
          return;
        }

        // Get column names
        const columns = Object.keys(jsonData[0] as Record<string, unknown>);
        setExcelColumns(columns);

        // Store the data and select all columns by default
        onChange({ 
          ...request, 
          excelData: jsonData,
          useExcelLoop: true,
          selectedExcelColumns: columns, // Select all columns by default
        });

        setShowExcelOptions(true);
        setUploadSuccess(`Excel file loaded! Found ${jsonData.length} rows and ${columns.length} columns.`);
        setTimeout(() => setUploadSuccess(null), 5000);
      } catch (err) {
        setUploadError('Invalid Excel file. Please upload a valid .xlsx or .xls file.');
        console.error('Error parsing Excel:', err);
      }
    };

    reader.onerror = () => {
      setUploadError('Error reading file.');
    };

    reader.readAsArrayBuffer(file);
  };

  const toggleExcelLoop = () => {
    if (request.excelData && request.excelData.length > 0) {
      onChange({ 
        ...request, 
        useExcelLoop: !request.useExcelLoop 
      });
    }
  };

  const toggleColumnSelection = (column: string) => {
    const currentSelection = request.selectedExcelColumns || [];
    let newSelection: string[];
    
    if (currentSelection.includes(column)) {
      newSelection = currentSelection.filter(c => c !== column);
    } else {
      newSelection = [...currentSelection, column];
    }
    
    // If no columns selected, select all
    if (newSelection.length === 0) {
      newSelection = excelColumns;
    }
    
    onChange({ ...request, selectedExcelColumns: newSelection });
  };

  const selectAllColumns = () => {
    onChange({ ...request, selectedExcelColumns: [...excelColumns] });
  };

  const deselectAllColumns = () => {
    // Keep at least one column selected
    if (excelColumns.length > 0) {
      onChange({ ...request, selectedExcelColumns: [excelColumns[0]] });
    }
  };

  const handleCurlImport = () => {
    const parsed = parseCurlCommand(curlInput);
    if (parsed.error) {
      setCurlError(parsed.error);
      return;
    }
    setCurlError(null);
    setShowCurlImport(false);
    setCurlInput('');
    onChange({
      ...request,
      method: parsed.method,
      url: parsed.url,
      headers: { ...request.headers, ...parsed.headers },
      body: parsed.body,
    });
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow)] p-6 border border-[var(--border-color)]">
      <div className="flex items-center justify-between mb-6 pb-2 border-b border-[var(--border-color)]">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          📝 Request Configuration
        </h2>
        <button
          onClick={() => {
            setShowCurlImport(!showCurlImport);
            setCurlError(null);
            if (!showCurlImport) setCurlInput('');
          }}
          className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition flex items-center gap-1"
        >
          {showCurlImport ? '✕ Close' : '⬇ Import cURL'}
        </button>
      </div>

      {showCurlImport && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-lg">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Paste cURL Command
          </label>
          <textarea
            value={curlInput}
            onChange={(e) => {
              setCurlInput(e.target.value);
              setCurlError(null);
            }}
            placeholder={'curl -X POST https://api.example.com/endpoint \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"key": "value"}\''}
            rows={5}
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg font-mono text-sm mb-3"
            spellCheck={false}
          />
          {curlError && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{curlError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleCurlImport}
              disabled={!curlInput.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition text-sm"
            >
              Import
            </button>
            <button
              onClick={() => {
                setShowCurlImport(false);
                setCurlInput('');
                setCurlError(null);
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-[var(--text-secondary)] rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Method */}
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

        {/* URL */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">URL</label>
          <input
            ref={urlInputRef}
            type="text"
            value={request.url}
            onChange={(e) => onChange({ ...request, url: e.target.value })}
            placeholder="https://api.example.com/endpoint/{{id}}"
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg"
          />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {DYNAMIC_TOKENS.map(dt => (
              <button
                key={dt.token}
                onClick={() => insertAtCursor(urlInputRef.current, request.url, dt.token, (v) => onChange({ ...request, url: v }))}
                title={dt.title}
                className="text-[10px] px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition"
              >
                {dt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Use {'{{column_name}}'} for Excel data or click a tag above to insert dynamic values
          </p>
        </div>

        {/* Headers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
              Headers
            </label>
          </div>
          
          {Object.entries(request.headers).length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(request.headers).map(([key, value]) => (
                <div key={key} className="flex gap-2">
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
                    className="flex-1 px-3 py-1.5 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg text-sm font-mono"
                    placeholder="Header Name"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const newHeaders = { ...request.headers };
                      newHeaders[key] = e.target.value;
                      onChange({ ...request, headers: newHeaders });
                    }}
                    className="flex-1 px-3 py-1.5 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg text-sm font-mono"
                    placeholder="Header Value (use {{column_name}})"
                  />
                  <button
                    onClick={() => {
                      const newHeaders = { ...request.headers };
                      delete newHeaders[key];
                      onChange({ ...request, headers: newHeaders });
                    }}
                    className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              id="newHeaderKey"
              placeholder="Header Name"
              className="flex-1 px-3 py-1.5 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg text-sm font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const keyInput = e.target as HTMLInputElement;
                  const valueInput = document.getElementById('newHeaderValue') as HTMLInputElement;
                  if (keyInput.value && valueInput.value) {
                    const newHeaders = { ...request.headers };
                    newHeaders[keyInput.value] = valueInput.value;
                    onChange({ ...request, headers: newHeaders });
                    keyInput.value = '';
                    valueInput.value = '';
                  }
                }
              }}
            />
            <input
              type="text"
              id="newHeaderValue"
              placeholder="Header Value"
              className="flex-1 px-3 py-1.5 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg text-sm font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const valueInput = e.target as HTMLInputElement;
                  const keyInput = document.getElementById('newHeaderKey') as HTMLInputElement;
                  if (keyInput.value && valueInput.value) {
                    const newHeaders = { ...request.headers };
                    newHeaders[keyInput.value] = valueInput.value;
                    onChange({ ...request, headers: newHeaders });
                    keyInput.value = '';
                    valueInput.value = '';
                  }
                }
              }}
            />
            <button
              onClick={() => {
                const keyInput = document.getElementById('newHeaderKey') as HTMLInputElement;
                const valueInput = document.getElementById('newHeaderValue') as HTMLInputElement;
                if (keyInput.value && valueInput.value) {
                  const newHeaders = { ...request.headers };
                  newHeaders[keyInput.value] = valueInput.value;
                  onChange({ ...request, headers: newHeaders });
                  keyInput.value = '';
                  valueInput.value = '';
                }
              }}
              className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              +
            </button>
          </div>
        </div>

        {/* Body with upload button */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
              Request Body (JSON)
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition flex items-center gap-1"
              >
                📤 Upload File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.xlsx,.xls,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
          
          {uploadError && (
            <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg text-sm">
              ❌ {uploadError}
            </div>
          )}
          
          {uploadSuccess && (
            <div className="mb-2 p-2 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg text-sm">
              ✅ {uploadSuccess}
            </div>
          )}

          {/* Excel Loop Options with Multi-Column Selection */}
          {request.excelData && request.excelData.length > 0 && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900/30 border border-[var(--border-color)] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">
                    🔄 Loop Through Excel Data
                  </label>
                  <button
                    onClick={toggleExcelLoop}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      request.useExcelLoop ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        request.useExcelLoop ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {request.excelData.length} rows loaded
                </span>
              </div>

              {request.useExcelLoop && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs text-[var(--text-secondary)]">
                      Select columns to use as data sources:
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllColumns}
                        className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllColumns}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {excelColumns.map((col) => {
                      const isSelected = (request.selectedExcelColumns || []).includes(col);
                      return (
                        <button
                          key={col}
                          onClick={() => toggleColumnSelection(col)}
                          className={`px-3 py-1 text-xs rounded-full transition ${
                            isSelected
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {col} {isSelected && '✓'}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    Selected columns: {(request.selectedExcelColumns || []).join(', ') || 'None'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Use {'{{column_name}}'} in URL, Headers, or Body to reference Excel data
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mb-2">
            {DYNAMIC_TOKENS.map(dt => (
              <button
                key={dt.token}
                onClick={() => insertAtCursor(bodyTextareaRef.current, request.body, dt.token, (v) => onChange({ ...request, body: v }))}
                title={dt.title}
                className="text-[10px] px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition"
              >
                {dt.label}
              </button>
            ))}
          </div>
          <textarea
            ref={bodyTextareaRef}
            value={request.body}
            onChange={(e) => onChange({ ...request, body: e.target.value })}
            placeholder='{"key": "{{column_name}}", "value": "{{another_column}}"}'
            rows={20}
            className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg font-mono text-sm"
            spellCheck={false}
          />
          
          <div className="mt-1 flex justify-between text-xs text-[var(--text-muted)]">
            <span>Paste JSON or upload .json/.xlsx/.xls file</span>
            <span>{request.body.length > 0 ? `${request.body.length} characters` : ''}</span>
          </div>
        </div>

        {/* Quick format button */}
        {request.body.trim() && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                try {
                  const parsed = JSON.parse(request.body);
                  onChange({ ...request, body: JSON.stringify(parsed, null, 2) });
                } catch (e) {
                  // Not valid JSON, ignore
                }
              }}
              className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-[var(--text-secondary)] rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              🔄 Format JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}