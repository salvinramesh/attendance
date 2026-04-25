import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'EMPLOYEE') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const { date, startTime, endTime, remarks } = await req.json();

    const targetDate = parseISO(date);
    if (!isToday(targetDate) && !isYesterday(targetDate)) {
       return NextResponse.json({ error: 'WFH can only be marked for today or yesterday.' }, { status: 400 });
    }

    // Check if WFH log already exists for this date
    const existing = await prisma.wFHLog.findFirst({
       where: { userId: session.id, date }
    });

    if (existing) {
       return NextResponse.json({ error: 'WFH log already exists for this date.' }, { status: 400 });
    }

    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    const min1 = h1 * 60 + m1;
    let min2 = h2 * 60 + m2;
    if (min2 < min1) {
       min2 += 24 * 60; // Handle overnight shifts
    }
    const calculatedHours = (min2 - min1) / 60;

    if (calculatedHours <= 0) {
      return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 });
    }

    const newLog = await prisma.wFHLog.create({
      data: {
        userId: session.id,
        date,
        startTime,
        endTime,
        hours: calculatedHours,
        remarks
      }
    });

    return NextResponse.json(newLog);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to record WFH hours' }, { status: 500 });
  }
}
