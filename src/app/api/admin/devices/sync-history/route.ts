import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { rangeType, startDate, endDate } = body;

    if (!rangeType) {
      return NextResponse.json({ error: 'Missing rangeType' }, { status: 400 });
    }

    if (rangeType === 'custom' && (!startDate || !endDate)) {
      return NextResponse.json({ error: 'Missing custom date range' }, { status: 400 });
    }

    const jobId = `job_${Date.now()}`;
    const job = await prisma.syncJob.create({
      data: {
        id: jobId,
        status: 'PENDING',
        rangeType,
        startDate: rangeType === 'custom' ? startDate : null,
        endDate: rangeType === 'custom' ? endDate : null
      }
    });

    console.log(`Created historical sync job: ${job.id}`);
    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error: any) {
    console.error('Failed to create sync job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
