// app/api/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runK6Test, getTestStatus, terminateTest, listTests } from '@/lib/k6-runner';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.request || !body.request.url || !body.request.method) {
      return NextResponse.json(
        { error: 'Missing required fields: request.url and request.method' },
        { status: 400 }
      );
    }

    if (body.runnerTag && !/^[a-zA-Z0-9._-]+$/.test(body.runnerTag)) {
      return NextResponse.json(
        { error: 'Invalid runnerTag: only letters, numbers, dots, hyphens, and underscores allowed (no spaces or commas)' },
        { status: 400 }
      );
    }

    // Generate a test ID and start the test asynchronously
    const testId = uuidv4();
    console.log(`🚀 Starting test with ID: ${testId}`);
    
    // Start the test without awaiting – it runs in the background
    runK6Test(body, testId).catch(err => {
      console.error('Test execution error:', err);
    });

    // Immediately return the test ID to the frontend
    return NextResponse.json({
      success: true,
      id: testId,
      status: 'running',
      progress: 0,
    });
  } catch (error: any) {
    console.error('Error starting test:', error);
    return NextResponse.json(
      { error: 'Failed to start test', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    console.log(`📡 GET /api/test: action=${action}, id=${id}`);

    if (action === 'status' && id) {
      const status = getTestStatus(id);
      if (!status) {
        console.log(`❌ Test ${id} not found`);
        return NextResponse.json({ error: 'Test not found' }, { status: 404 });
      }
      
      console.log(`📊 Status for ${id}: progress=${status.progress}, status=${status.status}`);
      
      // ✅ Remove circular references (process, _pollInterval, _safetyInterval)
      const { process, _pollInterval, _safetyInterval, ...cleanStatus } = status;
      
      return NextResponse.json(cleanStatus);
    }

    if (action === 'terminate' && id) {
      console.log(`🛑 Terminating test ${id}`);
      const success = await terminateTest(id);
      if (!success) {
        return NextResponse.json(
          { error: 'Test not found or already completed' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, message: 'Test terminated successfully' });
    }

    if (action === 'list' || !action) {
      const tests = listTests();
      console.log(`📋 Listing ${tests.length} tests`);
      return NextResponse.json(tests);
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}