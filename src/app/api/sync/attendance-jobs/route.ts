import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function validateApiKey(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  return apiKey === process.env.SYNC_API_KEY;
}

export async function GET(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const job = await prisma.syncJob.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ success: true, job });
  } catch (error: any) {
    console.error('Failed to get pending sync jobs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { jobId, status, result, error } = body;

    if (!jobId || !status) {
      return NextResponse.json({ error: 'Missing jobId or status' }, { status: 400 });
    }

    const updateData: { status: string; result?: string | null; error?: string | null } = { status };

    if (result !== undefined) {
      updateData.result = typeof result === 'object' ? JSON.stringify(result) : String(result);
    }
    if (error !== undefined) {
      updateData.error = typeof error === 'object' ? JSON.stringify(error) : String(error);
    }

    const updated = await prisma.syncJob.update({
      where: { id: jobId },
      data: updateData
    });

    console.log(`Updated sync job ${jobId} status to: ${status}`);
    return NextResponse.json({ success: true, job: updated });
  } catch (error: any) {
    console.error('Failed to update sync job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
