import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/device-enrollments — list all mappings
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enrollments = await prisma.deviceEnrollment.findMany({
    include: {
      user: {
        select: { id: true, name: true, username: true, enrollId: true, dept: true },
      },
    },
    orderBy: [{ deviceId: 'asc' }, { enrollId: 'asc' }],
  });

  return NextResponse.json({ enrollments });
}

// POST /api/admin/device-enrollments — create a new mapping
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { deviceId, enrollId, userId, note } = body;

  if (!deviceId || !enrollId || !userId) {
    return NextResponse.json({ error: 'deviceId, enrollId, and userId are required' }, { status: 400 });
  }

  // Allow manual enrollment mappings for both Office 1 and Office 2.
  const syncStatus = String(deviceId) === '1' ? 'SYNCED' : 'PENDING';

  // Check conflict
  const existing = await prisma.deviceEnrollment.findUnique({
    where: { deviceId_enrollId: { deviceId: String(deviceId), enrollId: String(enrollId) } },
  });
  if (existing) {
    return NextResponse.json({ error: `Mapping for Office ${deviceId}, Enroll ID ${enrollId} already exists` }, { status: 409 });
  }

  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const enrollment = await prisma.deviceEnrollment.create({
    data: {
      deviceId: String(deviceId),
      enrollId: String(enrollId),
      userId: Number(userId),
      syncStatus,
      note: note?.toString() || null,
    },
    include: {
      user: { select: { id: true, name: true, username: true, enrollId: true, dept: true } },
    },
  });

  return NextResponse.json({ enrollment }, { status: 201 });
}
