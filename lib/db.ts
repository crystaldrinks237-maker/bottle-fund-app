import { neon } from '@neondatabase/serverless';

// Single shared SQL tag-function client, reused across API routes.
export const sql = neon(process.env.DATABASE_URL!);
