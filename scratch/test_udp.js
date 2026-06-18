const ZKLibUDP = require('./node-zklib/zklibudp');

async function testUDP(ip, port, name) {
  console.log(`--- Testing UDP for ${name} at ${ip}:${port} ---`);
  const zk = new ZKLibUDP(ip, port, 10000, 4000);
  try {
    await zk.createSocket();
    await zk.connect();
    console.log(`UDP Connected successfully to ${name}!`);
    const users = await zk.getUsers();
    console.log(`Users count: ${users?.data?.length || 0}`);
    const logs = await zk.getAttendances();
    console.log(`Logs count: ${logs?.data?.length || 0}`);
    await zk.disconnect();
  } catch (error) {
    console.error(`UDP Error for ${name}:`, error.message || error);
  }
}

async function run() {
  await testUDP('192.168.5.61', 5500, 'Office 1 Scanner (port 5500)');
  await testUDP('192.168.5.61', 4370, 'Office 1 Scanner (port 4370)');
  await testUDP('192.168.5.74', 5550, 'Office 2 Scanner (port 5550)');
  await testUDP('192.168.5.74', 4370, 'Office 2 Scanner (port 4370)');
}

run();
