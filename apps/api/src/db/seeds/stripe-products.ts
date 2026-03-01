/**
 * Stripe Products & Prices Seed Script
 * Run once: npm run stripe:seed --workspace=apps/api
 * After running, copy the price IDs into your .env file.
 */
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import Stripe from 'stripe';

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
  apiVersion: '2026-02-25.clover',
  typescript: true,
});

interface PlanPrices {
  monthly: string;
  quarterly: string;
  yearly: string;
}

interface PriceMap {
  starter: PlanPrices;
  pro: PlanPrices;
  enterprise: PlanPrices;
  addons: {
    messages_500: string;
    messages_2000: string;
    messages_5000: string;
  };
}

async function getOrCreateProduct(
  name: string,
  metadata: Record<string, string>
): Promise<Stripe.Product> {
  // Try to find existing product by metadata
  const existing = await stripe.products.list({ active: true, limit: 100 });
  const found = existing.data.find(
    (p) => p.metadata['plan'] === metadata['plan'] && p.name === name
  );
  if (found) {
    console.log(`  Found existing product: ${found.name} (${found.id})`);
    return found;
  }
  const product = await stripe.products.create({ name, metadata });
  console.log(`  Created product: ${product.name} (${product.id})`);
  return product;
}

async function getOrCreatePrice(
  productId: string,
  unitAmount: number,
  currency: string,
  recurring: Stripe.PriceCreateParams.Recurring | null,
  metadata: Record<string, string>,
  nickname: string
): Promise<Stripe.Price> {
  // Try to find existing price with same metadata
  const existing = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const found = existing.data.find(
    (p) =>
      p.metadata['plan'] === metadata['plan'] &&
      p.metadata['interval'] === metadata['interval']
  );
  if (found) {
    console.log(`    Found existing price: ${nickname} (${found.id})`);
    return found;
  }

  const priceParams: Stripe.PriceCreateParams = {
    product: productId,
    unit_amount: unitAmount,
    currency,
    nickname,
    metadata,
  };
  if (recurring) {
    priceParams.recurring = recurring;
  }

  const price = await stripe.prices.create(priceParams);
  console.log(`    Created price: ${nickname} (${price.id})`);
  return price;
}

async function main(): Promise<void> {
  console.log('\n🚀 GenSmart Stripe Products Seed\n');

  if (!process.env['STRIPE_SECRET_KEY'] || process.env['STRIPE_SECRET_KEY'] === 'sk_test_...') {
    console.error('❌ STRIPE_SECRET_KEY not configured in .env');
    process.exit(1);
  }

  const priceMap: PriceMap = {
    starter: { monthly: '', quarterly: '', yearly: '' },
    pro: { monthly: '', quarterly: '', yearly: '' },
    enterprise: { monthly: '', quarterly: '', yearly: '' },
    addons: { messages_500: '', messages_2000: '', messages_5000: '' },
  };

  // ── Starter Plan ─────────────────────────────────────────────────────────
  console.log('\n📦 Starter Plan ($29/mo)');
  const starterProduct = await getOrCreateProduct('GenSmart Starter', { plan: 'starter' });

  const starterMonthly = await getOrCreatePrice(
    starterProduct.id, 2900, 'usd',
    { interval: 'month', interval_count: 1 },
    { plan: 'starter', interval: 'monthly' },
    'Starter Monthly'
  );
  priceMap.starter.monthly = starterMonthly.id;

  const starterQuarterly = await getOrCreatePrice(
    starterProduct.id, 7830, 'usd',
    { interval: 'month', interval_count: 3 },
    { plan: 'starter', interval: 'quarterly' },
    'Starter Quarterly (10% off)'
  );
  priceMap.starter.quarterly = starterQuarterly.id;

  const starterYearly = await getOrCreatePrice(
    starterProduct.id, 27840, 'usd',
    { interval: 'year', interval_count: 1 },
    { plan: 'starter', interval: 'yearly' },
    'Starter Yearly (20% off)'
  );
  priceMap.starter.yearly = starterYearly.id;

  // ── Pro Plan ──────────────────────────────────────────────────────────────
  console.log('\n📦 Pro Plan ($79/mo)');
  const proProduct = await getOrCreateProduct('GenSmart Pro', { plan: 'pro' });

  const proMonthly = await getOrCreatePrice(
    proProduct.id, 7900, 'usd',
    { interval: 'month', interval_count: 1 },
    { plan: 'pro', interval: 'monthly' },
    'Pro Monthly'
  );
  priceMap.pro.monthly = proMonthly.id;

  const proQuarterly = await getOrCreatePrice(
    proProduct.id, 21330, 'usd',
    { interval: 'month', interval_count: 3 },
    { plan: 'pro', interval: 'quarterly' },
    'Pro Quarterly (10% off)'
  );
  priceMap.pro.quarterly = proQuarterly.id;

  const proYearly = await getOrCreatePrice(
    proProduct.id, 75840, 'usd',
    { interval: 'year', interval_count: 1 },
    { plan: 'pro', interval: 'yearly' },
    'Pro Yearly (20% off)'
  );
  priceMap.pro.yearly = proYearly.id;

  // ── Enterprise Plan ───────────────────────────────────────────────────────
  console.log('\n📦 Enterprise Plan ($199/mo)');
  const enterpriseProduct = await getOrCreateProduct('GenSmart Enterprise', { plan: 'enterprise' });

  const enterpriseMonthly = await getOrCreatePrice(
    enterpriseProduct.id, 19900, 'usd',
    { interval: 'month', interval_count: 1 },
    { plan: 'enterprise', interval: 'monthly' },
    'Enterprise Monthly'
  );
  priceMap.enterprise.monthly = enterpriseMonthly.id;

  const enterpriseQuarterly = await getOrCreatePrice(
    enterpriseProduct.id, 53730, 'usd',
    { interval: 'month', interval_count: 3 },
    { plan: 'enterprise', interval: 'quarterly' },
    'Enterprise Quarterly (10% off)'
  );
  priceMap.enterprise.quarterly = enterpriseQuarterly.id;

  const enterpriseYearly = await getOrCreatePrice(
    enterpriseProduct.id, 191040, 'usd',
    { interval: 'year', interval_count: 1 },
    { plan: 'enterprise', interval: 'yearly' },
    'Enterprise Yearly (20% off)'
  );
  priceMap.enterprise.yearly = enterpriseYearly.id;

  // ── Message Add-ons ───────────────────────────────────────────────────────
  console.log('\n📦 Message Add-ons');
  const addonProduct = await getOrCreateProduct('GenSmart Message Add-on', { type: 'addon' });

  const addon500 = await getOrCreatePrice(
    addonProduct.id, 1000, 'usd', null,
    { plan: 'addon', interval: 'messages_500' },
    '500 Extra Messages - $10'
  );
  priceMap.addons.messages_500 = addon500.id;

  const addon2000 = await getOrCreatePrice(
    addonProduct.id, 3000, 'usd', null,
    { plan: 'addon', interval: 'messages_2000' },
    '2,000 Extra Messages - $30'
  );
  priceMap.addons.messages_2000 = addon2000.id;

  const addon5000 = await getOrCreatePrice(
    addonProduct.id, 6000, 'usd', null,
    { plan: 'addon', interval: 'messages_5000' },
    '5,000 Extra Messages - $60'
  );
  priceMap.addons.messages_5000 = addon5000.id;

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Done! Add these to your .env file:\n');
  console.log(`STRIPE_PRICE_STARTER_MONTHLY=${priceMap.starter.monthly}`);
  console.log(`STRIPE_PRICE_STARTER_QUARTERLY=${priceMap.starter.quarterly}`);
  console.log(`STRIPE_PRICE_STARTER_YEARLY=${priceMap.starter.yearly}`);
  console.log(`STRIPE_PRICE_PRO_MONTHLY=${priceMap.pro.monthly}`);
  console.log(`STRIPE_PRICE_PRO_QUARTERLY=${priceMap.pro.quarterly}`);
  console.log(`STRIPE_PRICE_PRO_YEARLY=${priceMap.pro.yearly}`);
  console.log(`STRIPE_PRICE_ENTERPRISE_MONTHLY=${priceMap.enterprise.monthly}`);
  console.log(`STRIPE_PRICE_ENTERPRISE_QUARTERLY=${priceMap.enterprise.quarterly}`);
  console.log(`STRIPE_PRICE_ENTERPRISE_YEARLY=${priceMap.enterprise.yearly}`);
  console.log(`STRIPE_PRICE_ADDON_500=${priceMap.addons.messages_500}`);
  console.log(`STRIPE_PRICE_ADDON_2000=${priceMap.addons.messages_2000}`);
  console.log(`STRIPE_PRICE_ADDON_5000=${priceMap.addons.messages_5000}`);

  // Auto-update .env file
  const envPath = path.resolve(process.cwd(), '../../.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf-8');
    const updates: Record<string, string> = {
      STRIPE_PRICE_STARTER_MONTHLY: priceMap.starter.monthly,
      STRIPE_PRICE_STARTER_QUARTERLY: priceMap.starter.quarterly,
      STRIPE_PRICE_STARTER_YEARLY: priceMap.starter.yearly,
      STRIPE_PRICE_PRO_MONTHLY: priceMap.pro.monthly,
      STRIPE_PRICE_PRO_QUARTERLY: priceMap.pro.quarterly,
      STRIPE_PRICE_PRO_YEARLY: priceMap.pro.yearly,
      STRIPE_PRICE_ENTERPRISE_MONTHLY: priceMap.enterprise.monthly,
      STRIPE_PRICE_ENTERPRISE_QUARTERLY: priceMap.enterprise.quarterly,
      STRIPE_PRICE_ENTERPRISE_YEARLY: priceMap.enterprise.yearly,
      STRIPE_PRICE_ADDON_500: priceMap.addons.messages_500,
      STRIPE_PRICE_ADDON_2000: priceMap.addons.messages_2000,
      STRIPE_PRICE_ADDON_5000: priceMap.addons.messages_5000,
    };
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      envContent = envContent.replace(regex, `${key}=${value}`);
    }
    fs.writeFileSync(envPath, envContent);
    console.log('\n📝 .env file updated automatically!');
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
