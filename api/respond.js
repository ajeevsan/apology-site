// Vercel serverless function: receives her answer and emails it to you via Resend.
// Secrets live in environment variables only (RESEND_API_KEY, TO_EMAIL). Nothing is exposed to the browser.

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Light in-memory rate limit (per warm instance). Enough to stop accidental hammering.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 8;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.TO_EMAIL;
  if (!apiKey || !to) {
    console.error('Missing RESEND_API_KEY or TO_EMAIL');
    return res.status(500).json({ ok: false, error: 'Server is not configured' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'Too many requests' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { answer, message, token, website } = body || {};

  // Honeypot: bots fill this, people don't. Pretend success.
  if (website) return res.status(200).json({ ok: true });

  if (answer !== 'YES' && answer !== 'NO') {
    return res.status(400).json({ ok: false, error: 'Invalid answer' });
  }
  if (typeof token !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(token)) {
    return res.status(400).json({ ok: false, error: 'Invalid token' });
  }
  const note = typeof message === 'string' ? message.slice(0, 1000).trim() : '';

  const now = new Date();
  const utc = now.toISOString();
  const ist = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' });
  const emoji = answer === 'YES' ? '❤️' : '🤍';

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#4a2f48">
      <h2 style="margin:0 0 12px">Her answer: ${answer} ${emoji}</h2>
      <p style="margin:0 0 6px"><b>Time (IST):</b> ${escapeHtml(ist)}</p>
      <p style="margin:0 0 16px"><b>Time (UTC):</b> ${escapeHtml(utc)}</p>
      <p style="margin:0 0 6px"><b>Her message:</b></p>
      <div style="background:#fdf0f5;border-radius:12px;padding:14px;white-space:pre-wrap">${note ? escapeHtml(note) : '<i>(no message)</i>'}</div>
    </div>`;
  const text = `Her answer: ${answer}\nTime (IST): ${ist}\nTime (UTC): ${utc}\n\nHer message:\n${note || '(no message)'}\n`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Same token => Resend sends only one email, even if the request is retried.
        'Idempotency-Key': `apology-${token}`
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Apology Site <onboarding@resend.dev>',
        to: [to],
        subject: `Her answer: ${answer} ${emoji}`,
        html,
        text
      })
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      // A repeat of an already-processed request is a success from the user's point of view.
      if (r.status === 409 && /idempotent/i.test(detail)) return res.status(200).json({ ok: true, duplicate: true });
      console.error('Resend error', r.status, detail);
      return res.status(502).json({ ok: false, error: 'Email service error' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Send failed', err);
    return res.status(502).json({ ok: false, error: 'Email service unreachable' });
  }
};
