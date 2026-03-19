export type Subscription = {
  id: number;
  ticker: string;
  email: string;
  user?: number;
  user_email?: string;
  created_at?: string;
};

export type CreateSubscriptionRequest = {
  ticker: string;
  email: string;
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