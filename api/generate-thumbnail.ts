import { VercelRequest, VercelResponse } from '@vercel/node'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { boardId } = req.body
    if (!boardId) {
      return res.status(400).json({ error: 'Missing boardId' })
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1200, height: 800 },
      executablePath: await chromium.executablePath(),
      headless: true,
    })

    const page = await browser.newPage()
    await page.goto(`https://nodal-steel.vercel.app/board/${boardId}?screenshot=true`, { waitUntil: 'networkidle0' })
    await page.setViewport({ width: 1200, height: 800 })
    const buffer = await page.screenshot({ type: 'jpeg', quality: 80 })
    await browser.close()

    const { error } = await supabase.storage
      .from('board-thumbnails')
      .upload(`${boardId}.jpg`, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
