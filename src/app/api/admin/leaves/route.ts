import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { userId, year, month, planned, emergency, lop, pending, total } = body;

    if (!userId || !year) {
      return NextResponse.json({ error: 'Missing userId or year' }, { status: 400 });
    }

    const m = Number(month || 0);

    const balance = await prisma.leaveBalance.upsert({
      where: {
        userId_year_month: { userId: Number(userId), year: Number(year), month: m }
      },
      update: {
        planned: Number(planned || 0),
        emergency: Number(emergency || 0),
        lop: Number(lop || 0),
        pending: Number(pending || 0),
        total: Number(total || 0)
      },
      create: {
        userId: Number(userId),
        year: Number(year),
        month: m,
        planned: Number(planned || 0),
        emergency: Number(emergency || 0),
        lop: Number(lop || 0),
        pending: Number(pending || 0),
        total: Number(total || 0)
      }
    });

    return NextResponse.json(balance);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update leave balance' }, { status: 500 });
  }
}
