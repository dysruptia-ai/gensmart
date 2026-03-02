import { redis } from '../config/redis';
import { query } from '../config/database';
import { PLAN_LIMITS } from '@gensmart/shared';
import { createNotification } from './notification.service';

type PlanKey = keyof typeof PLAN_LIMITS;

function getMonthKey(orgId: string): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `usage:${orgId}:${yearMonth}:messages`;
}

function getMonthSuffix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getOrgPlan(orgId: string): Promise<string> {
  const result = await query<{ plan: string }>(
    `SELECT plan FROM organizations WHERE id = $1`,
    [orgId]
  );
  return result.rows[0]?.plan ?? 'free';
}

export async function incrementMessages(orgId: string): Promise<number> {
  const key = getMonthKey(orgId);
  const count = await redis.incr(key);
  // Set TTL of 35 days for new keys
  if (count === 1) {
    await redis.expire(key, 35 * 24 * 60 * 60);
  }
  // Async flush to DB (fire and forget)
  flushToDb(orgId, count).catch((err) =>
    console.error('[usage] Failed to flush to DB:', err)
  );
  // Check usage thresholds and notify (fire and forget)
  checkUsageThresholds(orgId, count).catch((err) =>
    console.error('[usage] Failed to check usage thresholds:', err)
  );
  return count;
}

async function checkUsageThresholds(orgId: string, newCount: number): Promise<void> {
  const plan = await getOrgPlan(orgId);
  const planKey = plan as PlanKey;
  const planLimit = PLAN_LIMITS[planKey]?.messagesPerMonth ?? 50;
  const monthSuffix = getMonthSuffix();

  // Add add-on messages to effective limit
  const addonKey = `usage:${orgId}:${monthSuffix}:addon_messages`;
  const addonMessages = parseInt((await redis.get(addonKey)) ?? '0', 10);
  const limit = planLimit + addonMessages;

  const percent = Math.round((newCount / limit) * 100);

  // Notify at 80% (in-app only, once per billing period)
  if (percent >= 80 && percent < 100) {
    const notifKey = `notif:usage80:${orgId}:${monthSuffix}`;
    const already = await redis.get(notifKey);
    if (!already) {
      await redis.set(notifKey, '1', 'EX', 35 * 86400);
      await createNotification({
        organizationId: orgId,
        type: 'plan_usage_80',
        title: 'Usage Alert: 80% of messages used',
        message: `You've used ${newCount} of ${limit} messages this month.`,
        data: { used: newCount, limit, percent },
        sendEmail: false,
      });
    }
  }

  // Notify at 100% (in-app + email, once per billing period)
  if (percent >= 100) {
    const notifKey = `notif:usage100:${orgId}:${monthSuffix}`;
    const already = await redis.get(notifKey);
    if (!already) {
      await redis.set(notifKey, '1', 'EX', 35 * 86400);
      await createNotification({
        organizationId: orgId,
        type: 'plan_usage_100',
        title: 'Message limit reached',
        message: `You've used all ${limit} messages. Upgrade your plan or purchase add-on messages.`,
        data: { used: newCount, limit, percent: 100 },
        sendEmail: true,
      });
    }
  }
}

export async function getMessageCount(orgId: string): Promise<number> {
  const key = getMonthKey(orgId);
  const count = await redis.get(key);
  return count ? parseInt(count, 10) : 0;
}

export async function checkLimit(
  orgId: string,
  plan: string
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const planKey = plan as PlanKey;
  const planLimit = PLAN_LIMITS[planKey]?.messagesPerMonth ?? 50;

  // Add add-on messages to the effective limit
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const addonKey = `usage:${orgId}:${yearMonth}:addon_messages`;
  const addonMessages = parseInt((await redis.get(addonKey)) ?? '0', 10);
  const limit = planLimit + addonMessages;

  const current = await getMessageCount(orgId);
  return { allowed: current < limit, current, limit };
}

async function flushToDb(orgId: string, count: number): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  await query(
    `INSERT INTO usage_logs (organization_id, metric, value, period_start, period_end, created_at)
     VALUES ($1, 'messages', $2, $3, $4, NOW())
     ON CONFLICT (organization_id, metric, period_start)
     DO UPDATE SET value = $2, updated_at = NOW()`,
    [orgId, count, periodStart.toISOString(), periodEnd.toISOString()]
  ).catch(() => {
    // usage_logs table might not have the exact schema yet — ignore safely
  });
}
