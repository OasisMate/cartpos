# Forgot Password Setup Guide

## Overview

CartPOS uses a custom forgot password implementation that doesn't rely on Supabase Auth. This gives you full control over the password reset flow.

## Email Provider Options

### Option 1: Resend (Recommended - Easiest)

**Why Resend:**
- Simple API, works great with Next.js
- Free tier: 3,000 emails/month
- No SMTP configuration needed
- Good deliverability
- Easy to set up

**Setup Steps:**

1. Sign up at [https://resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Add to `.env`:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   FROM_EMAIL=CartPOS <noreply@yourdomain.com>
   ```
4. For development, you can use their test domain: `onboarding@resend.dev`
5. For production, verify your domain in Resend dashboard

### Option 2: SendGrid

1. Sign up at [https://sendgrid.com](https://sendgrid.com)
2. Create API key
3. Add to `.env`:
   ```env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   FROM_EMAIL=CartPOS <noreply@yourdomain.com>
   ```
4. Update `src/lib/email.ts` to add SendGrid implementation

### Option 3: Nodemailer (SMTP - Gmail, Custom SMTP)

1. Install nodemailer:
   ```bash
   npm install nodemailer
   npm install --save-dev @types/nodemailer
   ```

2. Add to `.env`:
   ```env
   EMAIL_PROVIDER=nodemailer
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   FROM_EMAIL=CartPOS <your-email@gmail.com>
   ```

3. Update `src/lib/email.ts` to add Nodemailer implementation

### Option 4: AWS SES

1. Set up AWS SES
2. Add AWS credentials to `.env`
3. Update `src/lib/email.ts` to add AWS SES implementation

## Database Migration

After adding the `PasswordResetToken` model to Prisma schema:

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_password_reset

# Or if in production
npx prisma migrate deploy
```

## Environment Variables

Add these to your `.env` file:

```env
# Email Configuration
EMAIL_PROVIDER=resend  # Options: resend, sendgrid, nodemailer, ses
RESEND_API_KEY=re_xxxxxxxxxxxxx  # If using Resend
FROM_EMAIL=CartPOS <noreply@yourdomain.com>

# App URL (for reset links)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Development
# NEXT_PUBLIC_APP_URL=https://yourdomain.com  # Production
```

## Testing

### Development Mode

If `RESEND_API_KEY` is not set, the email service will:
- Log the email content to console
- Return success (so you can test the flow)
- Not actually send emails

### Production Mode

Make sure to:
1. Set `RESEND_API_KEY` (or your chosen provider's credentials)
2. Set `NEXT_PUBLIC_APP_URL` to your production domain
3. Verify your sending domain in Resend dashboard
4. Test the full flow before going live

## Security Features

- Tokens expire after 1 hour
- Tokens can only be used once
- Old tokens are invalidated when new ones are created
- Secure random token generation
- Doesn't reveal if email exists (security best practice)

## API Endpoints

### POST `/api/auth/forgot-password`
Request password reset link.

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

### POST `/api/auth/reset-password`
Reset password with token.

**Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "new-password-here"
}
```

**Response:**
```json
{
  "message": "Password has been reset successfully. You can now login with your new password."
}
```

## Next Steps

1. Create the forgot password UI page (`/forgot-password`)
2. Create the reset password UI page (`/reset-password`)
3. Add "Forgot password?" link to login page
4. Test the complete flow

