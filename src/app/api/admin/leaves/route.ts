import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, year, planned, emergency, lop, pending, total } = body;

    if (!userId || !year) {
      return NextResponse.json({ error: 'Missing userId or year' }, { status: 400 });
    }

    const balance = await prisma.leaveBalance.upsert({
      where: {
        userId_year: { userId: Number(userId), year: Number(year) }
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
