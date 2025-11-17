/**
 * Email service utility
 * 
 * Currently supports Resend (recommended) and can be extended for other providers
 * 
 * Setup:
 * 1. Sign up at https://resend.com
 * 2. Get your API key
 * 3. Add to .env: RESEND_API_KEY=your_api_key_here
 * 4. Verify your domain (or use their test domain for development)
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const emailProvider = process.env.EMAIL_PROVIDER || 'resend'
  const fromEmail = options.from || process.env.FROM_EMAIL || 'CartPOS <onboarding@resend.dev>'

  try {
    if (emailProvider === 'resend') {
      return await sendEmailResend({
        ...options,
        from: fromEmail,
      })
    }

    // Future: Add other providers (SendGrid, Nodemailer, etc.)
    return {
      success: false,
      error: `Email provider "${emailProvider}" not implemented`,
    }
  } catch (error) {
    console.error('Email sending error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

async function sendEmailResend(options: EmailOptions & { from: string }): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set. Email sending disabled.')
    // In development, you might want to log the email instead
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email would be sent:', {
        to: options.to,
        subject: options.subject,
        html: options.html,
      })
      return { success: true } // Return success in dev mode for testing
    }
    return {
      success: false,
      error: 'Email service not configured',
    }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to send email',
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

/**
 * Generate password reset email HTML
 */
export function generatePasswordResetEmail(resetLink: string, userName?: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">CartPOS</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
          ${userName ? `<p>Hello ${userName},</p>` : '<p>Hello,</p>'}
          <p>You requested to reset your password for your CartPOS account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #667eea;">${resetLink}</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This link will expire in 1 hour. If you didn't request this, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} CartPOS. All rights reserved.
          </p>
        </div>
      </body>
    </html>
  `
}

