import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://gensmart:gensmart@localhost:5432/gensmart',
});

const TEST_PASSWORD = 'Test1234!';
const BCRYPT_ROUNDS = 12;

interface TestUser {
  orgName: string;
  slug: string;
  plan: string;
  userName: string;
  email: string;
}

const testUsers: TestUser[] = [
  {
    orgName: 'Starter Test Org',
    slug: 'starter-test-org',
    plan: 'starter',
    userName: 'Starter User',
    email: 'starter@test.com',
  },
  {
    orgName: 'Pro Test Org',
    slug: 'pro-test-org',
    plan: 'pro',
    userName: 'Pro User',
    email: 'pro@test.com',
  },
  {
    orgName: 'Enterprise Test Org',
    slug: 'enterprise-test-org',
    plan: 'enterprise',
    userName: 'Enterprise User',
    email: 'enterprise@test.com',
  },
];

async function seedTestUsers() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);

    console.log('\nSeeding test users...\n');

    for (const user of testUsers) {
      // Insert organization
      const orgResult = await client.query<{ id: string }>(
        `INSERT INTO organizations (name, slug, plan, subscription_status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (slug) DO UPDATE SET plan = EXCLUDED.plan
         RETURNING id`,
        [user.orgName, user.slug, user.plan]
      );
      const orgId = orgResult.rows[0]!.id;

      // Insert user
      await client.query(
        `INSERT INTO users (organization_id, email, password_hash, name, role, email_verified)
         VALUES ($1, $2, $3, $4, 'owner', true)
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               organization_id = EXCLUDED.organization_id,
               name = EXCLUDED.name`,
        [orgId, user.email, passwordHash, user.userName]
      );

      console.log(`  ✓ [${user.plan.toUpperCase()}] ${user.email} — org: ${user.orgName}`);
    }

    await client.query('COMMIT');

    console.log('\n─────────────────────────────────────────');
    console.log('Test users created successfully!\n');
    console.log('Credentials (all share the same password):');
    console.log(`  Password: ${TEST_PASSWORD}\n`);
    for (const user of testUsers) {
      console.log(`  [${user.plan}] ${user.email}`);
    }
    console.log('─────────────────────────────────────────\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding test users failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});
