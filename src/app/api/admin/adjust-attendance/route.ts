import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { type, enrollId, date, reason, time } = body;

    if (!enrollId || !date) {
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
      const employee = await prisma.user.findUnique({
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

    return NextResponse.json({ error: 'Invalid adjustment type' }, { status: 400 });
  } catch (error: any) {
    console.error('Adjustment API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
