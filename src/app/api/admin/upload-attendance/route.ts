import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data } = await req.json();
    
    const mappedLogs = data.map((row: any) => {
      const getVal = (keyBase: string) => {
        const foundKey = Object.keys(row).find(k => k.trim() === keyBase);
        return foundKey ? row[foundKey] : null;
      };
      
      const enrollStr = getVal('Enroll ID')?.toString() || getVal('EnrollID')?.toString();

      let parsedDate = getVal('Date')?.toString();
      // Handle Excel date serial number format if xlsx parsing produced raw numbers
      if (typeof row['Date'] === 'number') {
         const date = new Date(Math.round((row['Date'] - 25569) * 86400 * 1000));
         parsedDate = date.toISOString().split('T')[0];
      } else if (parsedDate && parsedDate.includes('/')) {
         // handle MM/DD/YYYY or DD/MM/YYYY
         const parts = parsedDate.split('/');
         if (parts[2].length === 4) {
           parsedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
         }
      }

      // Handle Excel time serial if needed
      let parsedTime = getVal('Time')?.toString();
      if (typeof row['Time'] === 'number') {
         const totalMinutes = Math.floor(row['Time'] * 24 * 60);
         const hrs = Math.floor(totalMinutes / 60);
         const mins = totalMinutes % 60;
         parsedTime = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      }

      return {
        dept: getVal('Dept')?.toString(),
        scannerUserId: getVal('User ID')?.toString() || getVal('UserID')?.toString(),
        name: getVal('Name')?.toString(),
        enrollId: enrollStr,
        deviceId: getVal('Device ID')?.toString() || getVal('DeviceID')?.toString(),
        place: getVal('Place')?.toString(),
        date: parsedDate,
        time: parsedTime,
        attType: getVal('Att Type')?.toString() || getVal('AttType')?.toString(),
        verifyMoc: getVal('Verify Moc')?.toString() || getVal('VerifyMoc')?.toString(),
        remark: getVal('Verify Moc Remark')?.toString() || getVal('Remark')?.toString(),
      };
    }).filter((log: any) => log.enrollId && log.date && log.time);

    if (mappedLogs.length === 0) return NextResponse.json({ error: 'No valid rows found' }, { status: 400 });

    // Extract unique employees
    const uniqueEmployees = new Map();
    mappedLogs.forEach((log: any) => {
      if (!uniqueEmployees.has(log.enrollId)) {
        uniqueEmployees.set(log.enrollId, {
          enrollId: log.enrollId,
          name: log.name || `User ${log.enrollId}`,
          username: log.scannerUserId || `user_${log.enrollId}`,
          dept: log.dept || null
        });
      }
    });

    const defaultPassword = await bcrypt.hash('password123', 10);

    for (const emp of uniqueEmployees.values()) {
      const existing = await prisma.user.findFirst({ where: { enrollId: emp.enrollId } });
      if (!existing) {
         let finalUsername = emp.username;
         // Handle username collision
         const existingUsername = await prisma.user.findUnique({ where: { username: finalUsername } });
         if (existingUsername) {
            finalUsername = `${emp.username}_${emp.enrollId}`;
         }
         
         await prisma.user.create({
           data: {
             username: finalUsername,
             password: defaultPassword,
             name: emp.name,
             enrollId: emp.enrollId,
             dept: emp.dept,
             role: 'EMPLOYEE'
           }
         });
      }
    }

    const inserted = await prisma.attendanceLog.createMany({
      data: mappedLogs,
    });

    return NextResponse.json({ success: true, count: inserted.count });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
