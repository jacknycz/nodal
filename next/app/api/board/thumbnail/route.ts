import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { boardId } = await req.json();
    if (!boardId) {
      return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });
    }

    // Call the Vercel serverless function
    const vercelEndpoint = 'https://nodal-steel.vercel.app/api/generate-thumbnail';
    const response = await fetch(vercelEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Failed to generate thumbnail' }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 