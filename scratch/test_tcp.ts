import ZKLib from 'node-zklib';

async function testScanner(port: number, name: string) {
  console.log(`--- Testing ${name} at 127.0.0.1:${port} ---`);
  const zk = new ZKLib('127.0.0.1', port, 10000, 4000);
  try {
    await zk.createSocket();
    console.log(`${name} Socket created successfully!`);
    
    // Fetch users
    const users = await zk.getUsers();
    console.log(`${name} getUsers() success! Found ${users?.data?.length || 0} users.`);
    
    // Fetch logs
    const logs = await zk.getAttendances();
    console.log(`${name} getAttendances() success! Found ${logs?.data?.length || 0} logs.`);
    if (logs && logs.data && logs.data.length > 0) {
      console.log(`${name} sample log:`, logs.data[logs.data.length - 1]);
    }
    
    await zk.disconnect();
  } catch (error: any) {
    console.error(`Error connecting to ${name}:`, error.message || error);
  }
}

async function run() {
  await testScanner(5501, 'Office 1 (192.168.5.61)');
  await testScanner(5551, 'Office 2 (192.168.5.74)');
}

run();
