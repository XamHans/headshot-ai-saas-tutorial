import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const PID_FILE = join(process.cwd(), 'e2e', '.stripe-listen.pid');

/**
 * Kill the `stripe listen` forwarder spawned in globalSetup. It was spawned
 * detached, so signal its process group; ignore if it is already gone.
 */
export default async function globalTeardown() {
  if (!existsSync(PID_FILE)) return;
  const pid = Number(readFileSync(PID_FILE, 'utf-8').trim());
  try {
    // Negative pid → the whole process group.
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already exited.
    }
  }
  try {
    unlinkSync(PID_FILE);
  } catch {
    // Best effort.
  }
}
