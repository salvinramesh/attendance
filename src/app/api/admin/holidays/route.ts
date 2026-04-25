import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const holidays = await prisma.holiday.findMany({
    orderBy: { date: 'asc' }
  });

  return NextResponse.json(holidays);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { date, name } = await req.json();
    
    // Check if holiday already exists
    const existing = await prisma.holiday.findUnique({ where: { date } });
    if (existing) {
       return NextResponse.json({ error: 'Holiday already exists for this date' }, { status: 400 });
    }

    const holiday = await prisma.holiday.create({
      data: { date, name }
    });

    return NextResponse.json(holiday);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await prisma.holiday.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
