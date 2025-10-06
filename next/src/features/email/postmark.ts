import postmark from 'postmark'

export const postmarkClient = process.env.POSTMARK_SERVER_TOKEN
  ? new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN)
  : null

type SendArgs = {
  to: string
  subject: string
  text?: string
  html?: string
}

export async function sendEmail({ to, subject, text, html }: SendArgs) {
  const from = process.env.POSTMARK_FROM_EMAIL
  if (!postmarkClient || !from) return { skipped: true }
  try {
    const resp = await postmarkClient.sendEmail({
      From: from,
      To: to,
      Subject: subject,
      TextBody: text,
      HtmlBody: html,
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM || 'outbound',
    })
    return { ok: true, response: resp }
  } catch (e: any) {
    const errMsg = e?.message || 'send failed'
    const code = typeof e?.code !== 'undefined' ? e.code : undefined
    return { ok: false, error: errMsg, code }
  }
}


