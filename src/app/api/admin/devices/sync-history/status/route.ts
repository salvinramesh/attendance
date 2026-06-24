import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const job = await prisma.syncJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let resultParsed = null;
    if (job.result) {
      try {
        resultParsed = JSON.parse(job.result);
      } catch {
        resultParsed = job.result;
      }
    }

    return NextResponse.json({
      success: true,
      status: job.status,
      result: resultParsed,
      error: job.error
    });
  } catch (error: any) {
    console.error('Failed to get job status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
