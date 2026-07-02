// app/api/test/stream/route.ts
import { NextRequest } from 'next/server';
import { getTestEmitter, getTestStatus } from '@/lib/k6-runner';

/**
 * Server-Sent Events endpoint for real-time updates
 * This pushes live data to the client as it becomes available
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const testId = searchParams.get('id');

  if (!testId) {
    return new Response('Missing test ID', { status: 400 });
  }

  const emitter = getTestEmitter(testId);
  if (!emitter) {
    return new Response('Test not found', { status: 404 });
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial status immediately
  const initial = getTestStatus(testId);
  if (initial) {
    await writer.write(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`));
  }

  // Event handlers
  const updateHandler = (data: any) => {
    try {
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (err) {
      // Writer closed
    }
  };

  const completeHandler = (data: any) => {
    try {
      const { process, ...clean } = data;
      writer.write(encoder.encode(`data: ${JSON.stringify({ ...clean, complete: true })}\n\n`));
      writer.close();
    } catch (err) {
      // Writer closed
    }
  };

  // Subscribe to events
  emitter.on('update', updateHandler);
  emitter.on('complete', completeHandler);

  // Clean up on client disconnect
  request.signal.addEventListener('abort', () => {
    emitter.off('update', updateHandler);
    emitter.off('complete', completeHandler);
    writer.close().catch(() => {});
  });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
