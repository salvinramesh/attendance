import ZKLib from 'zklib-ts';

async function run() {
  console.log('Connecting to Office 1 at 103.66.78.43:5500...');
  const zk = new ZKLib('103.66.78.43', 5500, 10000, 4000);
  try {
    await zk.createSocket();
    console.log('Socket created successfully!');
    
    console.log('Fetching users...');
    const users = await zk.getUsers();
    console.log(`Found ${users.data.length} users.`);

    console.log('Fetching templates...');
    const templates = await zk.getTemplates();
    console.log(`Found ${templates.data.length} templates.`);
    if (templates.data.length > 0) {
      console.log('Sample template:', JSON.stringify(templates.data[0], null, 2));
    }
    
    await zk.disconnect();
  } catch (error: any) {
    console.error('Error:', error.message || error);
  }
}

run();
