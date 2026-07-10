import { parse } from 'shell-quote';

export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

export function parseCurlCommand(input: string): ParsedCurl {
  const result: ParsedCurl = {
    method: 'GET',
    url: '',
    headers: {},
    body: '',
  };

  const trimmed = input.trim();
  if (!trimmed) {
    result.error = 'Please paste a cURL command';
    return result;
  }

  let tokens: string[];
  try {
    const parsed = parse(trimmed);
    tokens = parsed.map((t: any) => (typeof t === 'string' ? t : t.comment ?? String(t.pattern ?? '')));
  } catch {
    result.error = 'Invalid command syntax';
    return result;
  }

  if (tokens.length === 0) {
    result.error = 'Empty command';
    return result;
  }

  if (!tokens[0].toLowerCase().includes('curl')) {
    result.error = 'Not a cURL command';
    return result;
  }

  let i = 1;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '-X' || token === '--request' || token === '--method') {
      i++;
      if (i < tokens.length) {
        result.method = tokens[i].toUpperCase();
      }
    } else if (token === '-H' || token === '--header') {
      i++;
      if (i < tokens.length) {
        const headerStr = tokens[i];
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > 0) {
          const key = headerStr.slice(0, colonIdx).trim();
          const value = headerStr.slice(colonIdx + 1).trim();
          if (key) {
            result.headers[key] = value;
          }
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary' || token === '--data-urlencode') {
      i++;
      if (i < tokens.length) {
        if (result.body) {
          result.body += '&' + tokens[i];
        } else {
          result.body = tokens[i];
        }
      }
    } else if (token === '-u' || token === '--user') {
      i++;
      if (i < tokens.length) {
        result.headers['Authorization'] = 'Basic ' + btoa(tokens[i]);
      }
    } else if (token === '-b' || token === '--cookie') {
      i++;
      if (i < tokens.length) {
        const existing = result.headers['Cookie'] || '';
        result.headers['Cookie'] = existing ? `${existing}; ${tokens[i]}` : tokens[i];
      }
    } else if (token === '-k' || token === '--insecure') {
      // Skip SSL verification - ignore for k6
    } else if (token === '-L' || token === '--location') {
      // Follow redirects - handled by k6 by default
    } else if (token === '-i' || token === '--include' || token === '-s' || token === '--silent' || token === '-S' || token === '--show-error' || token === '-f' || token === '--fail' || token === '-v' || token === '--verbose' || token === '--compressed' || token === '-O' || token === '--remote-name' || token === '-o' || token === '--output') {
      // Flags we can safely skip (output/verbosity related)
      if (token === '-o' || token === '--output') {
        i++; // skip the output filename
      }
    } else if (token === '--retry' || token === '--retry-delay' || token === '--connect-timeout' || token === '--max-time') {
      i++; // skip the value argument
    } else if (token.startsWith('-')) {
      // Unknown flag with possible value argument
      // Check if next token exists and is not a flag
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        // Try to determine if this flag takes a value by checking known single-dash flags
        // Single char flags might have attached values like -Ooutput or take next arg
        if (token.length > 2) {
          // Could be -Ooutput format, skip the value
        } else {
          // Single char unknown flag - next token might be its value
          i++;
        }
      }
    } else if (!token.startsWith('-')) {
      // Non-flag argument - treat as URL
      if (!result.url) {
        result.url = token;
      }
    }

    i++;
  }

  // Infer method from body presence
  if (result.body && result.method === 'GET') {
    result.method = 'POST';
  }

  if (!result.url) {
    result.error = 'No URL found in cURL command';
  }

  return result;
}
