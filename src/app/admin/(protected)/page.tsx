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

  return (
    <div style={{ padding: '2rem 0' }}>
      <AdminDashboardClient initialEmployees={employees} initialHolidays={holidays} />
    </div>
  );
}
