import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

async function findUserForEnrollment(deviceId: string, rawEnrollId: string) {
  const suffix = deviceId === '1' ? '(3F)' : '(2F)';

  // 1. Check if there is an existing DeviceEnrollment mapping for this device and enrollId
  const existingMapping = await prisma.deviceEnrollment.findUnique({
    where: {
      deviceId_enrollId: {
        deviceId,
        enrollId: rawEnrollId
      }
    },
    include: { user: true }
  });

  if (existingMapping?.user) {
    // Update the lastSyncedAt timestamp on the enrollment
    await prisma.deviceEnrollment.update({
      where: { id: existingMapping.id },
      data: {
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date()
      }
    });

    return existingMapping.user;
  }

  // 2. Check if a User exists with enrollId matching "${rawEnrollId} (3F)" or "${rawEnrollId} (2F)" or exact rawEnrollId
  const possibleUsers = await prisma.user.findMany({
    where: {
      OR: [
        { enrollId: `${rawEnrollId} ${suffix}` },
        { enrollId: rawEnrollId }
      ]
    }
  });

  if (possibleUsers.length > 0) {
    const user = possibleUsers[0];
    
    // Create the DeviceEnrollment for them
    await prisma.deviceEnrollment.upsert({
      where: {
        deviceId_enrollId: {
          deviceId,
          enrollId: rawEnrollId
        }
      },
      create: {
        deviceId,
        enrollId: rawEnrollId,
        userId: user.id,
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date()
      },
      update: {
        userId: user.id,
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date()
      }
    });

    return user;
  }

  // 3. No matching user found — do NOT auto-create. Return null for unknown scans.
  return null;
}

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
    // Record heartbeat
    try {
      fs.writeFileSync('/var/www/attendance/scratch/last_biometrics_sync_heartbeat.txt', new Date().toISOString(), 'utf-8');
    } catch (err) {
      console.error('Failed to write heartbeat file:', err);
    }

    const body = await req.json();
    const { logs } = body;

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json({ error: 'Invalid payload: expected "logs" array' }, { status: 400 });
    }

    // 2. Validate and map input logs
    const mappedLogs: {
      dept: string | null;
      scannerUserId: string;
      name: string;
      enrollId: string;
      deviceId: string;
      place: string;
      date: string;
      time: string;
      attType: string;
      verifyMoc: string;
      remark: string;
    }[] = [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

    for (const log of logs) {
      const enrollId = log.enrollId?.toString().trim();
      const date = log.date?.toString().trim();
      const time = log.time?.toString().trim();

      if (!enrollId || !date || !time) continue;
      if (!dateRegex.test(date) || !timeRegex.test(time)) continue;

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

    // 3. Process each log — find matching user or mark as unknown
    const finalLogsToInsert: any[] = [];
    for (const log of mappedLogs) {
      const userObj = await findUserForEnrollment(log.deviceId, log.enrollId);
      
      if (userObj) {
        finalLogsToInsert.push({
          ...log,
          name: userObj.name,
          dept: userObj.dept,
          userId: userObj.id
        });
      } else {
        // Unknown scan — store without userId
        finalLogsToInsert.push({
          ...log,
          userId: null
        });
      }
    }

    // 4. Fetch existing database entries to filter duplicates
    const dates = Array.from(new Set(finalLogsToInsert.map((l) => l.date)));
    const knownUserIds = Array.from(new Set(finalLogsToInsert.filter((l) => l.userId != null).map((l) => l.userId)));
    const unknownEnrollIds = Array.from(new Set(finalLogsToInsert.filter((l) => l.userId == null).map((l) => l.enrollId)));

    // Fetch existing logs for known users
    const existingKnownLogs = knownUserIds.length > 0 ? await prisma.attendanceLog.findMany({
      where: {
        date: { in: dates },
        userId: { in: knownUserIds },
      },
      select: { userId: true, deviceId: true, date: true, time: true },
    }) : [];

    // Fetch existing logs for unknown scans (userId is null, match by enrollId)
    const existingUnknownLogs = unknownEnrollIds.length > 0 ? await prisma.attendanceLog.findMany({
      where: {
        date: { in: dates },
        userId: null,
        enrollId: { in: unknownEnrollIds },
      },
      select: { enrollId: true, deviceId: true, date: true, time: true },
    }) : [];

    const existingKeys = new Set([
      ...existingKnownLogs.map((l) => `${l.deviceId ?? ''}__${l.userId}__${l.date}__${l.time}`),
      ...existingUnknownLogs.map((l) => `${l.deviceId ?? ''}__null__${l.enrollId}__${l.date}__${l.time}`)
    ]);

    const uniqueLogsMap = new Map<string, typeof finalLogsToInsert[0]>();
    finalLogsToInsert.forEach((l) => {
      const key = l.userId != null
        ? `${l.deviceId}__${l.userId}__${l.date}__${l.time}`
        : `${l.deviceId}__null__${l.enrollId}__${l.date}__${l.time}`;
      if (!existingKeys.has(key) && !uniqueLogsMap.has(key)) {
        uniqueLogsMap.set(key, l);
      }
    });

    const logsToInsert = Array.from(uniqueLogsMap.values());

    if (logsToInsert.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'All logs are already synchronized' });
    }

    // 5. Insert new records
    const inserted = await prisma.attendanceLog.createMany({
      data: logsToInsert,
    });

    return NextResponse.json({ success: true, count: inserted.count });
  } catch (error) {
    console.error('Biometric logs sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
