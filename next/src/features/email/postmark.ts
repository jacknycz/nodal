import { ServerClient } from 'postmark'

export const postmarkClient = process.env.POSTMARK_SERVER_TOKEN
  ? new ServerClient(process.env.POSTMARK_SERVER_TOKEN)
  : null

type SendArgs = {
  to: string
  subject: string
  text?: string
  html?: string
}

export async function sendEmail({ to, subject, text, html }: SendArgs) {
  const from = process.env.POSTMARK_FROM_EMAIL
  if (!postmarkClient || !from) {
    // Dev logging: indicate why send is skipped
    // eslint-disable-next-line no-console
    console.log('[Email] sendEmail skipped', { hasClient: !!postmarkClient, fromDefined: !!from, to, subject })
    return { skipped: true }
  }
  try {
    const resp = await postmarkClient.sendEmail({
      From: from,
      To: to,
      Subject: subject,
      TextBody: text,
      HtmlBody: html,
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM || 'outbound',
    })
    // eslint-disable-next-line no-console
    console.log('[Email] sendEmail ok', { to, subject, messageId: (resp as any)?.MessageID || (resp as any)?.MessageId })
    return { ok: true, response: resp }
  } catch (e: any) {
    const errMsg = e?.message || 'send failed'
    const code = typeof e?.code !== 'undefined' ? e.code : undefined
    // eslint-disable-next-line no-console
    console.error('[Email] sendEmail error', { to, subject, error: errMsg, code })
    return { ok: false, error: errMsg, code }
  }
}


type TemplatedArgs = {
  to: string
  templateId: number
  templateModel: Record<string, any>
}

export async function sendTemplatedEmail({ to, templateId, templateModel }: TemplatedArgs) {
  const from = process.env.POSTMARK_FROM_EMAIL
  if (!postmarkClient || !from) {
    // eslint-disable-next-line no-console
    console.log('[Email] sendTemplatedEmail skipped', { hasClient: !!postmarkClient, fromDefined: !!from, to, templateId })
    return { skipped: true }
  }
  try {
    const resp = await postmarkClient.sendEmailWithTemplate({
      From: from,
      To: to,
      TemplateId: templateId,
      TemplateModel: templateModel,
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM || 'outbound',
    })
    // eslint-disable-next-line no-console
    console.log('[Email] sendTemplatedEmail ok', { to, templateId, messageId: (resp as any)?.MessageID || (resp as any)?.MessageId })
    return { ok: true, response: resp }
  } catch (e: any) {
    const errMsg = e?.message || 'send failed'
    const code = typeof e?.code !== 'undefined' ? e.code : undefined
    // eslint-disable-next-line no-console
    console.error('[Email] sendTemplatedEmail error', { to, templateId, error: errMsg, code })
    return { ok: false, error: errMsg, code }
  }
}


