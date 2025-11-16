import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      organizationName,
      contactName,
      email,
      phone,
      password,
      city,
      notes,
    } = body || {}

    if (!organizationName || !contactName || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    const hashed = await hashPassword(password)

    // Create user and organization (PENDING) and link as ORG_ADMIN
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: contactName,
          email,
          password: hashed,
          role: 'NORMAL',
        },
      })

      const org = await tx.organization.create({
        data: {
          name: organizationName,
          status: 'PENDING',
          requestedBy: user.id,
        },
      })

      await tx.organizationUser.create({
        data: {
          userId: user.id,
          orgId: org.id,
          orgRole: 'ORG_ADMIN',
        },
      })

      // Optional: store a "profile" style info in notes via a simple log table in future
      // For now, ignore phone/city/notes or extend schema later

      return { userId: user.id, orgId: org.id }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}


