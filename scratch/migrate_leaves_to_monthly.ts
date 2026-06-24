import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Starting Leaves Month-wise Migration ===');

  // Fetch all existing leave balances (which currently default to month 0)
  const balances = await prisma.leaveBalance.findMany({
    where: { month: 0 }
  });
  console.log(`Found ${balances.length} existing yearly leave balance records.`);

  for (const balance of balances) {
    const { userId, year } = balance;
    console.log(`\nProcessing balance for User ID: ${userId}, Year: ${year}`);

    // Fetch all leave records for this user in this year
    const records = await prisma.leaveRecord.findMany({
      where: {
        userId,
        date: {
          startsWith: `${year}-`
        }
      }
    });

    if (records.length === 0) {
      console.log(`  -> No detailed LeaveRecord entries found. Keeping yearly total (Planned: ${balance.planned}, Emergency: ${balance.emergency}, LOP: ${balance.lop}, Pending: ${balance.pending}, Total: ${balance.total}) as a fallback at month 0.`);
      continue;
    }

    console.log(`  -> Found ${records.length} leave records. Grouping by month...`);

    // Group records by month (1 to 12)
    const monthlyGroups: Record<number, { planned: number; emergency: number; lop: number; pending: number; total: number }> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyGroups[m] = { planned: 0, emergency: 0, lop: 0, pending: 0, total: 0 };
    }

    for (const rec of records) {
      // Date format is YYYY-MM-DD
      const monthPart = parseInt(rec.date.substring(5, 7));
      if (isNaN(monthPart) || monthPart < 1 || monthPart > 12) {
        console.warn(`    Invalid record date: ${rec.date}. Skipping.`);
        continue;
      }

      const group = monthlyGroups[monthPart];
      if (rec.type === 'PL') group.planned++;
      else if (rec.type === 'EL') group.emergency++;
      else if (rec.type === 'LOP') group.lop++;
      else group.pending++;
      group.total++;
    }

    // Insert or update month-wise balances for months that have records
    for (let m = 1; m <= 12; m++) {
      const g = monthlyGroups[m];
      if (g.total > 0) {
        console.log(`    Creating month-wise balance for Month ${m}: PL=${g.planned}, EL=${g.emergency}, LOP=${g.lop}, Pending=${g.pending}, Total=${g.total}`);
        await prisma.leaveBalance.upsert({
          where: {
            userId_year_month: {
              userId,
              year,
              month: m
            }
          },
          update: {
            planned: g.planned,
            emergency: g.emergency,
            lop: g.lop,
            pending: g.pending,
            total: g.total
          },
          create: {
            userId,
            year,
            month: m,
            planned: g.planned,
            emergency: g.emergency,
            lop: g.lop,
            pending: g.pending,
            total: g.total
          }
        });
      }
    }
  }

  console.log('\n=== Leaves Month-wise Migration Complete ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
