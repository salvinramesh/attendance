import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import EmployeeDetailClient from '@/components/EmployeeDetailClient';
import { requireAdmin } from '@/lib/auth';

function calculateHours(timeStr1: string, timeStr2: string) {
  const [h1, m1] = timeStr1.split(':').map(Number);
  const [h2, m2] = timeStr2.split(':').map(Number);
  const min1 = h1 * 60 + m1;
  const min2 = h2 * 60 + m2;
  return Math.abs(min2 - min1) / 60;
}

export default async function EmployeeDetail(props: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return null;

  const p = await props.params;
  const userId = parseInt(p.id);
  
  if (isNaN(userId)) {
    return <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>Invalid Employee ID parameter.</div>;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user) return <div className="page-container">Employee not found</div>;

  const invisibleEnrollments = await prisma.deviceEnrollment.findMany({
    where: { userId, isLogVisible: false },
    select: { deviceId: true }
  });
  const invisibleDeviceIds = invisibleEnrollments.map(e => e.deviceId);

  const logs = await prisma.attendanceLog.findMany({ 
    where: { 
      userId,
      deviceId: invisibleDeviceIds.length > 0 ? { notIn: invisibleDeviceIds } : undefined
    },
    orderBy: [{ date: 'desc' }, { time: 'asc' }]
  });

  const wfhLogs = await prisma.wFHLog.findMany({
    where: { userId },
    orderBy: { date: 'desc' }
  });

  const datePunches = new Map<string, string[]>();
  logs.forEach((log: any) => {
    if (!datePunches.has(log.date)) {
      datePunches.set(log.date, []);
    }
    datePunches.get(log.date)!.push(log.time);
  });

  const daysMap = new Map<string, { in: string, out: string, hours: number }>();
  datePunches.forEach((times, date) => {
    const sorted = [...times].sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const hasCheckedOut = sorted.length > 1;
    const hours = hasCheckedOut ? calculateHours(first, last) : 0;
    daysMap.set(date, { in: first, out: hasCheckedOut ? last : '-', hours });
  });

  wfhLogs.forEach((wfh: any) => {
     if (!daysMap.has(wfh.date)) {
        daysMap.set(wfh.date, { in: wfh.startTime || 'WFH IN', out: wfh.endTime || 'WFH OUT', hours: wfh.hours });
     } else {
        const day = daysMap.get(wfh.date)!;
        day.hours += wfh.hours;
        if (wfh.startTime && (day.in === 'WFH IN' || day.in === '-' || wfh.startTime < day.in)) day.in = wfh.startTime;
        if (wfh.endTime && (day.out === 'WFH OUT' || day.out === '-' || wfh.endTime > day.out)) day.out = wfh.endTime;
     }
  });

  const allDays = Array.from(daysMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  const holidays = await prisma.holiday.findMany();
  const leaveBalances = await prisma.leaveBalance.findMany({ where: { userId } });
  const leaveRecords = await prisma.leaveRecord.findMany({ where: { userId } });

  return (
    <div className="grid">
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/admin" className="btn btn-outline">&larr; Back to Dashboard</Link>
      </div>

      <EmployeeDetailClient 
        user={user} 
        allDays={allDays} 
        holidays={holidays.map((h: any) => h.date)} 
        initialLeaveBalances={leaveBalances} 
        initialLeaveRecords={leaveRecords}
        adminUser={{ id: admin.id, username: admin.username, name: admin.name, role: admin.role }}
      />
    </div>
  );
}
