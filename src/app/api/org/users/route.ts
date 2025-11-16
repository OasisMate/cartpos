import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser, hashPassword } from '@/lib/auth'

function ensureOrgAdmin(user: any) {
  const isOrgAdmin = user?.organizations?.some(
    (o: any) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN'
  )
  if (!isOrgAdmin && user?.role !== 'PLATFORM_ADMIN') {
    throw new Error('FORBIDDEN')
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const orgId = user.currentOrgId
  if (!orgId) return NextResponse.json({ users: [] })

  const orgUsers = await prisma.organizationUser.findMany({
    where: { orgId },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const userIds = orgUsers.map((ou) => ou.userId)
  const userShops = await prisma.userShop.findMany({
    where: { userId: { in: userIds } },
    include: {
      shop: { select: { id: true, name: true } },
    },
  })

  const users = orgUsers.map((ou) => ({
    id: ou.user.id,
    name: ou.user.name,
    email: ou.user.email,
    platformRole: ou.user.role,
    orgRole: ou.orgRole,
    shops: userShops
      .filter((us) => us.userId === ou.userId)
      .map((us) => ({ shopId: us.shopId, shopRole: us.shopRole, shop: us.shop })),
  }))

  return NextResponse.json({ users })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    ensureOrgAdmin(user)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const name = body?.name as string | undefined
  const email = body?.email as string | undefined
  const password = body?.password as string | undefined
  const orgRole = (body?.orgRole as 'ORG_ADMIN' | undefined) || undefined
  const assignments = (body?.assignments as Array<{ shopId: string; shopRole: 'SHOP_OWNER' | 'CASHIER' }> | undefined) || []

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!user.currentOrgId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
  }

  const hashed = await hashPassword(password)

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { name, email, password: hashed, role: 'NORMAL' },
    })

    await tx.organizationUser.create({
      data: {
        userId: newUser.id,
        orgId: user.currentOrgId!,
        orgRole: orgRole || 'ORG_ADMIN',
      },
    })

    if (assignments.length > 0) {
      for (const a of assignments) {
        await tx.userShop.create({
          data: { userId: newUser.id, shopId: a.shopId, shopRole: a.shopRole },
        })
      }
    }

    return newUser
  })

  return NextResponse.json({ user: { id: result.id } })
}


