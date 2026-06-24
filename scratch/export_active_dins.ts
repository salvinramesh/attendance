import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const enrollments = await prisma.deviceEnrollment.findMany({
    where: { deviceId: '2' },
    select: { enrollId: true }
  });

  const activeDins = enrollments.map(e => parseInt(e.enrollId, 10)).filter(id => !isNaN(id));
  
  const outputPath = path.join(__dirname, 'active_device2_dins.json');
  fs.writeFileSync(outputPath, JSON.stringify(activeDins, null, 2), 'utf-8');
  console.log(`Exported ${activeDins.length} active Device 2 DINs to ${outputPath}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
