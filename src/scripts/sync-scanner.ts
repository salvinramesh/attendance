import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
// @ts-ignore
import ZKLib from 'node-zklib';


// --- CONFIGURATION ---
const SCANNER_IP = process.env.SCANNER_IP || '103.66.78.43';
const SCANNER_PORT = parseInt(process.env.SCANNER_PORT || '5550', 10);
const CONNECTION_TIMEOUT = 15000; // 15 seconds
// ---------------------

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

async function runSync() {
  console.log(`[${new Date().toISOString()}] Starting direct biometric sync...`);
  console.log(`Connecting to scanner at ${SCANNER_IP}:${SCANNER_PORT}...`);

  const zkInstance = new ZKLib(SCANNER_IP, SCANNER_PORT, CONNECTION_TIMEOUT, 4000);
  let connected = false;

  try {
    // 1. Connect to scanner
    await zkInstance.createSocket();
    connected = true;
    console.log('Connected to biometric scanner successfully!');

    // 2. Fetch users to map enrollment IDs to names
    console.log('Fetching user details from scanner...');
    const usersResponse = await zkInstance.getUsers();
    const userMap = new Map<string, string>();
    if (usersResponse && usersResponse.data) {
      usersResponse.data.forEach((user: any) => {
        if (user.userId) {
          userMap.set(user.userId.toString(), user.name || `Employee ${user.userId}`);
        }
      });
      console.log(`Loaded ${userMap.size} user mappings from device.`);
    } else {
      console.warn('Could not retrieve users list. Using default names.');
    }

    // 3. Fetch all attendance logs
    console.log('Retrieving attendance logs from scanner...');
    const logsResponse = await zkInstance.getAttendances();
    if (!logsResponse || !logsResponse.data) {
      throw new Error('Failed to retrieve logs or empty response from scanner.');
    }

    const rawLogs = logsResponse.data;
    console.log(`Scanner returned ${rawLogs.length} total logs.`);

    if (rawLogs.length === 0) {
      console.log('No logs found on the scanner.');
      return;
    }

    // 4. Map raw logs into application schema format
    const mappedLogs = rawLogs.map((log: any) => {
      const enrollId = log.deviceUserId?.toString().trim();
      const logName = userMap.get(enrollId) || `Employee ${enrollId}`;
      const dateStr = formatDate(log.timestamp);
      const timeStr = formatTime(log.timestamp);

      // attType mapping
      let attType = 'Normal Open';
      if (log.punch === 0) attType = 'Check In';
      else if (log.punch === 1) attType = 'Check Out';

      // verifyMoc mapping
      let verifyMoc = 'Fingerprint';
      if (log.status === 4) verifyMoc = 'Card';
      else if (log.status === 15) verifyMoc = 'Face';

      return {
        dept: null,
        scannerUserId: enrollId,
        name: logName,
        enrollId: enrollId,
        deviceId: '1',
        place: 'Entrance Door',
        date: dateStr,
        time: timeStr,
        attType: attType,
        verifyMoc: verifyMoc,
        remark: 'Success',
      };
    }).filter((log: any) => log.enrollId && log.date && log.time);

    // 5. Filter logs based on valid employees
    const enrollments = await prisma.deviceEnrollment.findMany({
      select: { deviceId: true, enrollId: true, userId: true }
    });
    const dev1Map = new Map<string, number>();
    const dev2Map = new Map<string, number>();
    for (const e of enrollments) {
      if (e.deviceId === '1') {
        dev1Map.set(e.enrollId, e.userId);
      } else if (e.deviceId === '2') {
        dev2Map.set(e.enrollId, e.userId);
      }
    }

    const users = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', id: { lt: 10000 } },
      select: { id: true, name: true, dept: true }
    });
    const dbUserMap = new Map(users.map(u => [u.id, u]));

    const filteredLogs: any[] = [];
    for (const log of mappedLogs) {
      let targetUserId: number | undefined;
      const logDeviceId = log.deviceId || (SCANNER_PORT === 5500 ? '1' : '2');
      log.deviceId = logDeviceId;
      
      if (logDeviceId === '1') {
        targetUserId = dev1Map.get(log.enrollId);
        if (!targetUserId) {
          const empId = Number(log.enrollId);
          if (!isNaN(empId) && dbUserMap.has(empId)) {
            targetUserId = empId;
          }
        }
      } else if (logDeviceId === '2') {
        targetUserId = dev2Map.get(log.enrollId);
      }

      if (targetUserId && dbUserMap.has(targetUserId)) {
        const userObj = dbUserMap.get(targetUserId)!;
        log.name = userObj.name;
        log.dept = userObj.dept;
        log.userId = targetUserId;
        filteredLogs.push(log);
      }
    }

    if (filteredLogs.length === 0) {
      console.log('No valid employee logs found on the scanner.');
      return;
    }

    // 6. Fetch existing logs in the database to prevent duplicate entries
    const dates = Array.from(new Set(filteredLogs.map((l: any) => l.date))) as string[];
    const userIds = Array.from(new Set(filteredLogs.map((l: any) => l.userId))) as number[];

    const existingLogs = await prisma.attendanceLog.findMany({
      where: {
        date: { in: dates },
        userId: { in: userIds }
      },
      select: {
        userId: true,
        deviceId: true,
        date: true,
        time: true
      }
    });

    const existingKeys = new Set(
      existingLogs.map((l: any) => `${l.deviceId ?? ''}_${l.userId}_${l.date}_${l.time}`)
    );

    // Filter out duplicates that already exist in DB or in payload itself
    const uniqueLogsMap = new Map();
    filteredLogs.forEach((l: any) => {
      const key = `${l.deviceId}_${l.userId}_${l.date}_${l.time}`;
      if (!existingKeys.has(key) && !uniqueLogsMap.has(key)) {
        uniqueLogsMap.set(key, l);
      }
    });

    const finalLogsToInsert = Array.from(uniqueLogsMap.values());

    if (finalLogsToInsert.length === 0) {
      console.log('All attendance records from the scanner are already synced to the database.');
    } else {
      console.log(`Inserting ${finalLogsToInsert.length} new attendance records into the database...`);
      const inserted = await prisma.attendanceLog.createMany({
        data: finalLogsToInsert
      });
      console.log(`Successfully synced ${inserted.count} new attendance records!`);
    }

  } catch (error: any) {
    console.error('CRITICAL: Direct sync failed with error:', error.message || error);
  } finally {
    if (connected) {
      try {
        console.log('Disconnecting from terminal socket...');
        await zkInstance.disconnect();
      } catch (e: any) {
        console.error('Error disconnecting:', e.message || e);
      }
    }
    await prisma.$disconnect();
    console.log('Database disconnected. Direct sync complete.');
  }
}

// Run the sync process
runSync();
