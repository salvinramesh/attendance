import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sourceUserId, targetUserId } = await req.json();

    if (!sourceUserId || !targetUserId) {
      return NextResponse.json({ error: 'Missing source or target user ID' }, { status: 400 });
    }

    const sId = Number(sourceUserId);
    const tId = Number(targetUserId);

    if (sId === tId) {
      return NextResponse.json({ error: 'Source and target user cannot be the same' }, { status: 400 });
    }

    // Fetch both users to verify they exist
    const sourceUser = await prisma.user.findUnique({ where: { id: sId } });
    const targetUser = await prisma.user.findUnique({ where: { id: tId } });

    if (!sourceUser || !targetUser) {
      return NextResponse.json({ error: 'Source or target user not found' }, { status: 404 });
    }

    // Run the merge in a Prisma transaction
    await prisma.$transaction(async (tx) => {
      // 1. Move/Merge DeviceEnrollments
      const sourceEnrollments = await tx.deviceEnrollment.findMany({ where: { userId: sId } });
      const targetEnrollments = await tx.deviceEnrollment.findMany({ where: { userId: tId } });

      for (const se of sourceEnrollments) {
        // Check if target already has an enrollment for this specific device and enrollId
        const hasConflict = targetEnrollments.some(
          (te) => te.deviceId === se.deviceId && te.enrollId === se.enrollId
        );

        if (hasConflict) {
          // Delete duplicate enrollment from source
          await tx.deviceEnrollment.delete({ where: { id: se.id } });
        } else {
          // Reassign enrollment to target user
          await tx.deviceEnrollment.update({
            where: { id: se.id },
            data: { userId: tId }
          });
        }
      }

      // 2. Move WFH logs
      await tx.wFHLog.updateMany({
        where: { userId: sId },
        data: { userId: tId }
      });

      // Move Attendance logs
      await tx.attendanceLog.updateMany({
        where: { userId: sId },
        data: { userId: tId }
      });

      // 3. Move LeaveRecords
      const sourceLeaves = await tx.leaveRecord.findMany({ where: { userId: sId } });
      const targetLeaves = await tx.leaveRecord.findMany({ where: { userId: tId } });

      for (const sl of sourceLeaves) {
        const hasConflict = targetLeaves.some((tl) => tl.date === sl.date);
        if (hasConflict) {
          await tx.leaveRecord.delete({ where: { id: sl.id } });
        } else {
          await tx.leaveRecord.update({
            where: { id: sl.id },
            data: { userId: tId }
          });
        }
      }

      // 4. Move LeaveBalances
      const sourceBalances = await tx.leaveBalance.findMany({ where: { userId: sId } });
      const targetBalances = await tx.leaveBalance.findMany({ where: { userId: tId } });

      for (const sb of sourceBalances) {
        const hasConflict = targetBalances.some((tb) => tb.year === sb.year);
        if (hasConflict) {
          await tx.leaveBalance.delete({ where: { id: sb.id } });
        } else {
          await tx.leaveBalance.update({
            where: { id: sb.id },
            data: { userId: tId }
          });
        }
      }

      // 5. Delete the source user
      await tx.user.delete({ where: { id: sId } });
    });

    // Fetch refreshed list of device enrollments to return to the UI
    const updatedEnrollments = await prisma.deviceEnrollment.findMany({
      include: { user: { select: { id: true, name: true, username: true } } },
      orderBy: [{ deviceId: 'asc' }, { enrollId: 'asc' }]
    });

    return NextResponse.json({
      success: true,
      message: `Successfully merged user ${sourceUser.name} (${sId}) into ${targetUser.name} (${tId})`,
      enrollments: updatedEnrollments
    });
  } catch (error: any) {
    console.error('Merge error:', error);
    return NextResponse.json({ error: error.message || 'Merge failed' }, { status: 500 });
  }
}
