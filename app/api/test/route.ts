import { NextRequest, NextResponse } from 'next/server';
import { runK6Test, getTestStatus, terminateTest, listTests } from '@/lib/k6-runner';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.request || !body.request.url || !body.request.method) {
      return NextResponse.json(
        { error: 'Missing required fields: request.url and request.method' },
        { status: 400 }
      );
    }

    const result = await runK6Test(body);
    
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error running test:', error);
    return NextResponse.json(
      { error: 'Failed to run test', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    
    // Get specific test status
    if (action === 'status' && id) {
      const status = getTestStatus(id);
      if (!status) {
        return NextResponse.json(
          { error: 'Test not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(status);
    }
    
    // Terminate test
    if (action === 'terminate' && id) {
      const success = terminateTest(id);
      if (!success) {
        return NextResponse.json(
          { error: 'Test not found or already completed' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, message: 'Test terminated successfully' });
    }
    
    // List all tests
    if (action === 'list' || !action) {
      const tests = listTests();
      return NextResponse.json(tests);
    }
    
    // Health check
    return NextResponse.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
