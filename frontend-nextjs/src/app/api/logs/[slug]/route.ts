import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const slug = params.slug;
    const internalApiUrl = process.env.INTERNAL_API_SERVER_URL || 'http://127.0.0.1:9000';
    
    const response = await fetch(`${internalApiUrl}/logs/${slug}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ logs: [] });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ logs: [], error: err.message });
  }
}
