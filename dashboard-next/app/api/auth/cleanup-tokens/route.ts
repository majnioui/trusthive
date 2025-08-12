import { NextResponse } from 'next/server';
import { cleanupAllOldTokens } from '../../../../lib/auth';

export async function POST(req: Request) {
  try {
    const cleanedCount = await cleanupAllOldTokens();
    return NextResponse.json({
      ok: true,
      message: `Cleaned up ${cleanedCount} old tokens`,
      cleanedCount
    });
  } catch (error) {
    console.error('Error in cleanup endpoint:', error);
    return NextResponse.json({
      ok: false,
      error: 'cleanup_failed'
    }, { status: 500 });
  }
}

// Also allow GET for easier testing
export async function GET() {
  try {
    const cleanedCount = await cleanupAllOldTokens();
    return NextResponse.json({
      ok: true,
      message: `Cleaned up ${cleanedCount} old tokens`,
      cleanedCount
    });
  } catch (error) {
    console.error('Error in cleanup endpoint:', error);
    return NextResponse.json({
      ok: false,
      error: 'cleanup_failed'
    }, { status: 500 });
  }
}
