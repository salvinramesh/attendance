import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/auth';

// POST /api/admin/employees/onboard
// Creates a new employee from an unknown FP scan, sets up DeviceEnrollment, and reassigns orphan logs.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const { employeeId, name, dept, enrollId, deviceId } = data;

    // Validate required fields
    if (!employeeId || typeof employeeId !== 'string' || employeeId.trim().length === 0) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Employee Name is required' }, { status: 400 });
    }
    if (!enrollId || typeof enrollId !== 'string') {
      return NextResponse.json({ error: 'Enroll ID is required' }, { status: 400 });
    }
    if (!deviceId || typeof deviceId !== 'string') {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const trimmedUsername = employeeId.trim();
    const trimmedName = name.trim();
    const trimmedDept = dept ? String(dept).trim() : null;
    const trimmedEnrollId = enrollId.trim();

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername }
    });
    if (existingUser) {
      return NextResponse.json({ error: `Employee ID "${trimmedUsername}" already exists.` }, { status: 409 });
    }

    // Create the user with a default password
    const hashedPassword = await bcrypt.hash('password123', 10);
    const newUser = await prisma.user.create({
      data: {
        username: trimmedUsername,
        password: hashedPassword,
        name: trimmedName,
        dept: trimmedDept,
        enrollId: trimmedEnrollId,
        role: 'EMPLOYEE'
      }
    });

    // Create DeviceEnrollment linking user to the device
    await prisma.deviceEnrollment.upsert({
      where: {
        deviceId_enrollId: {
          deviceId: deviceId,
          enrollId: trimmedEnrollId
        }
      },
      create: {
        deviceId: deviceId,
        enrollId: trimmedEnrollId,
        userId: newUser.id,
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date()
      },
      update: {
        userId: newUser.id,
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date()
      }
    });

    // Reassign all orphan attendance logs for this enrollId + deviceId to the new user
    const updated = await prisma.attendanceLog.updateMany({
      where: {
        enrollId: trimmedEnrollId,
        deviceId: deviceId,
        userId: null
      },
      data: {
        userId: newUser.id,
        name: trimmedName,
        dept: trimmedDept
      }
    });

    const { password: _, ...userWithoutPassword } = newUser;
    return NextResponse.json({
      success: true,
      employee: userWithoutPassword,
      logsReassigned: updated.count
    });

  } catch (error) {
    console.error('Onboard employee error:', error);
    return NextResponse.json({ error: 'Failed to onboard employee' }, { status: 500 });
  }
}
