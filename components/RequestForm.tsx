'use client';

import { useState, useRef } from 'react';
import { FileText, Download, Upload, X, Plus, FileSpreadsheet, Sparkles, Braces } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseCurlCommand } from '@/lib/curl-parser';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

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
    try { success = document.execCommand('insertText', false, token); } catch {}
    if (success) return;
    const newVal = field.slice(0, start) + token + field.slice(end);
    setter(newVal);
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; }, 0);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') handleJSONUpload(file);
    else if (ext === 'xlsx' || ext === 'xls') handleExcelUpload(file);
    else setUploadError('Please upload a .json, .xlsx, or .xls file');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleJSONUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const json = JSON.parse(content);
        if (typeof json === 'object' && json !== null) {
          onChange({ ...request, body: JSON.stringify(json, null, 2), useExcelLoop: false, excelData: undefined, selectedExcelColumns: undefined });
        } else {
          onChange({ ...request, body: content });
        }
        setUploadSuccess('JSON file loaded successfully');
        setTimeout(() => setUploadSuccess(null), 3000);
      } catch { setUploadError('Invalid JSON file'); }
    };
    reader.onerror = () => setUploadError('Error reading file');
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
        if (jsonData.length === 0) { setUploadError('Excel file is empty'); return; }
        const columns = Object.keys(jsonData[0] as Record<string, unknown>);
        setExcelColumns(columns);
        onChange({ ...request, excelData: jsonData, useExcelLoop: true, selectedExcelColumns: columns });
        setUploadSuccess(`Excel loaded: ${jsonData.length} rows, ${columns.length} columns`);
        setTimeout(() => setUploadSuccess(null), 5000);
      } catch { setUploadError('Invalid Excel file'); }
    };
    reader.onerror = () => setUploadError('Error reading file');
    reader.readAsArrayBuffer(file);
  };

  const toggleExcelLoop = () => {
    if (request.excelData && request.excelData.length > 0) {
      onChange({ ...request, useExcelLoop: !request.useExcelLoop });
    }
  };

  const toggleColumnSelection = (column: string) => {
    const current = request.selectedExcelColumns || [];
    let next = current.includes(column) ? current.filter(c => c !== column) : [...current, column];
    if (next.length === 0) next = excelColumns;
    onChange({ ...request, selectedExcelColumns: next });
  };

  const handleCurlImport = () => {
    const parsed = parseCurlCommand(curlInput);
    if (parsed.error) { setCurlError(parsed.error); return; }
    setCurlError(null);
    setShowCurlImport(false);
    setCurlInput('');
    onChange({ ...request, method: parsed.method, url: parsed.url, headers: { ...request.headers, ...parsed.headers }, body: parsed.body });
  };

  const methodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].map(m => ({ value: m, label: m }));

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<FileText className="h-4 w-4 text-violet-500" />}>
          Request Configuration
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setShowCurlImport(!showCurlImport); setCurlError(null); if (!showCurlImport) setCurlInput(''); }}
          icon={<Download className="h-3.5 w-3.5" />}
        >
          {showCurlImport ? 'Close' : 'Import cURL'}
        </Button>
      </CardHeader>

      {/* cURL Import */}
      {showCurlImport && (
        <div className="mb-4 p-4 border rounded-xl" style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Paste cURL Command</label>
          <textarea
            value={curlInput}
            onChange={(e) => { setCurlInput(e.target.value); setCurlError(null); }}
            placeholder={'curl -X POST https://api.example.com/endpoint \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"key": "value"}\''}
            rows={4}
            className="w-full px-3 py-2 text-sm font-mono bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg placeholder:text-[var(--text-muted)] border border-[var(--border-color)] hover:border-[var(--text-muted)] focus:outline-none focus:border-violet-500 transition-colors duration-150 mb-3 resize-y"
            spellCheck={false}
          />
          {curlError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{curlError}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCurlImport} disabled={!curlInput.trim()} icon={<Download className="h-3.5 w-3.5" />}>Import</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowCurlImport(false); setCurlInput(''); setCurlError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Method + URL */}
        <div className="flex gap-3">
          <div className="w-32 shrink-0">
            <Select label="Method" value={request.method} onChange={(e) => onChange({ ...request, method: e.target.value })} options={methodOptions} />
          </div>
          <div className="flex-1">
            <Input
              ref={urlInputRef}
              label="URL"
              value={request.url}
              onChange={(e) => onChange({ ...request, url: e.target.value })}
              placeholder="https://api.example.com/endpoint/{{id}}"
            />
          </div>
        </div>

        {/* Dynamic tokens for URL */}
        <div className="flex flex-wrap gap-1.5">
          {DYNAMIC_TOKENS.map(dt => (
            <button
              key={dt.token}
              onClick={() => insertAtCursor(urlInputRef.current, request.url, dt.token, (v) => onChange({ ...request, url: v }))}
              title={dt.title}
              className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 border border-[var(--border-color)] rounded-md font-medium transition-colors"
              style={{
                background: 'var(--token-bg)',
                color: 'var(--token-fg)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--token-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--token-bg)';
              }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {dt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Use {'{{column_name}}'} for Excel data or click a tag to insert dynamic values
        </p>

        {/* Headers */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--text-secondary)]">Headers</label>
          {Object.entries(request.headers).length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(request.headers).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const h = { ...request.headers }; const old = h[key]; delete h[key]; h[e.target.value] = old;
                      onChange({ ...request, headers: h });
                    }}
                    className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => { const h = { ...request.headers }; h[key] = e.target.value; onChange({ ...request, headers: h }); }}
                    className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder="Value"
                  />
                  <button
                    onClick={() => { const h = { ...request.headers }; delete h[key]; onChange({ ...request, headers: h }); }}
                    className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4" />
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
              className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const keyInput = e.target as HTMLInputElement;
                  const valueInput = document.getElementById('newHeaderValue') as HTMLInputElement;
                  if (keyInput.value && valueInput.value) {
                    onChange({ ...request, headers: { ...request.headers, [keyInput.value]: valueInput.value } });
                    keyInput.value = ''; valueInput.value = '';
                  }
                }
              }}
            />
            <input
              type="text"
              id="newHeaderValue"
              placeholder="Header Value"
              className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const valueInput = e.target as HTMLInputElement;
                  const keyInput = document.getElementById('newHeaderKey') as HTMLInputElement;
                  if (keyInput.value && valueInput.value) {
                    onChange({ ...request, headers: { ...request.headers, [keyInput.value]: valueInput.value } });
                    keyInput.value = ''; valueInput.value = '';
                  }
                }
              }}
            />
            <button
              onClick={() => {
                const keyInput = document.getElementById('newHeaderKey') as HTMLInputElement;
                const valueInput = document.getElementById('newHeaderValue') as HTMLInputElement;
                if (keyInput.value && valueInput.value) {
                  onChange({ ...request, headers: { ...request.headers, [keyInput.value]: valueInput.value } });
                  keyInput.value = ''; valueInput.value = '';
                }
              }}
              className="p-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Request Body</label>
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} icon={<Upload className="h-3.5 w-3.5" />}>
              Upload
            </Button>
            <input ref={fileInputRef} type="file" accept=".json,.xlsx,.xls,application/json" onChange={handleFileUpload} className="hidden" />
          </div>

          {uploadError && (
            <div             className="mb-2 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 rounded-lg text-xs">
              <X className="h-3.5 w-3.5 shrink-0" />
              {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div             className="mb-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              {uploadSuccess}
            </div>
          )}

          {/* Excel Loop Options */}
          {request.excelData && request.excelData.length > 0 && (
            <div className="mb-3 p-3 border border-[var(--border-color)] bg-[var(--bg-hover)] rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                    Loop Through Excel Data
                  </label>
                  <button
                    onClick={toggleExcelLoop}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${request.useExcelLoop ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${request.useExcelLoop ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{request.excelData.length} rows</span>
              </div>
              {request.useExcelLoop && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Select columns:</span>
                    <div className="flex gap-1">
                      <button onClick={() => onChange({ ...request, selectedExcelColumns: [...excelColumns] })} className="text-[10px] px-2 py-0.5 border border-[var(--border-color)] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-md hover:bg-violet-200 transition">All</button>
                      <button onClick={() => onChange({ ...request, selectedExcelColumns: [excelColumns[0]] })} className="text-[10px] px-2 py-0.5 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] rounded-md hover:bg-[var(--bg-hover)] transition">None</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {excelColumns.map((col) => {
                      const sel = (request.selectedExcelColumns || []).includes(col);
                      return (
                        <button
                          key={col}
                          onClick={() => toggleColumnSelection(col)}
                          className={`px-2.5 py-1 text-xs rounded-full border border-[var(--border-color)] transition-colors ${sel ? 'bg-violet-600 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                        >
                          {col}{sel && ' ✓'}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Use {'{{column_name}}'} in URL, Headers, or Body to reference Excel data
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Dynamic tokens for body */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {DYNAMIC_TOKENS.map(dt => (
              <button
                key={dt.token}
                onClick={() => insertAtCursor(bodyTextareaRef.current, request.body, dt.token, (v) => onChange({ ...request, body: v }))}
                title={dt.title}
                className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 border border-[var(--border-color)] rounded-md font-medium transition-colors"
                style={{
                  background: 'var(--token-bg)',
                  color: 'var(--token-fg)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--token-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--token-bg)';
                }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {dt.label}
              </button>
            ))}
          </div>
          <textarea
            ref={bodyTextareaRef}
            value={request.body}
            onChange={(e) => onChange({ ...request, body: e.target.value })}
            placeholder='{"key": "{{column_name}}", "value": "{{another_column}}"}'
            rows={6}
            className="w-full px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg font-mono text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500 transition-colors resize-y"
            spellCheck={false}
          />
          <div className="mt-1.5 flex justify-between text-xs text-[var(--text-muted)]">
            <span>Paste JSON or upload file</span>
            <span>{request.body.length > 0 ? `${request.body.length} chars` : ''}</span>
          </div>
        </div>

        {/* Format JSON */}
        {request.body.trim() && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              icon={<Braces className="h-3.5 w-3.5" />}
              onClick={() => {
                try { onChange({ ...request, body: JSON.stringify(JSON.parse(request.body), null, 2) }); } catch {}
              }}
            >
              Format JSON
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
