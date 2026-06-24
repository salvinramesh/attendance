import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import ZKLib from 'zklib-ts';

const SCANNER_IP = '103.66.78.43';
const PORTS = {
  '1': 5500, // Office 1 (3rd Floor)
  '2': 5550  // Office 2 (2nd Floor)
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const devicesStatus = await Promise.all(
      (['1', '2'] as const).map(async (deviceId) => {
        const port = PORTS[deviceId];
        const zk = new ZKLib(SCANNER_IP, port, 5000, 2000); // lower timeouts for quick status ping
        let online = false;
        let deviceUserCount = 0;
        let deviceLogCount = 0;

        const heartbeatPath = '/var/www/attendance/scratch/last_biometrics_sync_heartbeat.txt';
        let isRecentHeartbeat = false;
        try {
          if (fs.existsSync(heartbeatPath)) {
            const content = fs.readFileSync(heartbeatPath, 'utf-8').trim();
            const lastHeartbeatDate = new Date(content);
            const diffMs = Math.abs(Date.now() - lastHeartbeatDate.getTime());
            if (diffMs < 15 * 60 * 1000) {
              isRecentHeartbeat = true;
            }
          }
        } catch (e) {
          console.warn('Could not read heartbeat file:', e);
        }

        // DB queries
        const assignedCount = await prisma.deviceEnrollment.count({
          where: { deviceId }
        });

        if (isRecentHeartbeat) {
          online = true;
          deviceUserCount = assignedCount;
          deviceLogCount = await prisma.attendanceLog.count({
            where: { deviceId }
          });
        } else {
          try {
            await zk.createSocket();
            online = true;
            try {
              const info = await zk.getInfo();
              deviceUserCount = info.userCounts || 0;
              deviceLogCount = info.logCounts || 0;
            } catch (e) {
              console.warn(`Could not get info for device ${deviceId}:`, e);
            }
            await zk.disconnect();
          } catch (error: any) {
            console.log(`Device ${deviceId} is offline:`, error.message || error);
          }
        }

        const lastSyncedEnrollment = await prisma.deviceEnrollment.findFirst({
          where: { deviceId, lastSyncedAt: { not: null } },
          orderBy: { lastSyncedAt: 'desc' },
          select: { lastSyncedAt: true }
        });

        const lastLog = await prisma.attendanceLog.findFirst({
          where: { deviceId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        });

        const lastSyncTime = lastSyncedEnrollment?.lastSyncedAt || lastLog?.createdAt || null;

        return {
          deviceId,
          name: deviceId === '1' ? 'Office 1 (3rd Floor)' : 'Office 2 (2nd Floor)',
          online,
          deviceUserCount,
          deviceLogCount,
          assignedCount,
          lastSyncTime
        };
      })
    );

    return NextResponse.json({ status: devicesStatus });
  } catch (error: any) {
    console.error('Failed to get devices status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
