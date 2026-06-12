import Stripe from 'stripe';
type PlanName = 'starter' | 'pro' | 'enterprise';
type Interval = 'monthly' | 'quarterly' | 'yearly';
type AddonKey = 'messages_500' | 'messages_2000' | 'messages_5000';
export declare function createCustomer(orgId: string, email: string, name: string): Promise<Stripe.Customer>;
export declare function getOrCreateCustomer(orgId: string, email: string, name: string): Promise<string>;
export declare function updateCustomerEmail(customerId: string, email: string): Promise<void>;
export declare function createCheckoutSession(params: {
    orgId: string;
    customerId: string;
    priceId: string;
    plan: PlanName;
    interval: Interval;
    successUrl: string;
    cancelUrl: string;
}): Promise<Stripe.Checkout.Session>;
export declare function createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session>;
export declare function getSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
export declare function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
export declare function updateSubscriptionPlan(subscriptionId: string, itemId: string, newPriceId: string): Promise<Stripe.Subscription>;
export declare function createAddOnCheckout(params: {
    customerId: string;
    addon: AddonKey;
    orgId: string;
    successUrl: string;
    cancelUrl: string;
}): Promise<Stripe.Checkout.Session>;
export declare function getInvoices(customerId: string, limit?: number): Promise<Stripe.Invoice[]>;
export declare function getPricesForPlan(plan: PlanName): {
    monthly: string;
    quarterly: string;
    yearly: string;
};
export declare function getAddonPrices(): {
    messages_500: string;
    messages_2000: string;
    messages_5000: string;
};
export declare function constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event;
export declare function saveBillingEvent(orgId: string, stripeEventId: string, eventType: string, amount: number | null, metadata: Record<string, unknown>): Promise<boolean>;
export declare function updateOrgSubscription(params: {
    orgId: string;
    plan: string;
    subscriptionId: string;
    status: string;
    periodStart: Date | null;
    periodEnd: Date | null;
}): Promise<void>;
export declare function downgradeOrgToFree(orgId: string): Promise<void>;
export declare function handleWebhookEvent(event: Stripe.Event): Promise<void>;
export {};
//# sourceMappingURL=stripe.service.d.ts.map