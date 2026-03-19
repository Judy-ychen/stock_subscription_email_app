export type Subscription = {
  id: number;
  ticker: string;
  email: string;
  user?: number;
  user_email?: string;
  created_at?: string;
  target_price_above?: number | null;
  target_price_below?: number | null;
  alert_triggered?: boolean;
  alert_triggered_at?: string | null;
};

export type CreateSubscriptionRequest = {
  ticker: string;
  email: string;
  target_price_above?: number | null;
  target_price_below?: number | null;
};

export type SendNowResponse = {
  message: string;
  task_id?: string;
};

export type EmailLog = {
  id: number;
  recipient: string;
  tickers: string[];
  status: "success" | "failed";
  error: string;
  sent_at: string;
  triggered_by: string;
};