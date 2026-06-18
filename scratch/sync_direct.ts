import ZKLib from 'node-zklib';

const API_URL = "https://timetracker.actionfi.com/api/sync/attendance";
const API_KEY = "07ee1ea2ba4c66893948c2a68fb3086f5411e10fe528a2bd";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

async function fetchFromScanner(port: number, placeName: string, deviceId: string) {
  console.log(`[${new Date().toISOString()}] Connecting to scanner at 127.0.0.1:${port} (${placeName})...`);
  const zk = new ZKLib('127.0.0.1', port, 15000, 4000);
  
  try {
    await zk.createSocket();
    console.log(`Connected to ${placeName} successfully!`);
    
    // Fetch users mapping
    const usersResponse = await zk.getUsers();
    const userMap = new Map<string, string>();
    if (usersResponse && usersResponse.data) {
      usersResponse.data.forEach((user: any) => {
        if (user.userId) {
          userMap.set(user.userId.toString(), user.name || `Employee ${user.userId}`);
        }
      });
      console.log(`Loaded ${userMap.size} user mappings from ${placeName}.`);
    }
    
    // Fetch attendance logs
    const logsResponse = await zk.getAttendances();
    if (!logsResponse || !logsResponse.data) {
      throw new Error('Failed to retrieve logs or empty response from scanner.');
    }
    
    const rawLogs = logsResponse.data;
    console.log(`Scanner ${placeName} returned ${rawLogs.length} total logs.`);
    
    // Map logs
    const mappedLogs = rawLogs.map((log: any) => {
      const enrollId = log.deviceUserId?.toString().trim();
      const logName = userMap.get(enrollId) || `Employee ${enrollId}`;
      const dateStr = formatDate(log.timestamp);
      const timeStr = formatTime(log.timestamp);
      
      let attType = 'Normal Open';
      if (log.punch === 0) attType = 'Check In';
      else if (log.punch === 1) attType = 'Check Out';
      
      let verifyMoc = 'Fingerprint';
      if (log.status === 4) verifyMoc = 'Card';
      else if (log.status === 15) verifyMoc = 'Face';
      
      return {
        enrollId: enrollId,
        scannerUserId: enrollId,
        name: logName,
        dept: '', 
        date: dateStr,
        time: timeStr,
        attType: attType,
        verifyMoc: verifyMoc,
        deviceId: deviceId,
        place: placeName,
        remark: 'Success'
      };
    }).filter((log: any) => log.enrollId && log.date && log.time);
    
    await zk.disconnect();
    return mappedLogs;
  } catch (error: any) {
    console.error(`Error syncing from ${placeName}:`, error.message || error);
    try {
      await zk.disconnect();
    } catch (e) {}
    return [];
  }
}

async function uploadLogs(logs: any[]) {
  if (logs.length === 0) {
    console.log('No logs to upload.');
    return;
  }
  
  const targetDates = ['2026-06-16', '2026-06-17'];
  const filteredLogs = logs.filter(log => targetDates.includes(log.date));
  console.log(`Filtered logs to upload (only 2026-06-16 and 2026-06-17): ${filteredLogs.length} logs (out of ${logs.length} total)`);
  
  if (filteredLogs.length === 0) {
    console.log('No recent logs to upload.');
    return;
  }
  
  const batchSize = 200;
  for (let i = 0; i < filteredLogs.length; i += batchSize) {
    const batch = filteredLogs.slice(i, i + batchSize);
    console.log(`Uploading batch (${i + 1} to ${Math.min(i + batchSize, filteredLogs.length)}) to Web Server...`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({ logs: batch })
    });
    
    const resData: any = await response.json();
    if (resData.success) {
      console.log(`Batch upload successful! Count of inserted/updated records: ${resData.count}`);
    } else {
      console.error(`Server returned error: ${resData.error || JSON.stringify(resData)}`);
    }
  }
}

async function main() {
  console.log('=== STARTING DIRECT SYNC FROM SCANNERS TO WEB DASHBOARD ===');
  
  const office1Logs = await fetchFromScanner(5501, 'Office 1 Entrance', '1');
  const office2Logs = await fetchFromScanner(5551, 'Office 2 Entrance', '2');
  
  const allLogs = [...office1Logs, ...office2Logs];
  console.log(`Retrieved ${allLogs.length} total logs in total. Proceeding to upload...`);
  
  await uploadLogs(allLogs);
  console.log('=== DIRECT SYNC COMPLETE ===');
}

main();
