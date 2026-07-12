'use client';

import { useState, useRef, useCallback } from 'react';
import { FileText, Download, Upload, X, Plus, FileSpreadsheet, Sparkles, Braces, ChevronDown, ChevronUp, Trash2, GripVertical, Variable } from 'lucide-react';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { parseMultipleCurlCommands } from '@/lib/curl-parser';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

export interface ExtractConfig {
  name: string;
  expression: string;
}

export interface RequestConfig {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  useExcelLoop?: boolean;
  excelData?: any[];
  selectedExcelColumns?: string[];
  extract?: ExtractConfig[];
}

interface RequestFormProps {
  requests: RequestConfig[];
  onChange: (requests: RequestConfig[]) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  HEAD: 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400',
};

const DYNAMIC_TOKENS = [
  { label: 'UUID', token: '{{$uuid}}', title: 'Generate UUID v4 per iteration' },
  { label: 'Increment', token: '{{$increment}}', title: 'Auto-incrementing number per VU' },
  { label: 'Timestamp', token: '{{$timestamp}}', title: 'Current timestamp in ms' },
  { label: 'Random Int', token: '{{$randomInt}}', title: 'Random integer 0-999999' },
  { label: 'Random Str', token: '{{$randomString}}', title: 'Random alphanumeric string' },
];

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].map(m => ({ value: m, label: m }));

function newRequest(): RequestConfig {
  return {
    id: uuidv4(),
    method: 'GET',
    url: '',
    headers: { 'Content-Type': 'application/json' },
    body: '',
    extract: [],
  };
}

export default function RequestForm({ requests, onChange }: RequestFormProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (requests.length > 0) return new Set([requests[0].id]);
    return new Set();
  });
  const [curlInput, setCurlInput] = useState('');
  const [showCurlImport, setShowCurlImport] = useState(false);
  const [curlError, setCurlError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addRequest = useCallback(() => {
    const req = newRequest();
    onChange([...requests, req]);
    setExpandedIds((prev) => new Set(prev).add(req.id));
    setTimeout(() => {
      document.getElementById(`request-card-${req.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }, [requests, onChange]);

  const removeRequest = useCallback(
    (id: string) => {
      if (requests.length <= 1) return;
      onChange(requests.filter((r) => r.id !== id));
      setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    },
    [requests, onChange]
  );

  const moveRequest = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= requests.length) return;
      const next = [...requests];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onChange(next);
    },
    [requests, onChange]
  );

  const updateRequest = useCallback(
    (id: string, updated: RequestConfig) => {
      onChange(requests.map((r) => (r.id === id ? updated : r)));
    },
    [requests, onChange]
  );

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      moveRequest(dragIndex, index);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, moveRequest]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleCurlImport = () => {
    const parsed = parseMultipleCurlCommands(curlInput);
    if (parsed.length === 0) {
      setCurlError('No valid cURL commands found. Check the syntax.');
      return;
    }
    const newRequests = parsed.map((p) => ({
      id: uuidv4(),
      method: p.method,
      url: p.url,
      headers: Object.keys(p.headers).length > 0 ? p.headers : { 'Content-Type': 'application/json' },
      body: p.body || '',
      extract: [],
    }));
    onChange([...requests, ...newRequests]);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      newRequests.forEach((r) => next.add(r.id));
      return next;
    });
    setCurlError(null);
    setShowCurlImport(false);
    setCurlInput('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<FileText className="h-4 w-4 text-violet-500" />}>
          Request Configuration
          {requests.length > 1 && (
            <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">({requests.length} requests)</span>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setShowCurlImport(!showCurlImport); setCurlError(null); if (!showCurlImport) setCurlInput(''); }}
          icon={<Download className="h-3.5 w-3.5" />}
        >
          {showCurlImport ? 'Close' : 'Import cURLs'}
        </Button>
      </CardHeader>

      {showCurlImport && (
        <div className="mb-4 p-4 border rounded-xl" style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Paste cURL Command{requests.length > 0 ? 's' : ''}
          </label>
          <p className="text-xs text-[var(--text-muted)] mb-2">
            Paste one or more cURL commands separated by blank lines to import them all at once.
          </p>
          <textarea
            value={curlInput}
            onChange={(e) => { setCurlInput(e.target.value); setCurlError(null); }}
            placeholder={'curl -X GET https://api.example.com/users\n\ncurl -X POST https://api.example.com/users \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"name": "John"}\''}
            rows={6}
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

      {/* Request Cards */}
      <div className="space-y-2">
        {requests.map((req, index) => {
          const isDragOver = dragOverIndex === index;
          return (
            <div
              key={req.id}
              id={`request-card-${req.id}`}
              className={`transition-all duration-150 ${dragIndex === index ? 'opacity-40 scale-[0.97]' : ''} ${isDragOver && dragIndex !== null ? 'relative' : ''}`}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
            >
              {isDragOver && dragIndex !== null && dragIndex !== index && (
                <div className="absolute -top-1 left-0 right-0 z-10 flex justify-center">
                  <div className="h-0.5 w-full bg-violet-500 rounded-full shadow-sm shadow-violet-500/50" />
                </div>
              )}
              <RequestCard
                req={req}
                index={index}
                total={requests.length}
                expanded={expandedIds.has(req.id)}
                onToggle={() => toggleExpand(req.id)}
                onChange={(updated) => updateRequest(req.id, updated)}
                onRemove={() => removeRequest(req.id)}
                onDragStart={() => handleDragStart(index)}
                onDragEnd={handleDragEnd}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={addRequest}
          icon={<Plus className="h-3.5 w-3.5" />}
        >
          Add Request
        </Button>
      </div>
    </Card>
  );
}

function RequestCard({
  req,
  index,
  total,
  expanded,
  onToggle,
  onChange,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  req: RequestConfig;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (req: RequestConfig) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [showExtract, setShowExtract] = useState(false);

  const insertAtCursor = useCallback(
    (el: HTMLInputElement | HTMLTextAreaElement | null, field: string, token: string, setter: (v: string) => void) => {
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
    },
    []
  );

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const json = JSON.parse(content);
          if (typeof json === 'object' && json !== null) {
            onChange({ ...req, body: JSON.stringify(json, null, 2), useExcelLoop: false, excelData: undefined, selectedExcelColumns: undefined });
          } else {
            onChange({ ...req, body: content });
          }
          setUploadSuccess('JSON file loaded successfully');
          setTimeout(() => setUploadSuccess(null), 3000);
        } catch { setUploadError('Invalid JSON file'); }
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
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
          onChange({ ...req, excelData: jsonData, useExcelLoop: true, selectedExcelColumns: columns });
          setUploadSuccess(`Excel loaded: ${jsonData.length} rows, ${columns.length} columns`);
          setTimeout(() => setUploadSuccess(null), 5000);
        } catch { setUploadError('Invalid Excel file'); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setUploadError('Please upload a .json, .xlsx, or .xls file');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addExtract = () => {
    const extract = req.extract || [];
    onChange({ ...req, extract: [...extract, { name: '', expression: '' }] });
  };

  const updateExtract = (i: number, field: 'name' | 'expression', value: string) => {
    const extract = [...(req.extract || [])];
    extract[i] = { ...extract[i], [field]: value };
    onChange({ ...req, extract });
  };

  const removeExtract = (i: number) => {
    const extract = [...(req.extract || [])];
    extract.splice(i, 1);
    onChange({ ...req, extract });
  };

  const methodColor = METHOD_COLORS[req.method] || METHOD_COLORS.GET;
  const hasPrevExtractRefs = index > 0 && (req.extract || []).length > 0;

  return (
    <div className={`border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-card)] ${hasPrevExtractRefs ? 'border-t-violet-400 dark:border-t-violet-600' : ''}`}>
      {/* Header - drag handle */}
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
        className="w-full flex items-center gap-2.5 px-4 py-3 cursor-grab active:cursor-grabbing select-none hover:bg-[var(--bg-hover)] transition-colors text-left"
        onClick={onToggle}
      >
        <div className="shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          <GripVertical className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-[var(--text-muted)] w-5 text-center shrink-0">{index + 1}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${methodColor}`}>
          {req.method}
        </span>
        <span className="text-sm text-[var(--text-secondary)] truncate flex-1 font-mono">
          {req.url || <span className="italic text-[var(--text-muted)]">No URL</span>}
        </span>
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onRemove}
            disabled={total <= 1}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/50 text-[var(--text-muted)] hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed transition"
            title="Remove request"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[var(--border-color)] space-y-4">
          {/* Method + URL */}
          <div className="flex gap-3">
            <div className="w-32 shrink-0">
              <Select label="Method" value={req.method} onChange={(e) => onChange({ ...req, method: e.target.value })} options={METHOD_OPTIONS} />
            </div>
            <div className="flex-1">
              <Input
                ref={urlInputRef}
                label="URL"
                value={req.url}
                onChange={(e) => onChange({ ...req, url: e.target.value })}
                placeholder="https://api.example.com/endpoint/{{id}}"
              />
            </div>
          </div>

          {/* Dynamic tokens for URL */}
          <div className="flex flex-wrap gap-1.5">
            {DYNAMIC_TOKENS.map((dt) => (
              <button
                key={dt.token}
                onClick={() => insertAtCursor(urlInputRef.current, req.url, dt.token, (v) => onChange({ ...req, url: v }))}
                title={dt.title}
                className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 border border-[var(--border-color)] rounded-md font-medium transition-colors"
                style={{ background: 'var(--token-bg)', color: 'var(--token-fg)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--token-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--token-bg)'; }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {dt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Use {'{{column_name}}'} for Excel data or click a tag to insert dynamic values.
            Use {'{%req1.varname%}'} to reference extracted response variables from earlier requests.
          </p>

          {/* Headers */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-secondary)]">Headers</label>
            {Object.entries(req.headers).length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(req.headers).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const h = { ...req.headers };
                        const old = h[key];
                        delete h[key];
                        h[e.target.value] = old;
                        onChange({ ...req, headers: h });
                      }}
                      className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const h = { ...req.headers };
                        h[key] = e.target.value;
                        onChange({ ...req, headers: h });
                      }}
                      className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                      placeholder="Value"
                    />
                    <button
                      onClick={() => { const h = { ...req.headers }; delete h[key]; onChange({ ...req, headers: h }); }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2" id={`header-add-row-${req.id}`}>
              <input
                type="text"
                placeholder="Header Name"
                className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const keyInput = e.target as HTMLInputElement;
                    const row = keyInput.closest(`#header-add-row-${req.id}`);
                    const valueInput = row?.querySelector('input[placeholder="Header Value"]') as HTMLInputElement | null;
                    if (keyInput.value && valueInput?.value) {
                      onChange({ ...req, headers: { ...req.headers, [keyInput.value]: valueInput.value } });
                      keyInput.value = '';
                      valueInput.value = '';
                    }
                  }
                }}
              />
              <input
                type="text"
                placeholder="Header Value"
                className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const valueInput = e.target as HTMLInputElement;
                    const row = valueInput.closest(`#header-add-row-${req.id}`);
                    const keyInput = row?.querySelector('input[placeholder="Header Name"]') as HTMLInputElement | null;
                    if (keyInput?.value && valueInput.value) {
                      onChange({ ...req, headers: { ...req.headers, [keyInput.value]: valueInput.value } });
                      keyInput.value = '';
                      valueInput.value = '';
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const row = document.getElementById(`header-add-row-${req.id}`);
                  const keyInput = row?.querySelector('input[placeholder="Header Name"]') as HTMLInputElement | null;
                  const valueInput = row?.querySelector('input[placeholder="Header Value"]') as HTMLInputElement | null;
                  if (keyInput?.value && valueInput?.value) {
                    onChange({ ...req, headers: { ...req.headers, [keyInput.value]: valueInput.value } });
                    keyInput.value = '';
                    valueInput.value = '';
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
              <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 rounded-lg text-xs">
                <X className="h-3.5 w-3.5 shrink-0" />
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                {uploadSuccess}
              </div>
            )}

            {/* Excel Loop Options */}
            {req.excelData && req.excelData.length > 0 && (
              <div className="mb-3 p-3 border border-[var(--border-color)] bg-[var(--bg-hover)] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                      Loop Through Excel Data
                    </label>
                    <button
                      onClick={() => {
                        if (req.excelData && req.excelData.length > 0) {
                          onChange({ ...req, useExcelLoop: !req.useExcelLoop });
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${req.useExcelLoop ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${req.useExcelLoop ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">{req.excelData.length} rows</span>
                </div>
                {req.useExcelLoop && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-secondary)]">Select columns:</span>
                      <div className="flex gap-1">
                        <button onClick={() => onChange({ ...req, selectedExcelColumns: [...excelColumns] })} className="text-[10px] px-2 py-0.5 border border-[var(--border-color)] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-md hover:bg-violet-200 transition">All</button>
                        <button onClick={() => onChange({ ...req, selectedExcelColumns: [excelColumns[0]] })} className="text-[10px] px-2 py-0.5 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] rounded-md hover:bg-[var(--bg-hover)] transition">None</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {excelColumns.map((col) => {
                        const sel = (req.selectedExcelColumns || []).includes(col);
                        return (
                          <button
                            key={col}
                            onClick={() => {
                              const current = req.selectedExcelColumns || [];
                              let next = current.includes(col) ? current.filter((c) => c !== col) : [...current, col];
                              if (next.length === 0) next = excelColumns;
                              onChange({ ...req, selectedExcelColumns: next });
                            }}
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
              {DYNAMIC_TOKENS.map((dt) => (
                <button
                  key={dt.token}
                  onClick={() => insertAtCursor(bodyTextareaRef.current, req.body, dt.token, (v) => onChange({ ...req, body: v }))}
                  title={dt.title}
                  className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 border border-[var(--border-color)] rounded-md font-medium transition-colors"
                  style={{ background: 'var(--token-bg)', color: 'var(--token-fg)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--token-bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--token-bg)'; }}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {dt.label}
                </button>
              ))}
            </div>
            <textarea
              ref={bodyTextareaRef}
              value={req.body}
              onChange={(e) => onChange({ ...req, body: e.target.value })}
              placeholder='{"key": "{{column_name}}", "value": "{%req1.token%}"}'
              rows={6}
              className="w-full px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg font-mono text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500 transition-colors resize-y"
              spellCheck={false}
            />
            <div className="mt-1.5 flex justify-between text-xs text-[var(--text-muted)]">
              <span>Paste JSON or upload file</span>
              <span>{req.body.length > 0 ? `${req.body.length} chars` : ''}</span>
            </div>
          </div>

          {/* Response Extraction */}
          <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowExtract(!showExtract)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors text-left"
            >
              <Variable className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-medium text-[var(--text-secondary)] flex-1">
                Response Extraction
              </span>
              {(req.extract?.length ?? 0) > 0 && (
                <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">
                  {req.extract!.length}
                </span>
              )}
              {showExtract ? <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
            </button>
            {showExtract && (
              <div className="px-3 pb-3 pt-1 border-t border-[var(--border-color)] space-y-2">
                <p className="text-xs text-[var(--text-muted)]">
                  Extract values from the response JSON and reference them in later requests as {'{%req1.varname%}'}, {'{%req2.varname%}'}, etc.
                </p>
                {(req.extract || []).map((ext, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={ext.name}
                      onChange={(e) => updateExtract(i, 'name', e.target.value)}
                      placeholder="Variable name"
                      className="flex-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <input
                      type="text"
                      value={ext.expression}
                      onChange={(e) => updateExtract(i, 'expression', e.target.value)}
                      placeholder="JSON path (e.g. access_token or data.user.id)"
                      className="flex-[2] px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <button
                      onClick={() => removeExtract(i)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addExtract}
                  className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/50"
                >
                  <Plus className="h-3 w-3" />
                  Add Extraction
                </button>
              </div>
            )}
          </div>

          {/* Format JSON */}
          {req.body.trim() && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                icon={<Braces className="h-3.5 w-3.5" />}
                onClick={() => {
                  try { onChange({ ...req, body: JSON.stringify(JSON.parse(req.body), null, 2) }); } catch {}
                }}
              >
                Format JSON
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
