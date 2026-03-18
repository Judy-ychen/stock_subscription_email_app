import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuthStore } from "../../stores/authStore";
import {
  fetchSubscriptions,
  createSubscription,
  deleteSubscription,
  sendNowSubscription,
} from "../../lib/subscriptionApi";
import { validateTicker, fetchStockPrice } from "../../lib/stockApi";
import type { Subscription } from "../../types/subscription";
import type { StockPriceResponse } from "../../types/stock";
import { useDebounce } from "../../hooks/useDebounce";

import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Skeleton } from "../ui/skeleton";

type PriceMap = Record<string, StockPriceResponse>;

function getApiErrorMessage(error: unknown): string {
  const fallback = "Something went wrong.";

  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response
  ) {
    const data = error.response.data as Record<string, unknown>;

    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return String(data.non_field_errors[0]);
    }

    if (Array.isArray(data.ticker) && data.ticker.length > 0) {
      return String(data.ticker[0]);
    }

    if (Array.isArray(data.email) && data.email.length > 0) {
      return String(data.email[0]);
    }

    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (typeof data.message === "string") {
      return data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export default function SubscriptionDashboard() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const isAdmin = !!user && (user.is_staff || user.is_superuser);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [priceMap, setPriceMap] = useState<PriceMap>({});

  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const [tickerInput, setTickerInput] = useState("");
  const [recipientEmail, setRecipientEmail] = useState(user?.email ?? "");

  const debouncedTicker = useDebounce(tickerInput, 500);

  const [tickerValid, setTickerValid] = useState<boolean | null>(null);
  const [isValidatingTicker, setIsValidatingTicker] = useState(false);

  const [tickerError, setTickerError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");

  const canSubmit = useMemo(() => {
    return (
      !!tickerInput.trim() &&
      !!recipientEmail.trim() &&
      tickerValid === true &&
      !isCreating
    );
  }, [tickerInput, recipientEmail, tickerValid, isCreating]);

  useEffect(() => {
    if (!user?.email) return;
    setRecipientEmail((prev) => prev || user.email);
  }, [user]);

  const loadPrices = async (subs: Subscription[]) => {
    const uniqueTickers = Array.from(
      new Set(subs.map((sub) => sub.ticker.toUpperCase()))
    );

    if (uniqueTickers.length === 0) {
      setPriceMap({});
      return;
    }

    const results = await Promise.all(
      uniqueTickers.map(async (ticker) => {
        try {
          const data = await fetchStockPrice(ticker);
          return [ticker, data] as const;
        } catch {
          return [
            ticker,
            {
              ticker,
              price: null,
              source: "unavailable",
            } as StockPriceResponse,
          ] as const;
        }
      })
    );

    const nextMap: PriceMap = {};
    for (const [ticker, data] of results) {
      nextMap[ticker] = data;
    }
    setPriceMap(nextMap);
  };

  const loadSubscriptions = async () => {
    if (!isAuthenticated) return;

    setIsLoadingSubscriptions(true);
    try {
      const data = await fetchSubscriptions();
      setSubscriptions(data);
      await loadPrices(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoadingSubscriptions(false);
    }
  };

  useEffect(() => {
    void loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    const trimmed = debouncedTicker.trim();

    if (!trimmed) {
      setTickerValid(null);
      setTickerError("");
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsValidatingTicker(true);
      setTickerError("");

      try {
        const result = await validateTicker(trimmed);
        if (cancelled) return;

        setTickerValid(result.valid);

        if (!result.valid) {
          setTickerError("Invalid ticker symbol.");
        }
      } catch (error) {
        if (cancelled) return;
        setTickerValid(null);
        setTickerError("Ticker validation failed. Please try again.");
      } finally {
        if (!cancelled) {
          setIsValidatingTicker(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [debouncedTicker]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    setTickerError("");
    setEmailError("");
    setFormError("");

    const normalizedTicker = tickerInput.trim().toUpperCase();
    const normalizedEmail = recipientEmail.trim().toLowerCase();

    if (!normalizedTicker) {
      setTickerError("Ticker is required.");
      return;
    }

    if (!normalizedEmail) {
      setEmailError("Recipient email is required.");
      return;
    }

    if (tickerValid !== true) {
      setTickerError("Please enter a valid ticker before creating.");
      return;
    }

    setIsCreating(true);

    try {
      await createSubscription({
        ticker: normalizedTicker,
        email: normalizedEmail,
      });

      toast.success("Subscription created.");
      setTickerInput("");
      setTickerValid(null);
      setTickerError("");
      await loadSubscriptions();
    } catch (error) {
      const message = getApiErrorMessage(error);
      setFormError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    setActionLoadingId(id);

    try {
      await deleteSubscription(id);
      toast.success("Subscription deleted.");
      await loadSubscriptions();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendNow = async (id: number) => {
    setActionLoadingId(id);

    try {
      await sendNowSubscription(id);
      toast.success("Send Now triggered.");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Subscription Dashboard</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Admin view: you can see all subscriptions."
              : "User view: you can see your own subscriptions only."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker</Label>
              <Input
                id="ticker"
                value={tickerInput}
                onChange={(e) => {
                  setTickerInput(e.target.value.toUpperCase());
                  setTickerError("");
                  setFormError("");
                }}
                placeholder="AAPL"
              />
              {isValidatingTicker && (
                <p className="text-sm text-muted-foreground">Validating ticker...</p>
              )}
              {tickerValid === true && !isValidatingTicker && (
                <p className="text-sm text-green-600">Ticker looks valid.</p>
              )}
              {tickerError && (
                <p className="text-sm text-red-600">{tickerError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                type="email"
                value={recipientEmail}
                onChange={(e) => {
                  setRecipientEmail(e.target.value);
                  setEmailError("");
                  setFormError("");
                }}
                placeholder="test@example.com"
              />
              {emailError && (
                <p className="text-sm text-red-600">{emailError}</p>
              )}
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {isCreating ? "Creating..." : "Create Subscription"}
              </Button>
            </div>

            {formError && (
              <div className="md:col-span-3">
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>
            Current subscriptions with latest available price data.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoadingSubscriptions ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No subscriptions yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Ticker</th>
                    <th className="px-4 py-3 text-left font-medium">Current Price</th>
                    <th className="px-4 py-3 text-left font-medium">Recipient Email</th>
                    <th className="px-4 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {subscriptions.map((sub) => {
                    const priceData = priceMap[sub.ticker.toUpperCase()];
                    const isRowBusy = actionLoadingId === sub.id;

                    return (
                      <tr key={sub.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{sub.ticker}</td>

                        <td className="px-4 py-3">
                          {priceData ? (
                            priceData.price !== null ? (
                              <div className="flex flex-col">
                                <span>${priceData.price}</span>
                                <span className="text-xs text-muted-foreground">
                                  source: {priceData.source}
                                </span>
                              </div>
                            ) : (
                              <span className="text-red-600">Invalid ticker</span>
                            )
                          ) : (
                            <Skeleton className="h-4 w-20" />
                          )}
                        </td>

                        <td className="px-4 py-3">{sub.email}</td>

                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleSendNow(sub.id)}
                              disabled={isRowBusy}
                            >
                              {isRowBusy ? "Working..." : "Send Now"}
                            </Button>

                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => void handleDelete(sub.id)}
                              disabled={isRowBusy}
                            >
                              {isRowBusy ? "Working..." : "Delete"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}