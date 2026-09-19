#!/usr/bin/env node
/** CLI smoke probe against configured HCM (dummy or Fusion). Unofficial. */
import { createDummyApp } from '../dist/dummy-hcm/index.js';
import { seedStore } from '../dist/dummy-hcm/data.js';
import { HcmClient } from '../dist/client/hcmClient.js';
import { runSmokeProbe, saveSmokeReport } from '../dist/platform/smokeProbe.js';
import { parseArgs } from '../dist/config.js';

async function main() {
  const cfg = parseArgs();
  // If pointing at default placeholder, spin ephemeral dummy
  let closer;
  if (cfg.baseUrl.includes('fa-xxxx')) {
    const app = createDummyApp(seedStore());
    await new Promise((resolve, reject) => {
      const s = app.listen(0, '127.0.0.1', () => resolve());
      s.on('error', reject);
      closer = () => new Promise((r, j) => s.close((e) => (e ? j(e) : r())));
      const addr = s.address();
      cfg.baseUrl = `http://127.0.0.1:${addr.port}/hcmRestApi`;
      cfg.authMode = 'basic';
      cfg.username = 'demo';
      cfg.password = 'demo';
    });
  }
  const client = new HcmClient(cfg);
  const report = await runSmokeProbe(client, { profile: cfg.profile ?? 'cli' });
  const saved = saveSmokeReport(report);
  console.log(JSON.stringify({ saved, summary: report.summary, profile: report.profile }, null, 2));
  if (closer) await closer();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
