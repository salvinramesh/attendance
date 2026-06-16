// @ts-ignore
import ZKLibUDP from 'node-zklib/zklibudp';

const SCANNER_IP = '103.66.78.43';
const SCANNER_PORT = 5550;

async function runDiag() {
  console.log('--- Biometric Device Direct UDP Diagnosis ---');
  console.log(`Connecting via UDP to ${SCANNER_IP}:${SCANNER_PORT}...`);
  
  const zkUdp = new ZKLibUDP(SCANNER_IP, SCANNER_PORT, 15000, 4000);
  
  try {
    await zkUdp.createSocket();
    console.log('UDP Socket created!');
    
    await zkUdp.connect();
    console.log('UDP Connected (handshake success)!');
    
    // Try Get Users
    try {
      console.log('Testing UDP getUsers()...');
      const users = await zkUdp.getUsers();
      console.log(`UDP getUsers() Success! Found ${users?.data?.length || 0} users.`);
      if (users && users.data && users.data.length > 0) {
        console.log('Sample user:', users.data[0]);
      }
    } catch (e: any) {
      console.error('UDP getUsers() Failed:', e.message || e);
    }
    
    // Try Get Attendances
    try {
      console.log('Testing UDP getAttendances()...');
      const logs = await zkUdp.getAttendances();
      console.log(`UDP getAttendances() Success! Found ${logs?.data?.length || 0} logs.`);
      if (logs && logs.data && logs.data.length > 0) {
        console.log('Sample log:', logs.data[0]);
      }
    } catch (e: any) {
      console.error('UDP getAttendances() Failed:', e.message || e);
    }
    
  } catch (error: any) {
    console.error('UDP Setup or Handshake Failed:', error.message || error);
  } finally {
    try {
      console.log('Disconnecting UDP...');
      await zkUdp.disconnect();
    } catch (e) {}
    console.log('UDP Diagnosis complete.');
  }
}

runDiag();
