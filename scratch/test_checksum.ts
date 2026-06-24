import fs from 'fs';

function parseTemplate(hexStr: string): number[] {
  const chunks = hexStr.split(' ');
  const bytes: number[] = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    const val = parseInt(chunk, 16);
    const b0 = val & 0xff;
    const b1 = (val >> 8) & 0xff;
    const b2 = (val >> 16) & 0xff;
    const b3 = (val >> 24) & 0xff;
    bytes.push(b0, b1, b2, b3);
  }
  return bytes;
}

function main() {
  const logPath = '/root/.gemini/antigravity-ide/brain/41105572-32a6-47fd-b615-96210a1599cb/.system_generated/tasks/task-11770.log';
  if (!fs.existsSync(logPath)) {
    console.error('Log file not found!');
    return;
  }
  const lines = fs.readFileSync(logPath, 'utf8').split('\n');
  const templates: string[] = [];
  for (const line of lines) {
    if (line.includes('Template:')) {
      const idx = line.indexOf('Template:');
      templates.push(line.substring(idx + 'Template:'.length).trim());
    }
  }

  const bytes12 = parseTemplate(templates[0]);
  const bytes86 = parseTemplate(templates[1]);

  console.log('--- DIN 12 Non-Zero Bytes in Padding (Indices 1016 to 1416) ---');
  for (let i = 1016; i < bytes12.length; i++) {
    if (bytes12[i] !== 0) {
      console.log(`Index ${i}: ${bytes12[i]} (0x${bytes12[i].toString(16).toUpperCase()})`);
    }
  }

  console.log('--- DIN 86 Non-Zero Bytes in Padding (Indices 1016 to 1416) ---');
  for (let i = 1016; i < bytes86.length; i++) {
    if (bytes86[i] !== 0) {
      console.log(`Index ${i}: ${bytes86[i]} (0x${bytes86[i].toString(16).toUpperCase()})`);
    }
  }

  // Let's verify sum(bytes[12..1296])
  let sum12 = 0;
  for (let i = 12; i < 1296; i++) {
    if (i === 15) continue;
    sum12 += bytes12[i];
  }
  console.log('sum(bytes12[12..1296]):', sum12, 'Mod 256:', sum12 % 256);

  let sum86 = 0;
  for (let i = 12; i < 1296; i++) {
    if (i === 15) continue;
    sum86 += bytes86[i];
  }
  console.log('sum(bytes86[12..1296]):', sum86, 'Mod 256:', sum86 % 256);
}

main();
