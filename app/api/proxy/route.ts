import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json, */*' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `HTTP ${response.status}: ${response.statusText}` }, { status: response.status });
    }

    const text = await response.text();
    try {
      JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Response is not valid JSON' }, { status: 502 });
    }

    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Proxy fetch failed' }, { status: 502 });
  }
}
