import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const MANUAL_ADDITIONS = [
  { empId: 149, enrollId: "43" },  // Nithin Peechangoli -> Nithin P
  { empId: 203, enrollId: "53" },  // Albin Geo -> Albin
  { empId: 281, enrollId: "187" }, // Arjun A V Dharran -> Arjun Dharan
  { empId: 310, enrollId: "614" }, // T.K. Arathi Tanya -> Tanya
  { empId: 293, enrollId: "181" }, // Arun shaji k -> Arun
  { empId: 231, enrollId: "89" },  // Prasanth V P -> Prashanth
  { empId: 326, enrollId: "56" },  // Amaljith P -> Amal
  { empId: 291, enrollId: "506" }, // Arundhathi B -> Arunthathi
  { empId: 331, enrollId: "121" }, // Albin Mathew -> Albin M
  { empId: 143, enrollId: "59" },  // Sudheesh Acheerithodi -> Sudheesh
  { empId: 308, enrollId: "617" }, // Karthik Vadakkoott -> 617
];

async function main() {
  console.log('Seeding Office 1 enrollment mappings...');

  // Read matches from find_names_from_logs
  const matchesPath = path.join(__dirname, 'office1_matches.json');
  const fileContent = fs.readFileSync(matchesPath, 'utf-8');
  const matches = JSON.parse(fileContent);

  // Clear existing mappings for Office 1 (3rd floor)
  await prisma.deviceEnrollment.deleteMany({
    where: { deviceId: '1' }
  });

  const insertedKeys = new Set<string>();

  // Helper to insert safely
  const insertMapping = async (empId: number, enrollId: string) => {
    if (empId < 100 || empId > 400) {
      console.log(`Skipping legacy user ID ${empId}`);
      return;
    }
    const key = `${empId}__${enrollId}`;
    if (insertedKeys.has(key)) return;
    insertedKeys.add(key);

    const user = await prisma.user.findUnique({ where: { id: empId } });
    if (!user) {
      console.warn(`User ID ${empId} not found in DB. Skipping.`);
      return;
    }

    // Check if unique constraint `deviceId_enrollId` will be violated
    const conflict = await prisma.deviceEnrollment.findUnique({
      where: { deviceId_enrollId: { deviceId: '1', enrollId: enrollId } }
    });

    if (conflict) {
      console.warn(`Conflict: deviceId '1' with enrollId '${enrollId}' already mapped to user ID ${conflict.userId}. Skipping mapping for user ID ${empId}.`);
      return;
    }

    await prisma.deviceEnrollment.create({
      data: {
        deviceId: '1',
        enrollId: enrollId,
        userId: empId,
        note: 'Seeded from Office 1 (3F) logs'
      }
    });
    console.log(`Mapped User ID ${empId} (${user.name}) -> Office 1 Enroll ID ${enrollId}`);
  };

  // 1. Process matches from logs
  for (const m of matches) {
    // Correct the swapped Shilpas
    if (m.empId === 104) {
      await insertMapping(104, "20"); // Shilpa Santhosh T -> Shilpa T (20)
    } else if (m.empId === 140) {
      await insertMapping(140, "35"); // Shilpa K U -> Shilpa K (35)
    } else {
      await insertMapping(m.empId, m.enrollId);
    }
  }

  // 2. Process manual additions
  for (const add of MANUAL_ADDITIONS) {
    await insertMapping(add.empId, add.enrollId);
  }

  console.log('Seeding Office 1 enrollment mappings completed successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
