#!/usr/bin/env node
/**
 * Deploy 735 backend + frontend to the Xinjiang node (FRP SSH :19999).
 *
 * Builds a static musl backend binary and the Vite frontend locally,
 * pushes them to /opt/735 on the target, then restarts systemd units.
 *
 * Usage:
 *   node scripts/deploy.mjs            # build + push + restart
 *   node scripts/deploy.mjs --skip-build
 *   node scripts/deploy.mjs --dry-run
 *
 * Env:
 *   SSH_KEY         default ~/.ssh/sTWPx2n_key
 *   SUDO_PASSWORD   password for remote sudo (default y1234567)
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TARGET = {
  host: '139.84.136.148',
  port: 19999,
  user: 'yy',
  remoteDir: '/opt/735',
  backendPort: 3000,
  frontendPort: 8080,
  station: 'STATION-01',
};

const SSH_KEY = process.env.SSH_KEY || path.join(os.homedir(), '.ssh/sTWPx2n_key');
const SUDO_PASSWORD = process.env.SUDO_PASSWORD || 'y1234567';
const SKIP_BUILD = process.argv.includes('--skip-build');
const DRY_RUN = process.argv.includes('--dry-run');

const MUSL_TARGET = 'aarch64-unknown-linux-musl';
const BACKEND_BIN = path.join(ROOT, 'backend/target', MUSL_TARGET, 'release/backend');
const FRONTEND_DIST = path.join(ROOT, 'cabcal-jurlegi/dist');
const SERVE_PY = path.join(ROOT, 'scripts/serve.py');

const BACKEND_UNIT = `[Unit]
Description=735 monitoring backend (Rust/axum)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${TARGET.user}
WorkingDirectory=${TARGET.remoteDir}
ExecStart=${TARGET.remoteDir}/bin/backend --listen 0.0.0.0:${TARGET.backendPort} --station ${TARGET.station}
Restart=on-failure
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
`;

const FRONTEND_UNIT = `[Unit]
Description=735 frontend (static + /api reverse proxy)
After=network-online.target 735-backend.service
Wants=network-online.target
Wants=735-backend.service

[Service]
Type=simple
User=${TARGET.user}
WorkingDirectory=${TARGET.remoteDir}
Environment=API_UPSTREAM=http://127.0.0.1:${TARGET.backendPort}
Environment=SERVE_PORT=${TARGET.frontendPort}
ExecStart=/usr/bin/python3 ${TARGET.remoteDir}/serve.py
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
`;

function log(msg) {
  console.log(`[deploy] ${msg}`);
}

function run(cmd, opts = {}) {
  log(`$ ${cmd}`);
  if (DRY_RUN) return '';
  return execSync(cmd, {
    stdio: ['pipe', 'pipe', 'inherit'],
    encoding: 'utf8',
    cwd: ROOT,
    ...opts,
  });
}

function sshArgs() {
  return [
    '-i', SSH_KEY,
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=20',
    '-p', String(TARGET.port),
    `${TARGET.user}@${TARGET.host}`,
  ];
}

/** Run a remote shell script via stdin (avoids quoting pitfalls). */
function ssh(script, { sudo = false } = {}) {
  const remoteShell = sudo
    ? `echo ${JSON.stringify(SUDO_PASSWORD)} | sudo -S bash -s`
    : 'bash -s';
  if (DRY_RUN) {
    log(`$ ssh ${TARGET.user}@${TARGET.host} '${remoteShell}'  <<'SCRIPT'\n${script}\nSCRIPT`);
    return '';
  }
  const out = execFileSync('ssh', [...sshArgs(), remoteShell], {
    input: script,
    stdio: ['pipe', 'pipe', 'inherit'],
    encoding: 'utf8',
  });
  if (out && out.trim()) log(out.trimEnd());
  return out;
}

/** Push a local directory to a remote path using tar-over-ssh (FRP-friendly). */
function pushDir(localDir, remoteDir) {
  const cmd = `tar -C ${JSON.stringify(localDir)} -cf - . | ssh ${sshArgs().map((a) => JSON.stringify(a)).join(' ')} ${JSON.stringify(`mkdir -p ${remoteDir} && tar -C ${remoteDir} -xf -`)}`;
  run(cmd);
}

function ensureMuslConfig() {
  const cfgDir = path.join(ROOT, 'backend/.cargo');
  const cfgFile = path.join(cfgDir, 'config.toml');
  const wanted = `[target.${MUSL_TARGET}]
linker = "aarch64-linux-musl-gcc"
rustflags = ["-C", "target-feature=+crt-static"]
`;
  fs.mkdirSync(cfgDir, { recursive: true });
  const current = fs.existsSync(cfgFile) ? fs.readFileSync(cfgFile, 'utf8') : '';
  if (current !== wanted) {
    fs.writeFileSync(cfgFile, wanted);
    log(`wrote ${path.relative(ROOT, cfgFile)}`);
  }
}

function buildBackend() {
  log('building backend (musl static release)');
  ensureMuslConfig();
  run(`cargo build --release --target ${MUSL_TARGET}`, {
    cwd: path.join(ROOT, 'backend'),
  });
  if (!fs.existsSync(BACKEND_BIN)) {
    throw new Error(`missing backend binary: ${BACKEND_BIN}`);
  }
  const kind = execSync(`file ${JSON.stringify(BACKEND_BIN)}`, { encoding: 'utf8' });
  if (!kind.includes('statically linked')) {
    throw new Error(`backend is not statically linked:\n${kind}`);
  }
  log(`backend ok: ${BACKEND_BIN}`);
}

function buildFrontend() {
  log('building frontend (vite)');
  run('pnpm build', { cwd: path.join(ROOT, 'cabcal-jurlegi') });
  if (!fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
    throw new Error(`missing frontend dist: ${FRONTEND_DIST}`);
  }
  log(`frontend ok: ${FRONTEND_DIST}`);
}

function stage() {
  const stageDir = path.join(os.tmpdir(), '735-deploy');
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(stageDir, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(stageDir, 'dist'), { recursive: true });

  fs.copyFileSync(BACKEND_BIN, path.join(stageDir, 'bin/backend'));
  fs.chmodSync(path.join(stageDir, 'bin/backend'), 0o755);
  fs.cpSync(FRONTEND_DIST, path.join(stageDir, 'dist'), { recursive: true });
  fs.copyFileSync(SERVE_PY, path.join(stageDir, 'serve.py'));
  fs.chmodSync(path.join(stageDir, 'serve.py'), 0o755);
  fs.writeFileSync(path.join(stageDir, '735-backend.service'), BACKEND_UNIT);
  fs.writeFileSync(path.join(stageDir, '735-frontend.service'), FRONTEND_UNIT);

  log(`staged ${stageDir}`);
  return stageDir;
}

function pushAndInstall(stageDir) {
  const remoteStage = `/home/${TARGET.user}/735-deploy`;
  pushDir(stageDir, remoteStage);

  ssh(`set -e
mkdir -p ${TARGET.remoteDir}
cp -a ${remoteStage}/. ${TARGET.remoteDir}/
chown -R ${TARGET.user}:${TARGET.user} ${TARGET.remoteDir}
chmod +x ${TARGET.remoteDir}/bin/backend ${TARGET.remoteDir}/serve.py
cp ${TARGET.remoteDir}/735-backend.service /etc/systemd/system/
cp ${TARGET.remoteDir}/735-frontend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable 735-backend.service 735-frontend.service
systemctl restart 735-backend.service
sleep 1
systemctl restart 735-frontend.service
sleep 2
systemctl --no-pager --full status 735-backend.service 735-frontend.service || true
ss -tlnp | grep -E '${TARGET.backendPort}|${TARGET.frontendPort}' || true
`, { sudo: true });
}

function verify() {
  log('verifying');
  ssh(`set -e
curl -sf http://127.0.0.1:${TARGET.frontendPort}/api/v1/devices >/dev/null
curl -sf http://127.0.0.1:${TARGET.frontendPort}/ >/dev/null
curl -sf http://127.0.0.1:${TARGET.frontendPort}/api/v1/scene >/dev/null
echo VERIFY_OK
`);
}

function main() {
  log(`target ${TARGET.user}@${TARGET.host}:${TARGET.port} -> ${TARGET.remoteDir}`);
  if (!SKIP_BUILD) {
    buildBackend();
    buildFrontend();
  } else {
    log('skip build (--skip-build)');
    if (!fs.existsSync(BACKEND_BIN)) throw new Error(`missing ${BACKEND_BIN}`);
    if (!fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) throw new Error(`missing ${FRONTEND_DIST}`);
  }
  const stageDir = stage();
  pushAndInstall(stageDir);
  if (!DRY_RUN) verify();
  log('done');
}

try {
  main();
} catch (err) {
  console.error('[deploy] FAILED:', err.message || err);
  process.exit(1);
}
