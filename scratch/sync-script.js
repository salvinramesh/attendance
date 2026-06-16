/**
 * Biometric Fingerprint Scanner Synchronization Script
 * 
 * Instructions:
 * 1. Install Node.js (v18+) on the office computer.
 * 2. In a folder, run: npm install node-zklib
 * 3. Save this script as `sync-script.js` in the same folder.
 * 4. Run it using: node sync-script.js
 * 5. Automate it using Windows Task Scheduler to run every 15 or 30 minutes.
 */

const fs = require('fs');
const path = require('path');
const ZKLib = require('node-zklib');

// --- CONFIGURATION ---
const DEVICE_IP = '192.168.5.74';
const DEVICE_PORT = 5550;
const API_URL = 'https://timetracker.actionfi.com/api/sync/attendance';
const API_KEY = '07ee1ea2ba4c66893948c2a68fb3086f5411e10fe528a2bd';
const WATERMARK_FILE = path.join(__dirname, 'last-sync.json');
const CONNECTION_TIMEOUT = 15000; // 15 seconds
// ---------------------

// Helper to format Date object to YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format Date object to HH:MM:SS
function formatTime(date) {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

async function runSync() {
  console.log(`[${new Date().toISOString()}] Starting biometric synchronization...`);
  console.log(`Connecting to scanner at ${DEVICE_IP}:${DEVICE_PORT}...`);

  const zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, CONNECTION_TIMEOUT, 4000);
  let connected = false;

  try {
    // 1. Establish connection to the fingerprint scanner
    await zkInstance.createSocket();
    connected = true;
    console.log('Connected to biometric terminal successfully!');

    // 2. Load sync watermark (last synced timestamp)
    let lastSyncTime = null;
    if (fs.existsSync(WATERMARK_FILE)) {
      try {
        const watermarkData = JSON.parse(fs.readFileSync(WATERMARK_FILE, 'utf8'));
        if (watermarkData.lastSyncTimestamp) {
          lastSyncTime = new Date(watermarkData.lastSyncTimestamp);
          console.log(`Watermark found. Syncing logs created after: ${lastSyncTime.toISOString()}`);
        }
      } catch (e) {
        console.warn('Failed to parse watermark file, will fetch all logs.');
      }
    } else {
      console.log('No watermark file found. Syncing all logs.');
    }

    // 3. Fetch all user accounts on the device to map enrollment IDs to names
    console.log('Fetching user details from scanner...');
    const usersResponse = await zkInstance.getUsers();
    const userMap = new Map();
    if (usersResponse && usersResponse.data) {
      usersResponse.data.forEach(user => {
        if (user.userId) {
          userMap.set(user.userId.toString(), user.name || `Employee ${user.userId}`);
        }
      });
      console.log(`Loaded ${userMap.size} user mappings from device.`);
    } else {
      console.warn('Could not retrieve users list. Using default names.');
    }

    // 4. Fetch all attendance logs
    console.log('Retrieving attendance logs from scanner...');
    const logsResponse = await zkInstance.getAttendances();
    if (!logsResponse || !logsResponse.data) {
      throw new Error('Failed to retrieve logs or empty response from scanner.');
    }

    const rawLogs = logsResponse.data;
    console.log(`Scanner returned ${rawLogs.length} total logs.`);

    // 5. Filter logs based on watermark
    let filteredLogs = rawLogs;
    if (lastSyncTime) {
      filteredLogs = rawLogs.filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime > lastSyncTime;
      });
    }

    console.log(`Filtered down to ${filteredLogs.length} new logs to sync.`);

    if (filteredLogs.length === 0) {
      console.log('All logs are already up to date. Sync complete.');
      return;
    }

    // Sort logs chronologically to update watermark correctly
    filteredLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // 6. Map logs to the API payload format
    const logsPayload = filteredLogs.map(log => {
      const enrollId = log.deviceUserId?.toString();
      const logName = userMap.get(enrollId) || `Employee ${enrollId}`;
      const punchDate = formatDate(log.timestamp);
      const punchTime = formatTime(log.timestamp);

      // attType mapping: ZK statuses usually represent:
      // 0 = Check In, 1 = Check Out, 2 = Break Out, 3 = Break In, etc.
      let attType = 'Normal Open';
      if (log.punch === 0) attType = 'Check In';
      else if (log.punch === 1) attType = 'Check Out';

      // verifyMoc mapping: ZK verification methods:
      // 1 = Fingerprint, 4 = Card, 15 = Face, etc.
      let verifyMoc = 'Fingerprint';
      if (log.status === 4) verifyMoc = 'Card';
      else if (log.status === 15) verifyMoc = 'Face';

      return {
        enrollId: enrollId,
        name: logName,
        date: punchDate,
        time: punchTime,
        attType: attType,
        verifyMoc: verifyMoc,
        deviceId: '1',
        place: 'Entrance Door'
      };
    });

    // 7. Post payload to the web server
    console.log(`Sending ${logsPayload.length} logs to the web server...`);
    
    // We send in batches of 500 to keep request sizes reasonable
    const batchSize = 500;
    for (let i = 0; i < logsPayload.length; i += batchSize) {
      const batch = logsPayload.slice(i, i + batchSize);
      console.log(`Uploading batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(logsPayload.length / batchSize)}...`);
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({ logs: batch })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(`API returned error: ${result.error || response.statusText}`);
      }
      console.log(`Batch upload successful! Count of inserted logs: ${result.count}`);
    }

    // 8. Update watermark file with the latest log's timestamp
    const latestLog = filteredLogs[filteredLogs.length - 1];
    const latestTimestamp = new Date(latestLog.timestamp).toISOString();
    
    fs.writeFileSync(
      WATERMARK_FILE,
      JSON.stringify({ lastSyncTimestamp: latestTimestamp }, null, 2)
    );
    console.log(`Watermark updated to: ${latestTimestamp}`);
    console.log('Sync process completed successfully!');

  } catch (error) {
    console.error('CRITICAL: Sync failed with error:', error.message || error);
  } finally {
    if (connected) {
      try {
        console.log('Disconnecting from terminal socket...');
        await zkInstance.disconnect();
      } catch (e) {
        console.error('Error disconnecting:', e.message || e);
      }
    }
  }
}

// Run the sync process
runSync();
