/**
 * Email service utility - Brevo (https://www.brevo.com) transactional email.
 *
 * Setup:
 * 1. Create a Brevo account and connect your sender email.
 * 2. Verify the sender under: Senders & IPs > Senders.
 * 3. Add to .env:
 *    BREVO_API_KEY=...           (Brevo > SMTP & API > API Keys)
 *    BREVO_SENDER_EMAIL=...      (the verified sender address)
 *    BREVO_SENDER_NAME=Cart POS  (display name shown to recipients)
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  /** Optional override of the default sender display name. */
  fromName?: string
  /** Optional override of the default sender address (must be verified in Brevo). */
  fromEmail?: string
}

const DEFAULT_SENDER_EMAIL = 'hamzamakhdoom786@gmail.com'
const DEFAULT_SENDER_NAME = 'Cart POS'

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = options.fromEmail || process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL
  const senderName = options.fromName || process.env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME

  // No key configured: in dev, log the email so flows can be tested without sending.
  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email (not sent - BREVO_API_KEY missing):', {
        to: options.to,
        subject: options.subject,
      })
      return { success: true }
    }
    console.warn('BREVO_API_KEY not set. Email sending disabled.')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const error = data?.message || `Brevo responded ${response.status}`
      console.error('Brevo email error:', error)
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    console.error('Email sending error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

/**
 * Shared email shell - clean, modern, brand-consistent.
 * All CartPOS emails wrap their body content with this so they look uniform.
 * `preview` sets the inbox preview snippet (hidden in the body).
 */
export function emailLayout(content: string, preview = ''): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#f97316;padding:22px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Cart POS</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.6;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;color:#9ca3af;font-size:12px;text-align:center;">
                © ${year} Cart POS. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Reusable orange call-to-action button. */
function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;">
    <tr><td style="border-radius:8px;background:#f97316;">
      <a href="${href}" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a>
    </td></tr>
  </table>`
}

/**
 * Password reset email.
 */
export function generatePasswordResetEmail(resetLink: string, userName?: string): string {
  const content = `
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">Reset your password</h1>
    <p style="margin:0 0 12px;">${userName ? `Hello ${userName},` : 'Hello,'}</p>
    <p style="margin:0 0 4px;">We received a request to reset the password for your Cart POS account. Click the button below to choose a new one.</p>
    ${ctaButton(resetLink, 'Reset Password')}
    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Or paste this link into your browser:</p>
    <p style="margin:0 0 24px;word-break:break-all;"><a href="${resetLink}" style="color:#f97316;font-size:13px;">${resetLink}</a></p>
    <p style="margin:0;color:#9ca3af;font-size:13px;border-top:1px solid #f0f0f0;padding-top:16px;">
      This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>`
  return emailLayout(content, 'Reset your Cart POS password')
}

// Shared notice block: states the 7-day verify-or-be-removed policy.
const SEVEN_DAY_NOTICE = `<div style="margin:8px 0 4px;padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;font-size:13px;">
  ⚠️ Please verify within <strong>7 days</strong>. Unverified accounts are denied and permanently deleted after that.
</div>`

// Big, easy-to-read 6-digit code block (alternative to clicking the link).
function codeBlock(code: string): string {
  return `<div style="margin:8px 0 4px;text-align:center;">
    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Or enter this code on the verification page:</p>
    <div style="display:inline-block;padding:12px 22px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;font-size:28px;font-weight:700;letter-spacing:8px;color:#111827;font-family:'Courier New',monospace;">${code}</div>
  </div>`
}

/**
 * Email-verification email (confirm address ownership on signup).
 */
export function generateVerificationEmail(verifyLink: string, code: string, userName?: string): string {
  const content = `
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">Confirm your email</h1>
    <p style="margin:0 0 12px;">${userName ? `Hello ${userName},` : 'Hello,'}</p>
    <p style="margin:0 0 4px;">Thanks for signing up for Cart POS. Please confirm this email address to continue - once verified, our team will review your account for activation.</p>
    ${ctaButton(verifyLink, 'Verify Email')}
    ${codeBlock(code)}
    ${SEVEN_DAY_NOTICE}
    <p style="margin:16px 0 8px;color:#6b7280;font-size:13px;">Or paste this link into your browser:</p>
    <p style="margin:0 0 24px;word-break:break-all;"><a href="${verifyLink}" style="color:#f97316;font-size:13px;">${verifyLink}</a></p>
    <p style="margin:0;color:#9ca3af;font-size:13px;border-top:1px solid #f0f0f0;padding-top:16px;">
      This link and code expire in 24 hours. If you didn't create a Cart POS account, you can safely ignore this email.
    </p>`
  return emailLayout(content, 'Confirm your Cart POS email')
}

/**
 * Reminder email - admin nudges an account that still hasn't verified.
 */
export function generateVerificationReminderEmail(verifyLink: string, code: string, userName?: string): string {
  const content = `
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">Reminder: verify your email</h1>
    <p style="margin:0 0 12px;">${userName ? `Hello ${userName},` : 'Hello,'}</p>
    <p style="margin:0 0 4px;">Your Cart POS account is still waiting for email verification. Please confirm your email to keep your registration active.</p>
    ${ctaButton(verifyLink, 'Verify Email Now')}
    ${codeBlock(code)}
    ${SEVEN_DAY_NOTICE}
    <p style="margin:16px 0 8px;color:#6b7280;font-size:13px;">Or paste this link into your browser:</p>
    <p style="margin:0 0 24px;word-break:break-all;"><a href="${verifyLink}" style="color:#f97316;font-size:13px;">${verifyLink}</a></p>
    <p style="margin:0;color:#9ca3af;font-size:13px;border-top:1px solid #f0f0f0;padding-top:16px;">
      If you didn't create a Cart POS account, you can ignore this email and the account will be removed automatically.
    </p>`
  return emailLayout(content, 'Reminder: verify your Cart POS email')
}
