import 'dotenv/config';
import { r2Storage } from '@/lib/storage/r2-client';

const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];

async function main() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const key = `__verify/${Date.now()}.txt`;
  const contents = Buffer.from(`r2 verify probe ${Date.now()}`);

  try {
    console.log('1. Uploading test object...');
    const publicUrl = await r2Storage.uploadFile(key, contents, 'text/plain');
    console.log(`   Uploaded to key "${key}"`);

    console.log('2. Confirming object is NOT publicly reachable...');
    const publicRes = await fetch(publicUrl);
    if (publicRes.ok) {
      console.error(
        `   FAIL: object was publicly readable (status ${publicRes.status}). Bucket must not be public-read.`,
      );
      process.exit(1);
    }
    console.log(`   OK: public fetch returned ${publicRes.status} (not accessible without a signed URL)`);

    console.log('3. Confirming object IS reachable via a signed URL...');
    const signedUrl = await r2Storage.getSignedUrl(key);
    const signedRes = await fetch(signedUrl);
    if (!signedRes.ok) {
      console.error(`   FAIL: signed URL fetch returned ${signedRes.status}`);
      process.exit(1);
    }
    const body = await signedRes.text();
    if (body !== contents.toString()) {
      console.error('   FAIL: signed URL content did not match what was uploaded');
      process.exit(1);
    }
    console.log('   OK: signed URL fetch succeeded and content matches');

    console.log('4. Cleaning up test object...');
    await r2Storage.deleteFile(key);
    console.log('   OK: deleted');

    console.log('\nR2 credentials are valid and the bucket is private. ✔');
    process.exit(0);
  } catch (error) {
    console.error('R2 verification failed:', error);
    process.exit(1);
  }
}

main();
