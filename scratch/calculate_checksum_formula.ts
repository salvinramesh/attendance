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

  if (templates.length < 2) {
    console.error('Failed to parse templates from log! Found templates count:', templates.length);
    return;
  }

  const t12Hex = templates[0];
  const t86Hex = templates[1];

  const bytes12 = parseTemplate(t12Hex);
  const bytes86 = parseTemplate(t86Hex);

  console.log('Bytes 12 count:', bytes12.length);
  console.log('Bytes 86 count:', bytes86.length);

  const chk12 = bytes12[15];
  const chk86 = bytes86[15];

  console.log(`Target Checksum 12: ${chk12} (0x${chk12.toString(16).toUpperCase()})`);
  console.log(`Target Checksum 86: ${chk86} (0x${chk86.toString(16).toUpperCase()})`);

  // We want to find a formula f(bytes) such that f(bytes12) === 43 and f(bytes86) === 44.
  let foundAny = false;
  for (let start = 0; start < 50; start++) {
    for (let end = start + 5; end <= 1416; end++) {
      // Test Sum
      let sum12 = 0;
      let sum86 = 0;
      for (let i = start; i < end; i++) {
        if (i === 15) continue; // ignore checksum byte itself
        sum12 += bytes12[i];
        sum86 += bytes86[i];
      }

      // Modulo 256 sum
      if ((sum12 % 256) === chk12 && (sum86 % 256) === chk86) {
        console.log(`FOUND MOD 256 SUM FORMULA: sum(bytes[${start}..${end}]) % 256`);
        foundAny = true;
      }

      // 1s complement or 2s complement of sum
      if (((256 - (sum12 % 256)) % 256) === chk12 && ((256 - (sum86 % 256)) % 256) === chk86) {
        console.log(`FOUND 2s COMPLEMENT SUM FORMULA: (256 - sum(bytes[${start}..${end}]) % 256) % 256`);
        foundAny = true;
      }

      // XOR
      let xor12 = 0;
      let xor86 = 0;
      for (let i = start; i < end; i++) {
        if (i === 15) continue;
        xor12 ^= bytes12[i];
        xor86 ^= bytes86[i];
      }
      if (xor12 === chk12 && xor86 === chk86) {
        console.log(`FOUND XOR FORMULA: xor(bytes[${start}..${end}])`);
        foundAny = true;
      }
    }
  }

  if (!foundAny) {
    console.log('No simple sum or XOR formula found in range 0..1416.');
  }
}

main();
