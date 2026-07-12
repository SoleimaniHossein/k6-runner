import { RequestConfig } from '@/components/RequestForm';
import { v4 as uuidv4 } from 'uuid';

interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string };
  servers?: { url: string; description?: string }[];
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths?: Record<string, Record<string, any>>;
}

function tryJson(val: unknown): string {
  try { return JSON.stringify(val, null, 2); } catch { return ''; }
}

function generateSampleBody(schema: any): string {
  if (!schema) return '';
  if (schema.example !== undefined) return tryJson(schema.example);
  if (schema.properties) {
    const sample: Record<string, any> = {};
    for (const [key, prop] of Object.entries<any>(schema.properties)) {
      if (prop.example !== undefined) sample[key] = prop.example;
      else if (prop.type === 'string') sample[key] = 'string';
      else if (prop.type === 'integer' || prop.type === 'number') sample[key] = 0;
      else if (prop.type === 'boolean') sample[key] = false;
      else if (prop.type === 'object') sample[key] = generateSampleBody(prop) ? JSON.parse(generateSampleBody(prop)) : {};
      else if (prop.type === 'array') sample[key] = [];
      else sample[key] = null;
    }
    return tryJson(sample);
  }
  if (schema.$ref) return `{"$ref": "${schema.$ref}"}`;
  if (schema.type === 'array') return '[]';
  if (schema.type === 'object') return '{}';
  return '';
}

function extractRequestBody(pathItem: any, specVersion: number): { body: string; contentType: string } {
  let body = '';
  let contentType = 'application/json';

  if (specVersion === 2) {
    const bodyParam = pathItem?.parameters?.find((p: any) => p.in === 'body');
    if (bodyParam?.schema) {
      body = generateSampleBody(bodyParam.schema);
    }
  } else {
    const rb = pathItem?.requestBody;
    if (rb) {
      const content = rb.content || {};
      const jsonContent = content['application/json'] || content['*/*'];
      if (jsonContent?.schema) {
        body = generateSampleBody(jsonContent.schema);
      }
      const keys = Object.keys(content);
      if (keys.length > 0) contentType = keys[0];
    }
  }
  return { body, contentType };
}

function extractPathParams(pathItem: any, specVersion: number): Record<string, string> {
  const params: Record<string, string> = {};
  const allParams = pathItem?.parameters || [];
  for (const p of allParams) {
    if (p.in === 'path' && p.name) {
      params[p.name] = '';
    }
    if (p.in === 'header' && p.name) {
      if (p.name.toLowerCase() !== 'content-type' && p.name.toLowerCase() !== 'accept') {
        // handled in headers
      }
    }
  }
  return params;
}

function extractHeaders(pathItem: any, specVersion: number, contentType: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': contentType };
  const allParams = pathItem?.parameters || [];
  for (const p of allParams) {
    if (p.in === 'header' && p.name) {
      const lower = p.name.toLowerCase();
      if (lower !== 'content-type' && lower !== 'accept') {
        headers[p.name] = (p.example as string) || (p.schema?.default as string) || '';
      }
    }
  }
  return headers;
}

function convertPathToTemplate(p: string): string {
  return p.replace(/\{(\w+)\}/g, '{{$1}}');
}

function buildFullUrl(specUrl: string, server: string, path: string): string {
  const pathTpl = convertPathToTemplate(path);
  const cleanServer = server.replace(/\/+$/, '');
  if (server.startsWith('http://') || server.startsWith('https://')) {
    return `${cleanServer}${pathTpl}`;
  }
  let base = '';
  try { base = specUrl ? new URL(specUrl).origin : ''; } catch {}
  return `${base.replace(/\/+$/, '')}${cleanServer}${pathTpl}`;
}

function resolveServerUrl(specUrl: string, server: { url: string }): string {
  if (server.url.startsWith('http://') || server.url.startsWith('https://')) {
    return server.url;
  }
  let base = '';
  try { base = new URL(specUrl).origin; } catch {}
  return `${base}${server.url}`;
}

export async function fetchOpenAPISpec(specUrl: string): Promise<{ title: string; operations: { method: string; path: string; summary: string; tags: string[]; headers: Record<string, string>; body: string }[] }> {
  const proxyUrl = '/api/proxy';
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: specUrl }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  const spec: OpenAPISpec = await response.json();
  return parseOpenAPISpec(specUrl, spec);
}

export function parseOpenAPISpec(specUrl: string, spec: OpenAPISpec): { title: string; operations: { method: string; path: string; summary: string; tags: string[]; headers: Record<string, string>; body: string }[] } {
  const isV3 = !!spec.openapi;
  const specVersion = isV3 ? 3 : 2;
  const title = spec.info?.title || 'Untitled API';

  let serverUrl = '';
  if (isV3 && spec.servers && spec.servers.length > 0) {
    serverUrl = resolveServerUrl(specUrl, spec.servers[0]);
  } else if (!isV3) {
    const scheme = spec.schemes?.[0] || 'https';
    const host = spec.host || 'localhost';
    const basePath = spec.basePath || '';
    serverUrl = `${scheme}://${host}${basePath}`;
  }

  const operations: { method: string; path: string; summary: string; tags: string[]; headers: Record<string, string>; body: string }[] = [];

  const paths = spec.paths || {};
  for (const [path, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== 'object') continue;
    for (const [method, details] of Object.entries(methods)) {
      if (method === 'parameters') continue;
      const op = details as any;
      if (!op || typeof op !== 'object') continue;

      const { body, contentType } = extractRequestBody(op, specVersion);
      const headers = extractHeaders(op, specVersion, contentType);
      const tags = Array.isArray(op.tags) ? op.tags : [];

      const fullUrl = buildFullUrl(specUrl, serverUrl, path);

      operations.push({
        method: method.toUpperCase(),
        path: fullUrl,
        summary: op.summary || op.description || path,
        tags,
        headers,
        body,
      });
    }
  }

  return { title, operations };
}

export function openAPIOperationsToRequests(ops: { method: string; path: string; summary: string; tags: string[]; headers: Record<string, string>; body: string }[]): RequestConfig[] {
  return ops.map((op) => ({
    id: uuidv4(),
    method: op.method,
    url: op.path,
    headers: op.headers,
    body: op.body,
    extract: [],
  }));
}
