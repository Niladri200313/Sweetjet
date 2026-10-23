import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const internalApiUrl = process.env.INTERNAL_API_SERVER_URL || 'http://127.0.0.1:9000';
    
    const response = await fetch(`${internalApiUrl}/project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    console.error('Next.js /api/project forward error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
