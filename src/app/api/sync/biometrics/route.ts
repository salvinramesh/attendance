import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

// API Key Validation helper
function validateApiKey(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  return apiKey === process.env.SYNC_API_KEY;
}

export async function GET(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Record heartbeat
  try {
    fs.writeFileSync('/var/www/attendance/scratch/last_biometrics_sync_heartbeat.txt', new Date().toISOString(), 'utf-8');
  } catch (err) {
    console.error('Failed to write heartbeat file:', err);
  }

  try {
    // 1. Fetch all pending Office 2 enrollments
    const pendingEnrollments = await prisma.deviceEnrollment.findMany({
      where: {
        deviceId: '2',
        syncStatus: 'PENDING'
      },
      include: {
        user: true
      }
    });

    const jobs = [];

    for (const enrollment of pendingEnrollments) {
      const userId = enrollment.userId;

      // Find user's Office 1 Enroll ID
      const office1Enrollment = await prisma.deviceEnrollment.findFirst({
        where: {
          userId,
          deviceId: '1'
        }
      });
      
      const office1EnrollId = office1Enrollment ? office1Enrollment.enrollId : String(userId);

      // Fetch cached fingerprint templates for the user
      const dbTemplates = await prisma.fingerprintTemplate.findMany({
        where: { userId }
      });

      jobs.push({
        enrollmentId: enrollment.id,
        userId,
        userName: enrollment.user.name,
        office1EnrollId,
        office2EnrollId: enrollment.enrollId,
        fingerprints: dbTemplates.map(t => ({
          fingerId: t.fingerId,
          template: t.template
        }))
      });
    }

    return NextResponse.json({ success: true, jobs });

  } catch (error: any) {
    console.error('Error fetching biometric sync jobs:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'upload-templates') {
      const { userId, templates } = body;
      if (!userId || !Array.isArray(templates)) {
        return NextResponse.json({ error: 'Missing userId or templates array' }, { status: 400 });
      }

      // Upsert templates in DB
      for (const t of templates) {
        await prisma.fingerprintTemplate.upsert({
          where: {
            userId_fingerId: {
              userId: Number(userId),
              fingerId: Number(t.fingerId)
            }
          },
          create: {
            userId: Number(userId),
            fingerId: Number(t.fingerId),
            template: t.template
          },
          update: {
            template: t.template
          }
        });
      }

      return NextResponse.json({ success: true, message: `Successfully cached ${templates.length} templates.` });

    } else if (action === 'update-status') {
      const { enrollmentId, status, error } = body;
      if (!enrollmentId || !status) {
        return NextResponse.json({ error: 'Missing enrollmentId or status' }, { status: 400 });
      }

      if (status === 'SYNCED') {
        await prisma.deviceEnrollment.update({
          where: { id: Number(enrollmentId) },
          data: {
            syncStatus: 'SYNCED',
            syncError: null,
            lastSyncedAt: new Date()
          }
        });
      } else if (status === 'FAILED') {
        let errorMsg = 'Unknown error occurred during sync.';
        if (error) {
          if (Array.isArray(error)) {
            errorMsg = error.join('\n');
          } else if (typeof error === 'object') {
            errorMsg = JSON.stringify(error);
          } else {
            errorMsg = String(error);
          }
        }
        await prisma.deviceEnrollment.update({
          where: { id: Number(enrollmentId) },
          data: {
            syncStatus: 'FAILED',
            syncError: errorMsg.slice(0, 1000)
          }
        });
      } else {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: `Status updated to ${status}.` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Error handling biometric sync action:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
