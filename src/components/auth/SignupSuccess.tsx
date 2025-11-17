import Link from 'next/link'
import { AuthHero } from './AuthHero'
import { AuthFormContainer } from './AuthFormContainer'
import { SubmitButton } from '@/components/ui/SubmitButton'

export function SignupSuccess() {
  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row">
      <AuthHero
        title="Request submitted successfully"
        subtitle="Your organization request is pending approval"
        description="A platform admin will review your request. You'll be able to log in once your organization is approved."
      />

      <AuthFormContainer title="Request Submitted" subtitle="Your organization registration is pending admin approval">
        <Link href="/waiting-approval">
          <SubmitButton>View Status</SubmitButton>
        </Link>
      </AuthFormContainer>
    </div>
  )
}

