const fs = require('fs');
const path = require('path');

const key = process.env.SUPABASE_ANON_KEY;
if (!key) {
  throw new Error('SUPABASE_ANON_KEY is required to build the admin panel');
}

const output = `window.FACHOFERTA_SUPABASE = ${JSON.stringify({
  url: 'https://nufqvbubofjsbqijclci.supabase.co',
  anonKey: key.trim(),
})};\n`;

fs.writeFileSync(path.join(__dirname, '..', 'admin-config.js'), output);
