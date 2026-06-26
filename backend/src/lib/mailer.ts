import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Fail fast instead of hanging when SMTP is misconfigured/unreachable — a hang
  // here leaves the client stuck on "שולח...".
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

// True only when SMTP credentials are actually set. Callers should skip sending
// (rather than block on a doomed connection) when this is false.
export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail(to: string, subject: string, html: string) {
  if (!isMailConfigured()) {
    throw new Error('SMTP is not configured (SMTP_USER/SMTP_PASS missing)');
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@wa-lead-crm.com';
  return transporter.sendMail({ from, to, subject, html });
}
