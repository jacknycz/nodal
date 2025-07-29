import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { boardId, thumbnail } = await req.json();
    if (!boardId) {
      return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });
    }

    if (!thumbnail) {
      return NextResponse.json({ error: 'Missing thumbnail data' }, { status: 400 });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(thumbnail, 'base64');

    // Upload to Supabase storage
    const { error } = await supabase.storage
      .from('board-thumbnails')
      .upload(`${boardId}.jpg`, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`Thumbnail saved successfully for board: ${boardId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Thumbnail saved successfully' 
    });
  } catch (err: any) {
    console.error('Thumbnail API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 