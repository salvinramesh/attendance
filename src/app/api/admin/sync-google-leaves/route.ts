import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { syncGoogleLeaves } from '@/scripts/monitor-google-leaves';

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncGoogleLeaves();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Google Sheet Leaves manual sync failed:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
