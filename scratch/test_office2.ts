import ZKLib from 'zklib-ts';

async function run() {
  console.log('Connecting to Office 2 at 103.66.78.43:5550...');
  const zk = new ZKLib('103.66.78.43', 5550, 15000, 4000);
  try {
    await zk.createSocket();
    console.log('Socket created successfully!');
    
    console.log('Fetching device info...');
    const info = await zk.getInfo();
    console.log('Device Info:', info);

    console.log('Fetching users...');
    const users = await zk.getUsers();
    console.log(`Found ${users.data.length} users.`);

    await zk.disconnect();
  } catch (error: any) {
    console.error('Error:', error.message || error);
    if (error.err) {
      console.error('Inner Error:', error.err.message || error.err);
    }
  }
}

run();
