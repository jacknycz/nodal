import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Use your OpenAI API key from environment variables
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      console.warn('OPENAI_API_KEY environment variable not set')
      return NextResponse.json({ error: 'API key not configured' }, { status: 404 })
    }
    
    return NextResponse.json({ apiKey })
  } catch (error) {
    console.error('Failed to get AI config:', error)
    return NextResponse.json({ error: 'Failed to get AI config' }, { status: 500 })
  }
}