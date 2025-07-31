import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  // Create Supabase client inside the function to avoid build-time initialization
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing Supabase environment variables');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
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