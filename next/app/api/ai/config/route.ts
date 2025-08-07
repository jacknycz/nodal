import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Use your OpenAI API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }
    
    return NextResponse.json({ apiKey })
  } catch (error) {
    console.error('Failed to get AI config:', error)
    return NextResponse.json({ error: 'Failed to get AI config' }, { status: 500 })
  }
}