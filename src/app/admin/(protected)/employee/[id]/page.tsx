import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import EmployeeDetailClient from '@/components/EmployeeDetailClient';

function calculateHours(timeStr1: string, timeStr2: string) {
  const [h1, m1] = timeStr1.split(':').map(Number);
  const [h2, m2] = timeStr2.split(':').map(Number);
  const min1 = h1 * 60 + m1;
  const min2 = h2 * 60 + m2;
  return Math.abs(min2 - min1) / 60;
}

export default async function EmployeeDetail(props: { params: Promise<{ id: string }> }) {
  const p = await props.params;
  const userId = parseInt(p.id);
  
  if (isNaN(userId)) {
    return <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>Invalid Employee ID parameter.</div>;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user) return <div className="page-container">Employee not found</div>;

  const logs = await prisma.attendanceLog.findMany({ 
    where: { enrollId: user.enrollId || 'n/a' },
    orderBy: [{ date: 'desc' }, { time: 'asc' }]
  });

  const wfhLogs = await prisma.wFHLog.findMany({
    where: { userId },
    orderBy: { date: 'desc' }
  });

  const daysMap = new Map<string, { in: string, out: string, hours: number }>();
  logs.forEach((log: any) => {
     if (!daysMap.has(log.date)) {
       daysMap.set(log.date, { in: log.time, out: log.time, hours: 0 });
     } else {
       const day = daysMap.get(log.date)!;
       if (log.time < day.in) day.in = log.time;
       if (log.time > day.out) day.out = log.time;
       day.hours = calculateHours(day.in, day.out);
     }
  });

  wfhLogs.forEach((wfh: any) => {
     if (!daysMap.has(wfh.date)) {
        daysMap.set(wfh.date, { in: wfh.startTime || 'WFH IN', out: wfh.endTime || 'WFH OUT', hours: wfh.hours });
     } else {
        const day = daysMap.get(wfh.date)!;
        day.hours += wfh.hours;
        if (wfh.startTime && (day.in === 'WFH IN' || wfh.startTime < day.in)) day.in = wfh.startTime;
        if (wfh.endTime && (day.out === 'WFH OUT' || wfh.endTime > day.out)) day.out = wfh.endTime;
     }
  });

  const allDays = Array.from(daysMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  const holidays = await prisma.holiday.findMany();
  const leaveBalances = await prisma.leaveBalance.findMany({ where: { userId } });

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
      />
    </div>
  );
}
