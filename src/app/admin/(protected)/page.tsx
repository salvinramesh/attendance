import { prisma } from '@/lib/prisma';
import AdminDashboardClient from '@/components/AdminDashboardClient';
import { requireAdmin } from '@/lib/auth';
import { Suspense } from 'react';

export default async function AdminDashboard(props: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return null;

  const resolvedSearchParams = await props.searchParams;
  const initialTab = resolvedSearchParams.tab || 'dashboard';

  const currentUser = {
    id: admin.id,
    username: admin.username,
    name: admin.name,
    email: admin.email,
    role: admin.role
  };

  const employees = await prisma.user.findMany({ 
    where: { role: 'EMPLOYEE' },
    orderBy: { createdAt: 'desc' }
  });
  
  const holidays = await prisma.holiday.findMany({
    orderBy: { date: 'desc' }
  });

  const attendanceLogs = await prisma.attendanceLog.findMany({
    orderBy: [
      { date: 'desc' },
      { time: 'desc' }
    ],
    take: 20000
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

  const deviceEnrollments = await prisma.deviceEnrollment.findMany({
    include: {
      user: {
        select: { id: true, name: true, username: true, enrollId: true, dept: true }
      }
    },
    orderBy: [{ deviceId: 'asc' }, { enrollId: 'asc' }]
  });

  // All employees for the enrollment mapping user-picker
  const allEmployees = await prisma.user.findMany({
    select: { id: true, name: true, username: true, enrollId: true, dept: true },
    orderBy: { name: 'asc' }
  });

  return (
    <div style={{ padding: '2rem 0' }}>
      <Suspense fallback={<div className="page-container" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Dashboard...</div>}>
        <AdminDashboardClient 
          initialEmployees={employees} 
          initialHolidays={holidays} 
          attendanceLogs={attendanceLogs}
          wfhLogs={wfhLogs}
          leaveRecords={leaveRecords}
          initialDeviceEnrollments={deviceEnrollments}
          allEmployees={allEmployees}
          currentUser={currentUser}
          initialTab={initialTab}
        />
      </Suspense>
    </div>
  );
}
