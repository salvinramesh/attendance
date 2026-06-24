import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const employees = [
  { id: 314, name: "Joe kuncharia" },
  { id: 101, name: "Rajeesh maninchery" },
  { id: 102, name: "Nithin U" },
  { id: 103, name: "Shahid K I" },
  { id: 104, name: "Shilpa Santhosh T" },
  { id: 111, name: "Sanurag" },
  { id: 115, name: "Aswini sankar" },
  { id: 116, name: "Sisira K" },
  { id: 118, name: "Sanath Mannadath" },
  { id: 119, name: "Pradeep Kumar K" },
  { id: 120, name: "Shibina Rosely c" },
  { id: 125, name: "Sarath M joy" },
  { id: 128, name: "Arjun pokkattu" },
  { id: 130, name: "Vineeth T T" },
  { id: 139, name: "Sravya Gangadharan" },
  { id: 140, name: "Shilpa K U" },
  { id: 143, name: "Sudheesh Acheerithodi" },
  { id: 149, name: "Nithin Peechangoli" },
  { id: 153, name: "PRINSHA PRAKASH" },
  { id: 155, name: "ANJITHA V" },
  { id: 156, name: "SANOOP V" },
  { id: 160, name: "Prashobh P" },
  { id: 161, name: "Mredula P K" },
  { id: 164, name: "SRUTHI MOL   V" },
  { id: 171, name: "Binoy Mohan" },
  { id: 176, name: "Ann Dona James" },
  { id: 179, name: "NIDHEESH KUMAR T K" },
  { id: 181, name: "Neethul R" },
  { id: 191, name: "Neeraj Jayaprakash" },
  { id: 195, name: "Hemanth Kumar A.P" },
  { id: 198, name: "Jithin M" },
  { id: 200, name: "SACHIN VM" },
  { id: 201, name: "SALVIN RAMESH" },
  { id: 203, name: "Albin Geo" },
  { id: 204, name: "Suneeth Sudhakar" },
  { id: 208, name: "Kiran C" },
  { id: 214, name: "Chandana Banerjee." },
  { id: 216, name: "MANEESHA T" },
  { id: 217, name: "ARJUN M" },
  { id: 218, name: "ARJUN N" },
  { id: 219, name: "DILNAVAS C.P" },
  { id: 221, name: "Paulson mathew" },
  { id: 224, name: "Shahana Shirin A" },
  { id: 227, name: "ATHIRA K.T" },
  { id: 231, name: "Prasanth V P" },
  { id: 232, name: "Jibin E U" },
  { id: 237, name: "VINEETH M V" },
  { id: 246, name: "Indu Venugopal" },
  { id: 248, name: "Akhilraj K" },
  { id: 249, name: "Amaya Raju" },
  { id: 252, name: "Sarun Nellooli" },
  { id: 255, name: "Ayana" },
  { id: 258, name: "Bony Tom" },
  { id: 261, name: "Anitha A" },
  { id: 266, name: "Anuj John" },
  { id: 267, name: "Nidhinlal c v" },
  { id: 270, name: "Hari D" },
  { id: 271, name: "Rahul K P" },
  { id: 272, name: "Ananthu N A" },
  { id: 273, name: "Devadarsan Maliyekkal" },
  { id: 274, name: "Anju N R" },
  { id: 275, name: "Jinto Jose" },
  { id: 276, name: "Ranjith P" },
  { id: 278, name: "Gourishankar" },
  { id: 281, name: "Arjun A V Dharran" },
  { id: 282, name: "Nidhindas" },
  { id: 287, name: "Liya KV" },
  { id: 288, name: "Haritha C M" },
  { id: 290, name: "Vishnu Ashok" },
  { id: 291, name: "Arundhathi B" },
  { id: 292, name: "Anagha T" },
  { id: 293, name: "Arun shaji k" },
  { id: 294, name: "THAHA SHAJU MON" },
  { id: 296, name: "Adeeshma Murali K P" },
  { id: 297, name: "ABHINAV KRISHNA M S" },
  { id: 300, name: "Sachu N" },
  { id: 301, name: "Sidharth Sengupta" },
  { id: 302, name: "Shamil Roshan T" },
  { id: 303, name: "Maneesh A" },
  { id: 304, name: "Sandra Jayadeep" },
  { id: 305, name: "Harikrishnan" },
  { id: 306, name: "Aishwarya Mohod" },
  { id: 308, name: "Karthik Vadakkoott" },
  { id: 310, name: "T.K. Arathi Tanya" },
  { id: 311, name: "Vamika TP" },
  { id: 318, name: "Sooryadev MS" },
  { id: 319, name: "Sarga Jugal" },
  { id: 321, name: "Rethulya R" },
  { id: 322, name: "Vishnu R" },
  { id: 323, name: "Dhyan V" },
  { id: 324, name: "Amit Bind" },
  { id: 325, name: "Visakh P K" },
  { id: 326, name: "Amaljith P" },
  { id: 327, name: "Andriya Mariya Desilva" },
  { id: 328, name: "Aiswarya Baburaj" },
  { id: 329, name: "Arjith SasiDharan" },
  { id: 330, name: "Lindo paul" },
  { id: 331, name: "Albin Mathew" },
  { id: 338, name: "ANJALI. M. V" },
  { id: 339, name: "Sreeshma .K" },
  { id: 340, name: "Archana Valsan" },
  { id: 341, name: "Akhil B Krishna" },
  { id: 342, name: "George Kanatt" },
  { id: 343, name: "Siddharth Karun" },
  { id: 345, name: "Krishnendhu P R" },
  { id: 346, name: "Arun Sivapalan" },
  { id: 347, name: "Vismaya Shaju T" },
  { id: 348, name: "Vishnu Gopinath" },
  { id: 349, name: "Aleena Anna Robin" },
  { id: 354, name: "M Adhith Krishna" },
  { id: 359, name: "Shiju T Parambil" },
  { id: 360, name: "Sanith Ammikannadi" },
  { id: 361, name: "Anand Nandakumar" }
];

async function main() {
  const defaultPassword = await bcrypt.hash('password123', 10);
  console.log(`Starting to seed ${employees.length} employees...`);

  for (const emp of employees) {
    const targetUsername = String(emp.id);

    // 1. Resolve conflicting usernames (where username matches target but ID is different)
    const conflict = await prisma.user.findFirst({
      where: {
        username: targetUsername,
        id: { not: emp.id }
      }
    });

    if (conflict) {
      const newUsername = `legacy_${conflict.username}_${conflict.id}`;
      console.log(`Resolving conflict: Renaming user ID ${conflict.id} username from "${conflict.username}" to "${newUsername}"`);
      await prisma.user.update({
        where: { id: conflict.id },
        data: { username: newUsername }
      });
    }

    // 2. Upsert employee
    const user = await prisma.user.upsert({
      where: { id: emp.id },
      update: {
        name: emp.name
      },
      create: {
        id: emp.id,
        username: targetUsername,
        password: defaultPassword,
        name: emp.name,
        role: 'EMPLOYEE'
      }
    });
    console.log(`Upserted user ID ${user.id}: ${user.name}`);
  }

  // 3. Reset Postgres auto-increment sequence
  console.log('Resetting serial sequence for User table...');
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), coalesce(max(id), 0) + 1, false) FROM "User"`);
  
  console.log('Seeding completed successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
