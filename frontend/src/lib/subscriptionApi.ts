import { del, get, post } from "./api";
import type {
  CreateSubscriptionRequest,
  SendNowResponse,
  Subscription,
} from "../types/subscription";

export const fetchSubscriptions = async (): Promise<Subscription[]> => {
  return get<Subscription[]>("/api/subscriptions/");
};

export const createSubscription = async (
  payload: CreateSubscriptionRequest
): Promise<Subscription> => {
  return post<Subscription, CreateSubscriptionRequest>(
    "/api/subscriptions/",
    payload
  );
};

export const deleteSubscription = async (id: number): Promise<void> => {
  await del(`/api/subscriptions/${id}/`);
};

export const sendNowSubscription = async (
  id: number
): Promise<SendNowResponse> => {
  return post<SendNowResponse>(`/api/subscriptions/${id}/send_now/`);
};