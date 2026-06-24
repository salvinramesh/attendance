import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, enrollId, date, reason, time } = body;

    if (!date || (!enrollId && type !== 'edit-day-timings')) {
      return NextResponse.json({ error: 'Missing enrollId or date' }, { status: 400 });
    }

    if (type === 'excuse-late') {
      if (!reason || !reason.trim()) {
        return NextResponse.json({ error: 'Missing excuse reason' }, { status: 400 });
      }

      // Find the earliest log for this enrollId on the specified date
      const earliestLog = await prisma.attendanceLog.findFirst({
        where: { enrollId, date },
        orderBy: { time: 'asc' }
      });

      if (!earliestLog) {
        return NextResponse.json({ error: 'No punch logs found for this employee today.' }, { status: 404 });
      }

      // Update the earliest log's remark to persist the excuse
      const updatedLog = await prisma.attendanceLog.update({
        where: { id: earliestLog.id },
        data: { remark: `Excused: ${reason.trim()}` }
      });

      return NextResponse.json({ success: true, log: updatedLog });
    } 
    
    if (type === 'force-checkout') {
      if (!time || !time.trim()) {
        return NextResponse.json({ error: 'Missing checkout time' }, { status: 400 });
      }

      // Retrieve employee information
      const employee = await prisma.user.findFirst({
        where: { enrollId }
      });

      if (!employee) {
        return NextResponse.json({ error: 'Employee not found with target enrollId' }, { status: 404 });
      }

      // Create a manual check-out punch record
      const manualPunch = await prisma.attendanceLog.create({
        data: {
          enrollId,
          name: employee.name,
          dept: employee.dept || null,
          date,
          time: time.trim(),
          place: 'Admin Adjustment',
          remark: 'Manual Check-out',
          attType: 'Check-out'
        }
      });

      return NextResponse.json({ success: true, punch: manualPunch });
    }

    if (type === 'edit-day-timings') {
      const { userId, firstIn, lastOut } = body;

      if (!userId || !date) {
        return NextResponse.json({ error: 'Missing userId or date' }, { status: 400 });
      }

      // Restrict access to exactly the main System Admin console user ('admin')
      if (admin.username !== 'admin') {
        return NextResponse.json({ error: 'Only the main System Admin (admin) is authorized to edit timings.' }, { status: 403 });
      }

      // Retrieve employee
      const employee = await prisma.user.findUnique({
        where: { id: Number(userId) }
      });

      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      // 1. Delete all existing attendance logs for this employee on this date
      await prisma.attendanceLog.deleteMany({
        where: {
          userId: employee.id,
          date: date
        }
      });

      // 2. Create the new manual logs
      const logsToCreate = [];

      if (firstIn && firstIn.trim() && firstIn.trim() !== '-') {
        logsToCreate.push({
          userId: employee.id,
          enrollId: employee.enrollId || null,
          name: employee.name,
          dept: employee.dept || null,
          date,
          time: firstIn.trim(),
          place: 'Admin Adjustment',
          remark: 'Manual adjustment check-in',
          attType: 'Check-in'
        });
      }

      if (lastOut && lastOut.trim() && lastOut.trim() !== '-') {
        logsToCreate.push({
          userId: employee.id,
          enrollId: employee.enrollId || null,
          name: employee.name,
          dept: employee.dept || null,
          date,
          time: lastOut.trim(),
          place: 'Admin Adjustment',
          remark: 'Manual adjustment check-out',
          attType: 'Check-out'
        });
      }

      if (logsToCreate.length > 0) {
        await prisma.attendanceLog.createMany({
          data: logsToCreate
        });
      }

      return NextResponse.json({ success: true, count: logsToCreate.length });
    }

    return NextResponse.json({ error: 'Invalid adjustment type' }, { status: 400 });
  } catch (error: any) {
    console.error('Adjustment API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
