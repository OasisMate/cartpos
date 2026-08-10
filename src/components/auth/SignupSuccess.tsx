import Link from 'next/link'
import { AuthHero } from './AuthHero'
import { AuthFormContainer } from './AuthFormContainer'
import { SubmitButton } from '@/components/ui/SubmitButton'

export function SignupSuccess() {
  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row">
      <AuthHero
        title="Your account is ready"
        subtitle="14 days free, no card needed"
        description="Check your email and click the verification link to log in. Your free trial gives you everything: full POS, stock, udhaar, reports and more."
      />

      <AuthFormContainer
        title="Check your email"
        subtitle="We sent you a verification link. Click it to activate your account and start your 14-day free trial."
      >
        <Link href="/login">
          <SubmitButton>Go to login</SubmitButton>
        </Link>
      </AuthFormContainer>
    </div>
  )
}

