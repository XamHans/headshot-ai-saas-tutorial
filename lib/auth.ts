import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import * as schema from '@/modules/users/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db(), {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  plugins: [nextCookies()],
});

export async function getCurrentUser() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(), // you need to pass the headers object
    });

    return session?.user || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}
