import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { seedAgentTemplates } from './agent-templates.seed';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://gensmart:gensmart@localhost:5432/gensmart',
});

async function seed() {
  console.log('Starting database seed...\n');

  console.log('--- Agent Templates ---');
  const { inserted, updated } = await seedAgentTemplates(pool);
  console.log(`\nAgent templates: ${inserted} inserted, ${updated} updated\n`);

  console.log('Seeding completed successfully!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  pool.end().finally(() => process.exit(1));
});
