const ZKLib = require('./node-zklib');

const API_URL = "https://timetracker.actionfi.com/api/sync/attendance";
const API_KEY = "07ee1ea2ba4c66893948c2a68fb3086f5411e10fe528a2bd";

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

async function fetchFromScanner(ip, port, placeName, deviceId) {
  console.log(`[${new Date().toISOString()}] Connecting to scanner at ${ip}:${port} (${placeName})...`);
  const zk = new ZKLib(ip, port, 15000, 4000);
  
  try {
    await zk.createSocket();
    console.log(`Connected to ${placeName} successfully!`);
    
    // Fetch users mapping
    const usersResponse = await zk.getUsers();
    const userMap = new Map();
    if (usersResponse && usersResponse.data) {
      usersResponse.data.forEach((user) => {
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
    const mappedLogs = rawLogs.map((log) => {
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
    }).filter((log) => log.enrollId && log.date && log.time);
    
    await zk.disconnect();
    return mappedLogs;
  } catch (error) {
    console.error(`Error syncing from ${placeName}:`, error.message || error);
    try {
      await zk.disconnect();
    } catch (e) {}
    return [];
  }
}

async function uploadLogs(logs) {
  if (logs.length === 0) {
    console.log('No logs to upload.');
    return;
  }
  
  // Only upload logs from today and yesterday
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  const targetDates = [formatDate(yesterday), formatDate(today)];
  const filteredLogs = logs.filter(log => targetDates.includes(log.date));
  console.log(`Filtered logs to upload (only ${targetDates.join(' and ')}): ${filteredLogs.length} logs (out of ${logs.length} total)`);
  
  if (filteredLogs.length === 0) {
    console.log('No recent logs to upload.');
    return;
  }
  
  const batchSize = 200;
  for (let i = 0; i < filteredLogs.length; i += batchSize) {
    const batch = filteredLogs.slice(i, i + batchSize);
    console.log(`Uploading batch (${i + 1} to ${Math.min(i + batchSize, filteredLogs.length)}) to Web Server...`);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({ logs: batch })
      });
      
      const resData = await response.json();
      if (resData.success) {
        console.log(`Batch upload successful! Count of inserted/updated records: ${resData.count}`);
      } else {
        console.error(`Server returned error: ${resData.error || JSON.stringify(resData)}`);
      }
    } catch (err) {
      console.error('Network error uploading logs:', err.message || err);
    }
  }
}

async function main() {
  console.log('===========================================================');
  console.log(`[${new Date().toISOString()}] Starting Direct Biometric Scanner Sync...`);
  
  const office1Logs = await fetchFromScanner('192.168.5.61', 5500, 'Office 1 Entrance', '1');
  const office2Logs = await fetchFromScanner('192.168.5.74', 5550, 'Office 2 Entrance', '2');
  
  const allLogs = [...office1Logs, ...office2Logs];
  console.log(`Retrieved ${allLogs.length} total logs from scanners.`);
  
  await uploadLogs(allLogs);
  console.log(`[${new Date().toISOString()}] Sync process complete.`);
  console.log('===========================================================');
}

main();
