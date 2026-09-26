export type Subscription = {
  status: "active" | "inactive";
  plan: string | null;
  current_period_end: string | null;
};

export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub || sub.status !== "active") return false;
  if (sub.current_period_end && new Date(sub.current_period_end).getTime() < Date.now()) return false;
  return true;
}
