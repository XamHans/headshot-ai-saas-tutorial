import 'dotenv/config';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log('Testing DB connection...');
        const result = await db().execute(sql`SELECT 1`);
        console.log('Connection successful:', result);
        process.exit(0);
    } catch (error) {
        console.error('Connection failed:', error);
        process.exit(1);
    }
}

main();
