import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '../../../src/features/email/postmark'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const to = String(body?.to || '')
    const subject = String(body?.subject || 'Nodal test email')
    const text = String(body?.text || 'This is a test email from Nodal.')
    const html = typeof body?.html === 'string' ? body.html : undefined
    if (!to) return NextResponse.json({ error: 'Missing to' }, { status: 400 })
    const res = await sendEmail({ to, subject, text, html })
    return NextResponse.json({ ok: true, result: res })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to send' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const to = String(searchParams.get('to') || '')
    const subject = String(searchParams.get('subject') || 'Nodal test email')
    const text = String(searchParams.get('text') || 'This is a test email from Nodal.')
    if (!to) return NextResponse.json({ error: 'Missing to' }, { status: 400 })
    const res = await sendEmail({ to, subject, text })
    return NextResponse.json({ ok: true, result: res })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to send' }, { status: 500 })
  }
}


