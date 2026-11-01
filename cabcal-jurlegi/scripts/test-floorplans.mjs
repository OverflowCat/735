import { build } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const output = await mkdtemp(join(tmpdir(), '735-map-tests-'));
try {
  await build({
    configFile: false,
    logLevel: 'error',
    define: { 'import.meta.env.BASE_URL': JSON.stringify('/') },
    build: {
      target: 'esnext',
      outDir: output,
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: 'tests/floorplans.test.ts',
        formats: ['es'],
        fileName: () => 'tests.mjs',
      },
      rolldownOptions: { external: [/^node:/] },
    },
  });
  const result = spawnSync(process.execPath, [join(output, 'tests.mjs')], {
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(output, { recursive: true, force: true });
}
