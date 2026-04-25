import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import EmployeeDashboardClient from '@/components/EmployeeDashboardClient';

function calculateHours(timeStr1: string, timeStr2: string) {
  const [h1, m1] = timeStr1.split(':').map(Number);
  const [h2, m2] = timeStr2.split(':').map(Number);
  const min1 = h1 * 60 + m1;
  const min2 = h2 * 60 + m2;
  return Math.abs(min2 - min1) / 60;
}

export default async function EmployeeDashboard() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return null;

  const logs = await prisma.attendanceLog.findMany({ 
    where: { enrollId: user.enrollId || 'n/a' },
    orderBy: [{ date: 'desc' }, { time: 'asc' }]
  });

  const wfhLogs = await prisma.wFHLog.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' }
  });

  const daysMap = new Map<string, { in: string, out: string, hours: number }>();
  logs.forEach(log => {
     if (!daysMap.has(log.date)) {
       daysMap.set(log.date, { in: log.time, out: log.time, hours: 0 });
     } else {
       const day = daysMap.get(log.date)!;
       if (log.time < day.in) day.in = log.time;
       if (log.time > day.out) day.out = log.time;
       day.hours = calculateHours(day.in, day.out);
     }
  });

  wfhLogs.forEach(wfh => {
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
  const leaveBalances = await prisma.leaveBalance.findMany({ where: { userId: user.id } });

  return (
    <div className="grid">
      <EmployeeDashboardClient allDays={allDays} user={user} holidays={holidays.map(h => h.date)} leaveBalances={leaveBalances} />
    </div>
  );
}
