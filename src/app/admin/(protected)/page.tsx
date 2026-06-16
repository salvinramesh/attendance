import { prisma } from '@/lib/prisma';
import AdminDashboardClient from '@/components/AdminDashboardClient';

export default async function AdminDashboard() {
  const employees = await prisma.user.findMany({ 
    where: { role: 'EMPLOYEE' },
    orderBy: { createdAt: 'desc' }
  });
  
  const holidays = await prisma.holiday.findMany({
    orderBy: { date: 'desc' }
  });

  const attendanceLogs = await prisma.attendanceLog.findMany({
    orderBy: { date: 'desc' }
  });

  const wfhLogs = await prisma.wFHLog.findMany({
    orderBy: { date: 'desc' },
    include: {
      user: {
        select: {
          name: true,
          username: true
        }
      }
    }
  });

  const leaveRecords = await prisma.leaveRecord.findMany({
    orderBy: { date: 'desc' },
    include: {
      user: {
        select: {
          name: true,
          username: true
        }
      }
    }
  });

  return (
    <div style={{ padding: '2rem 0' }}>
      <AdminDashboardClient 
        initialEmployees={employees} 
        initialHolidays={holidays} 
        attendanceLogs={attendanceLogs}
        wfhLogs={wfhLogs}
        leaveRecords={leaveRecords}
      />
    </div>
  );
}
