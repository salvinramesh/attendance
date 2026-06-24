import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Arun Shaji mapping fix...');

  // 1. Ensure user 293 (Arun Shaji) exists in User table
  let arun = await prisma.user.findUnique({ where: { id: 293 } });
  if (!arun) {
    console.log('User 293 not found. Creating User "Arun shaji k"...');
    const defaultPassword = await bcrypt.hash('password123', 10);
    arun = await prisma.user.create({
      data: {
        id: 293,
        username: '293', // Unique username for login
        password: defaultPassword,
        name: 'Arun shaji k',
        role: 'EMPLOYEE',
        enrollId: null, // Left null to avoid collision on unique constraint with Neeraj's '5'
        dept: 'actionfi'
      }
    });
    console.log('Created user:', arun);
  } else {
    console.log('User 293 already exists:', arun);
  }

  // 2. Query existing DeviceEnrollments for enrollId = '5'
  const enrollments = await prisma.deviceEnrollment.findMany({
    where: { enrollId: '5' }
  });
  console.log('Current enrollments for enrollId = 5:', enrollments);

  // 3. Update Device 2 / Enroll ID 5 to point to User 293
  const device2Enrollment = enrollments.find(e => e.deviceId === '2');
  if (device2Enrollment) {
    console.log(`Updating DeviceEnrollment ID ${device2Enrollment.id} (Device 2) to point to userId: 293...`);
    const updated = await prisma.deviceEnrollment.update({
      where: { id: device2Enrollment.id },
      data: { userId: 293, note: 'Reassigned to Arun Shaji (ID 293)' }
    });
    console.log('Updated Device 2 enrollment:', updated);
  } else {
    console.log('No DeviceEnrollment found for Device 2 / Enroll ID 5. Creating it...');
    const created = await prisma.deviceEnrollment.create({
      data: {
        deviceId: '2',
        enrollId: '5',
        userId: 293,
        note: 'Created for Arun Shaji (ID 293)'
      }
    });
    console.log('Created Device 2 enrollment:', created);
  }

  // 4. Ensure Device 1 / Enroll ID 5 points to Neeraj (User 191)
  const device1Enrollment = enrollments.find(e => e.deviceId === '1');
  if (device1Enrollment) {
    if (device1Enrollment.userId !== 191) {
      console.log(`Updating DeviceEnrollment ID ${device1Enrollment.id} (Device 1) to point to Neeraj (userId: 191)...`);
      const updated = await prisma.deviceEnrollment.update({
        where: { id: device1Enrollment.id },
        data: { userId: 191, note: 'Reassigned to Neeraj (ID 191)' }
      });
      console.log('Updated Device 1 enrollment:', updated);
    } else {
      console.log('Device 1 enrollment already correctly points to Neeraj (userId: 191)');
    }
  } else {
    console.log('No DeviceEnrollment found for Device 1 / Enroll ID 5. Creating it for Neeraj...');
    const created = await prisma.deviceEnrollment.create({
      data: {
        deviceId: '1',
        enrollId: '5',
        userId: 191,
        note: 'Created for Neeraj (ID 191)'
      }
    });
    console.log('Created Device 1 enrollment:', created);
  }

  // 5. Verify the updated enrollments
  const finalEnrollments = await prisma.deviceEnrollment.findMany({
    where: { enrollId: '5' }
  });
  console.log('Final DeviceEnrollment mappings for enrollId = 5:', finalEnrollments);
}

main().catch(console.error).finally(() => prisma.$disconnect());
