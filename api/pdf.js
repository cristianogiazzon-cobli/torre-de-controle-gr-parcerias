/* POST /api/pdf  { html } -> application/pdf (1920x1080 px por página, paisagem, vetorial).
 * Gera o PDF da proposta no servidor, para ficar idêntico em qualquer navegador (Safari não respeita o tamanho da página no diálogo de impressão).
 * Acesso: cabeçalho x-access-key = ACCESS_KEY, como em /api/rpc. */
const crypto = require('crypto');

const igual = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!igual(req.headers['x-access-key'], process.env.ACCESS_KEY)) return res.status(401).json({ error: 'Link de acesso inválido.' });
  const html = req.body && req.body.html;
  if (typeof html !== 'string' || html.length < 100 || html.length > 4000000) return res.status(400).json({ error: 'HTML da proposta ausente ou grande demais.' });
  let browser;
  try {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = (await import('puppeteer-core')).default;
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: process.env.CHROME_PATH || await chromium.executablePath(),
      headless: 'shell'
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {});
    await page.evaluate(() => (document.fonts && document.fonts.ready) || null).catch(() => {});
    await page.emulateMediaType('print');
    const pdf = await page.pdf({ width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
    res.setHeader('Content-Type', 'application/pdf');
    return res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};
