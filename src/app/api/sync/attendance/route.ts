import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  // 1. Authenticate using API Key
  const apiKey = req.headers.get('x-api-key');
  const configuredApiKey = process.env.SYNC_API_KEY;

  if (!configuredApiKey) {
    console.error('SYNC_API_KEY is not configured in environment variables.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (!apiKey || apiKey !== configuredApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { logs } = body;

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json({ error: 'Invalid payload: expected "logs" array' }, { status: 400 });
    }

    // 2. Validate and map input logs
    const mappedLogs: any[] = [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

    for (const log of logs) {
      const enrollId = log.enrollId?.toString().trim();
      const date = log.date?.toString().trim();
      const time = log.time?.toString().trim();

      if (!enrollId || !date || !time) continue; // Skip invalid records
      if (!dateRegex.test(date) || !timeRegex.test(time)) continue; // Skip incorrect formats

      mappedLogs.push({
        dept: log.dept?.toString() || null,
        scannerUserId: log.scannerUserId?.toString() || enrollId,
        name: log.name?.toString() || `User ${enrollId}`,
        enrollId: enrollId,
        deviceId: log.deviceId?.toString() || '1',
        place: log.place?.toString() || 'Entrance Door',
        date: date,
        time: time,
        attType: log.attType?.toString() || 'Normal Open',
        verifyMoc: log.verifyMoc?.toString() || 'Fingerprint',
        remark: log.remark?.toString() || 'Success',
      });
    }

    if (mappedLogs.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No valid logs to import' });
    }

    // 3. Extract unique employees to auto-provision if they don't exist
    const uniqueEmployees = new Map();
    mappedLogs.forEach((log) => {
      if (!uniqueEmployees.has(log.enrollId)) {
        uniqueEmployees.set(log.enrollId, {
          enrollId: log.enrollId,
          name: log.name,
          username: log.scannerUserId || `user_${log.enrollId}`,
          dept: log.dept
        });
      }
    });

    const defaultPassword = await bcrypt.hash('password123', 10);

    for (const emp of uniqueEmployees.values()) {
      const existing = await prisma.user.findUnique({ where: { enrollId: emp.enrollId } });
      if (!existing) {
        let finalUsername = emp.username;
        // Resolve username conflicts
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

    // 4. Fetch existing database entries to filter duplicates
    const dates = Array.from(new Set(mappedLogs.map((l) => l.date)));
    const enrollIds = Array.from(new Set(mappedLogs.map((l) => l.enrollId)));

    const existingLogs = await prisma.attendanceLog.findMany({
      where: {
        date: { in: dates },
        enrollId: { in: enrollIds }
      },
      select: {
        enrollId: true,
        date: true,
        time: true
      }
    });

    const existingKeys = new Set(
      existingLogs.map((l) => `${l.enrollId}_${l.date}_${l.time}`)
    );

    // Filter out duplicates that exist in the database or are duplicated within the request itself
    const uniqueLogsMap = new Map();
    mappedLogs.forEach((l) => {
      const key = `${l.enrollId}_${l.date}_${l.time}`;
      if (!existingKeys.has(key) && !uniqueLogsMap.has(key)) {
        uniqueLogsMap.set(key, l);
      }
    });

    const finalLogsToInsert = Array.from(uniqueLogsMap.values());

    if (finalLogsToInsert.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'All logs are already synchronized' });
    }

    // 5. Insert new records
    const inserted = await prisma.attendanceLog.createMany({
      data: finalLogsToInsert
    });

    return NextResponse.json({ success: true, count: inserted.count });
  } catch (error) {
    console.error('Biometric logs sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
