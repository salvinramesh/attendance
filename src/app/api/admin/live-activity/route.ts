import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  // 1. Authenticate session
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch the latest 30 logs from the database
    const logs = await prisma.attendanceLog.findMany({
      orderBy: { id: 'desc' },
      take: 30,
    });

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('Failed to fetch live activity logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
