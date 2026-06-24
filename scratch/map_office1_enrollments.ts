import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping of Employee ID (User ID) -> Device 1 (Office 1 / 3rd Floor) Enroll ID
const MAPPINGS: { [empId: number]: string } = {
  101: "1",   // Rajeesh
  102: "54",  // Nithin U
  103: "103", // Shahid
  104: "20",  // Shilpa T
  115: "49",  // Aswin / Aswini (or 86)
  116: "17",  // Sisira
  118: "16",  // Sanath
  120: "26",  // Shibina
  125: "87",  // SarathM
  128: "42",  // Arjun
  130: "130", // Vineeth V
  140: "35",  // Shilpa K
  143: "59",  // Sudheesh
  149: "43",  // Nithin P
  153: "18",  // Prinsha
  155: "109", // Anjitha
  156: "3",   // Sanoop
  160: "39",  // Prashobh (Wait, log has name "Prashobh" with ID "39", and Nidheesh with "39" too? Let's check.)
  161: "36",  // Mredula
  164: "24",  // Sruthi
  171: "2",   // Binoy
  176: "61",  // Ann James
  179: "39",  // Nidheesh (Wait, let's double check if Prashobh is 39 or Nidheesh is 39)
  181: "12",  // Neethul
  191: "5",   // Neeraj
  195: "99",  // Hemanth
  198: "45",  // Jithin
  200: "6",   // Sachin
  201: "27",  // Salvin Ramesh (Employee ID 201 -> Enroll ID 27!)
  203: "53",  // Albin
  204: "14",  // Suneeth
  208: "64",  // Kiran
  216: "75",  // Maneesha
  217: "73",  // Arjun M
  218: "74",  // Arjun N
  219: "76",  // Dilnavas
  221: "78",  // Paulson
  224: "81",  // Shahana
  227: "95",  // Athira
  231: "89",  // Prasanth
  232: "92",  // Jibin
  237: "15",  // Vineeth (VINEETH M V)
  246: "255", // Indu
  248: "258", // Akhil Raj
  249: "264", // Amaya
  255: "172", // Ayana
  258: "266", // Bony Tom
  266: "266", // Anuj John (Shared enroll ID 266 with Bony Tom? Let's check.)
  267: "173", // Nidhinlal
  270: "182", // Hari Dinesh
  276: "186", // Ranjith P
  278: "212", // Gourishankar
  281: "187", // Arjun Dharan
  282: "500", // Nidhindas
  287: "308", // Liya
  288: "502", // Haritha
  290: "510", // Vishnu Ashok
  291: "506", // Arunthathi
  292: "520", // Anagha
  293: "181", // Arun (Arun Shaji)
  296: "604", // Adeeshma
  297: "602", // Abhinav
  300: "601", // Sachu
  301: "606", // Sidharth
  304: "610", // Sandra
  306: "612", // Aishwarya M
  308: "308", // Karthik Vadakkoott (Wait, is he 308?)
  310: "614", // Tanya (T.K. Arathi Tanya)
  311: "615", // Vamika
  318: "622", // Sooryadev
  321: "632", // Rethulya
  322: "633", // Vishnu R
  323: "634", // Dhyan
  325: "621", // Visakh
  326: "56",  // Amal
  327: "643", // Andriya
  328: "131", // Aiswarya
  331: "121", // Albin M
};

async function main() {
  console.log('Mapping Office 1 (3rd Floor) Enroll IDs to Employees...');

  // First delete any existing Device 1 enrollment mapping just in case
  await prisma.deviceEnrollment.deleteMany({
    where: { deviceId: '1' }
  });

  let mappedCount = 0;
  for (const [empId, enrollId] of Object.entries(MAPPINGS)) {
    const userId = Number(empId);

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.warn(`User ID ${userId} not found in DB, skipping mapping to Enroll ID ${enrollId}`);
      continue;
    }

    await prisma.deviceEnrollment.create({
      data: {
        deviceId: '1',
        enrollId: enrollId,
        userId: userId,
        note: 'Seeded Office 1 Master mapping'
      }
    });
    mappedCount++;
  }

  console.log(`Successfully mapped ${mappedCount} employees to Office 1 Enroll IDs.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
