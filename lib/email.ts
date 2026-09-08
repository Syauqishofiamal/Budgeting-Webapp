// ── Transactional email ─────────────────────────────────────────────────────
// No mail provider is configured yet. Rather than fail, this module logs the
// link to the server console so verification and password reset are fully
// usable in development and testable in production logs.
//
// To send real mail: sign up at resend.com, verify a sending domain, then set
//   RESEND_API_KEY=re_...
//   EMAIL_FROM="Coffer <noreply@yourdomain.com>"
// No other code changes are needed — sendMail() picks the provider up.

export function appUrl(): string {
  // Vercel exposes the deployment host; fall back to localhost in development.
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

interface Mail { to: string; subject: string; text: string; html: string }

async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!key || !from) {
    // Development / unconfigured: surface the link instead of dropping it.
    console.log(
      `\n[email] No RESEND_API_KEY set — printing instead of sending.\n` +
      `        To: ${mail.to}\n        ${mail.subject}\n        ${mail.text}\n`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}

function wrap(title: string, body: string, cta: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f6f3;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1a17">
    <div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #e2ded6;
      border-radius:16px;padding:28px">
      <div style="font-size:28px">🪙</div>
      <h1 style="font-size:20px;margin:12px 0 8px">${title}</h1>
      <p style="font-size:15px;line-height:1.5;color:#6b665e;margin:0 0 20px">${body}</p>
      <a href="${cta.url}" style="display:inline-block;background:#4f7a5b;color:#fff;
        text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">
        ${cta.label}</a>
      <p style="font-size:12px;color:#9a948a;margin:20px 0 0;line-height:1.5">
        If the button does not work, paste this into your browser:<br>${cta.url}</p>
    </div></body></html>`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = `${appUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: 'Confirm your Coffer email',
    text: `Confirm your email to secure your Coffer account: ${url}\n\nThis link expires in 24 hours.`,
    html: wrap('Confirm your email',
      'Confirming your address lets you reset your password if you ever lose it. The link expires in 24 hours.',
      { label: 'Confirm email', url }),
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = `${appUrl()}/reset?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: 'Reset your Coffer password',
    text: `Reset your Coffer password: ${url}\n\nThis link expires in 1 hour. If you did not ask for this, ignore this email.`,
    html: wrap('Reset your password',
      'Use the button below to choose a new password. The link expires in one hour. If you did not request this, you can ignore this email.',
      { label: 'Choose a new password', url }),
  });
}
