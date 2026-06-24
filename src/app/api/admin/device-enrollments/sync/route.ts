import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { enrollmentId } = body;

    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
    }

    const enrollment = await prisma.deviceEnrollment.findUnique({
      where: { id: Number(enrollmentId) },
      include: { user: true }
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment mapping not found' }, { status: 404 });
    }

    if (enrollment.deviceId !== '2') {
      return NextResponse.json({ error: 'Only Office 2 mappings can be synchronized.' }, { status: 400 });
    }

    // Set sync status to PENDING
    await prisma.deviceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        syncStatus: 'PENDING',
        syncError: null
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Sync queued. The Windows sync agent will process it shortly.' 
    });

  } catch (error: any) {
    console.error('API sync enrollment error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

