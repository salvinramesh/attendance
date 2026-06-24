import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

// POST /api/admin/device-enrollments/auto-populate
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ 
    success: false, 
    error: 'Auto-populate is disabled. Office 1 (3F) is automatically matched by Employee ID. Office 2 (2F) must be manually assigned.' 
  }, { status: 400 });
}
