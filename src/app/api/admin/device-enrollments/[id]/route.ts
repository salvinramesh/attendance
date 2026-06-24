import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// PUT /api/admin/device-enrollments/[id] — update mapping
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { userId, note } = body;

  const existing = await prisma.deviceEnrollment.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

  const updateData: { userId?: number; note?: string | null; syncStatus?: string; syncError?: string | null } = {};
  if (userId !== undefined) {
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    updateData.userId = Number(userId);
    if (existing.deviceId === '2') {
      updateData.syncStatus = 'PENDING';
      updateData.syncError = null;
    }
  }
  if (note !== undefined) updateData.note = note?.toString() || null;

  const updated = await prisma.deviceEnrollment.update({
    where: { id: Number(id) },
    data: updateData,
    include: {
      user: { select: { id: true, name: true, username: true, enrollId: true, dept: true } },
    },
  });

  return NextResponse.json({ enrollment: updated });
}

// DELETE /api/admin/device-enrollments/[id] — delete mapping
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.deviceEnrollment.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

  // If deleting an Office 2 enrollment, remove user from the physical device
  if (existing.deviceId === '2') {
    let zk: any = null;
    try {
      // @ts-ignore
      const ZKLib = (await import('zklib-ts')).default || (await import('zklib-ts'));
      zk = new ZKLib('103.66.78.43', 5550, 10000, 4000);
      await zk.createSocket();
      await zk.disableDevice();
      console.log(`Deleting user ${existing.enrollId} from Office 2 device...`);
      await zk.deleteUser(existing.enrollId);
      await zk.enableDevice();
      await zk.disconnect();
    } catch (deviceError: any) {
      console.error(`Failed to delete user ${existing.enrollId} from physical Office 2 device:`, deviceError.message || deviceError);
      if (zk) {
        try { await zk.enableDevice(); } catch (e) {}
        try { await zk.disconnect(); } catch (e) {}
      }
    }
  }

  await prisma.deviceEnrollment.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
