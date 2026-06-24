import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { enrollmentId } = await req.json();
    if (!enrollmentId) {
      return NextResponse.json({ error: 'Missing enrollment ID' }, { status: 400 });
    }

    const enrollment = await prisma.deviceEnrollment.findUnique({
      where: { id: Number(enrollmentId) },
      include: { user: true }
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const totalUserEnrollments = await prisma.deviceEnrollment.count({
      where: { userId: enrollment.userId }
    });

    if (totalUserEnrollments <= 1) {
      return NextResponse.json({ error: 'Cannot unclub a user with only one enrollment mapping.' }, { status: 400 });
    }

    // Split and create a separate user for this enrollment
    const deviceId = enrollment.deviceId;
    const enrollId = enrollment.enrollId;
    const suffix = deviceId === '1' ? '(3F)' : '(2F)';
    const username = `${enrollId}-${deviceId === '1' ? '3f' : '2f'}`;
    
    // Clean parent user name
    const cleanName = enrollment.user.name
      ? enrollment.user.name.replace(/\s*\(2F.*\)/i, '').replace(/\s*\(3F.*\)/i, '').trim()
      : `Employee ${enrollId}`;
    const displayName = `${cleanName} (${deviceId === '1' ? '3F' : '2F'})`;
    const displayEnrollId = `${enrollId} ${suffix}`;

    await prisma.$transaction(async (tx) => {
      // 1. Find a unique username — check if the base username already exists
      let finalUsername = username;
      const existing = await tx.user.findUnique({ where: { username: finalUsername } });
      if (existing) {
        // Append incrementing suffix until unique
        let suffix = 1;
        while (true) {
          const candidate = `${username}-${suffix}`;
          const conflict = await tx.user.findUnique({ where: { username: candidate } });
          if (!conflict) {
            finalUsername = candidate;
            break;
          }
          suffix++;
          if (suffix > 100) {
            throw new Error('Unable to generate a unique username after 100 attempts');
          }
        }
      }

      // 2. Create separate user
      const defaultPassword = await bcrypt.hash('password123', 10);
      const user = await tx.user.create({
        data: {
          username: finalUsername,
          password: defaultPassword,
          name: displayName,
          role: 'EMPLOYEE',
          enrollId: displayEnrollId,
          dept: enrollment.user.dept
        }
      });

      // 3. Re-assign DeviceEnrollment to new user
      await tx.deviceEnrollment.update({
        where: { id: enrollment.id },
        data: { userId: user.id }
      });

      // 4. Re-assign matching AttendanceLogs to new user
      await tx.attendanceLog.updateMany({
        where: {
          deviceId: deviceId,
          enrollId: enrollId,
          userId: enrollment.userId
        },
        data: {
          userId: user.id,
          name: displayName,
          dept: enrollment.user.dept
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: `Successfully unclubbed enrollment ${enrollId} (${deviceId === '1' ? '3F' : '2F'}) to separate user profile.`
    });

  } catch (error: any) {
    console.error('Unclub error:', error);
    return NextResponse.json({ error: error.message || 'Unclub failed' }, { status: 500 });
  }
}
