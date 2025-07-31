import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

console.log('Supabase URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set');
console.log('Supabase Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { boardId, thumbnail } = await req.json();
    console.log('Thumbnail API called with boardId:', boardId);
    
    if (!boardId) {
      return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });
    }

    if (!thumbnail) {
      return NextResponse.json({ error: 'Missing thumbnail data' }, { status: 400 });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(thumbnail, 'base64');
    console.log('Buffer created, size:', buffer.length);

    // Upload to Supabase storage
    console.log('Attempting to upload to Supabase storage...');
    const { error } = await supabase.storage
      .from('documents')
      .upload(`thumbnail-${boardId}.jpg`, buffer, {
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
  } catch (err: unknown) {
    console.error('Thumbnail API error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 