import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, isLogVisible } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing enrollment ID' }, { status: 400 });
    }

    const updated = await prisma.deviceEnrollment.update({
      where: { id: Number(id) },
      data: { isLogVisible: Boolean(isLogVisible) }
    });

    return NextResponse.json({ success: true, enrollment: updated });
  } catch (error: any) {
    console.error('Toggle visibility error:', error);
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 });
  }
}
