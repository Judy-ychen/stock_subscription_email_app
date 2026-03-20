import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuthStore } from "../../stores/authStore";
import {
  fetchSubscriptions,
  createSubscription,
  updateSubscription,
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

    if (
      Array.isArray(data.target_price_above) &&
      data.target_price_above.length > 0
    ) {
      return String(data.target_price_above[0]);
    }

    if (
      Array.isArray(data.target_price_below) &&
      data.target_price_below.length > 0
    ) {
      return String(data.target_price_below[0]);
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

function formatAlert(sub: Subscription) {
  const parts: string[] = [];

  if (sub.target_price_above != null) {
    parts.push(`> $${sub.target_price_above}`);
  }

  if (sub.target_price_below != null) {
    parts.push(`< $${sub.target_price_below}`);
  }

  if (parts.length === 0) {
    return "—";
  }

  return parts.join(" | ");
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
  const [targetPriceAbove, setTargetPriceAbove] = useState("");
  const [targetPriceBelow, setTargetPriceBelow] = useState("");
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<number | null>(null);

  const debouncedTicker = useDebounce(tickerInput, 500);

  const [tickerValid, setTickerValid] = useState<boolean | null>(null);
  const [isValidatingTicker, setIsValidatingTicker] = useState(false);

  const [tickerError, setTickerError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [aboveError, setAboveError] = useState("");
  const [belowError, setBelowError] = useState("");
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setEditingSubscriptionId(null);
    setTickerInput("");
    setRecipientEmail(user?.email ?? "");
    setTargetPriceAbove("");
    setTargetPriceBelow("");
    setTickerValid(null);
    setTickerError("");
    setEmailError("");
    setAboveError("");
    setBelowError("");
    setFormError("");
  };

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
    setRecipientEmail(user.email);
  }, [user]);

  const loadPrices = async (subs: Subscription[]) => {
    const uniqueTickers = Array.from(new Set(subs.map((sub) => sub.ticker.toUpperCase())));

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
              note: "Price lookup failed.",
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
      } catch {
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
    setAboveError("");
    setBelowError("");
    setFormError("");

    const normalizedTicker = tickerInput.trim().toUpperCase();
    const normalizedEmail = recipientEmail.trim().toLowerCase();

    const parsedAbove =
      targetPriceAbove.trim() === "" ? null : Number(targetPriceAbove);
    const parsedBelow =
      targetPriceBelow.trim() === "" ? null : Number(targetPriceBelow);

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

    if (parsedAbove !== null && (Number.isNaN(parsedAbove) || parsedAbove <= 0)) {
      setAboveError("Upper alert price must be greater than 0.");
      return;
    }

    if (parsedBelow !== null && (Number.isNaN(parsedBelow) || parsedBelow <= 0)) {
      setBelowError("Lower alert price must be greater than 0.");
      return;
    }

    if (
      parsedAbove !== null &&
      parsedBelow !== null &&
      parsedBelow >= parsedAbove
    ) {
      setFormError("Lower alert price must be less than upper alert price.");
      return;
    }

    setIsCreating(true);

    try {
      const payload = {
        ticker: normalizedTicker,
        email: normalizedEmail,
        target_price_above: parsedAbove,
        target_price_below: parsedBelow,
      };

      if (editingSubscriptionId !== null) {
        await updateSubscription(editingSubscriptionId, payload);
        toast.success("Subscription alert updated.");
      } else {
        await createSubscription(payload);
        toast.success("Subscription created.");
      }

      resetForm();
      await loadSubscriptions();
    } catch (error) {
      const message = getApiErrorMessage(error);
      setFormError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (sub: Subscription) => {
    setEditingSubscriptionId(sub.id);
    setTickerInput(sub.ticker);
    setRecipientEmail(sub.email);
    setTargetPriceAbove(
      sub.target_price_above != null ? String(sub.target_price_above) : ""
    );
    setTargetPriceBelow(
      sub.target_price_below != null ? String(sub.target_price_below) : ""
    );
    setTickerValid(true);
    setTickerError("");
    setEmailError("");
    setAboveError("");
    setBelowError("");
    setFormError("");
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
          {editingSubscriptionId !== null && (
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Editing subscription #{editingSubscriptionId}
            </p>
          )}

          <form onSubmit={handleCreate} className="space-y-6">
            <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  placeholder="Ticker"
                  disabled={editingSubscriptionId !== null}
                />
                {isValidatingTicker && (
                  <p className="text-sm text-muted-foreground">Validating ticker...</p>
                )}
                {tickerValid === true && !isValidatingTicker && (
                  <p className="text-sm text-green-600">Ticker looks valid.</p>
                )}
                {tickerError && <p className="text-sm text-red-600">{tickerError}</p>}
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
                  disabled
                />
                {emailError && <p className="text-sm text-red-600">{emailError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_price_above">Alert Above</Label>
                <Input
                  id="target_price_above"
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetPriceAbove}
                  onChange={(e) => {
                    setTargetPriceAbove(e.target.value);
                    setAboveError("");
                    setFormError("");
                  }}
                  placeholder="Optional"
                />
                {aboveError && <p className="text-sm text-red-600">{aboveError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_price_below">Alert Below</Label>
                <Input
                  id="target_price_below"
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetPriceBelow}
                  onChange={(e) => {
                    setTargetPriceBelow(e.target.value);
                    setBelowError("");
                    setFormError("");
                  }}
                  placeholder="Optional"
                />
                {belowError && <p className="text-sm text-red-600">{belowError}</p>}
              </div>
            </div>

            <div className="flex justify-center">
              <div className="flex w-full max-w-md gap-3">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={!canSubmit}
                >
                  {isCreating
                    ? editingSubscriptionId !== null
                      ? "Saving..."
                      : "Creating..."
                    : editingSubscriptionId !== null
                      ? "Save Alert"
                      : "Create Subscription"}
                </Button>

                {editingSubscriptionId !== null && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {formError && (
              <div className="flex justify-center">
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
            <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Ticker</th>
                    <th className="px-4 py-3 text-left font-medium">Current Price</th>
                    <th className="px-4 py-3 text-left font-medium">Recipient Email</th>
                    <th className="px-4 py-3 text-left font-medium">Alert</th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-left font-medium">Owner</th>
                    )}
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
                              <div className="flex flex-col gap-1">
                                <span className="font-medium">${priceData.price.toFixed(2)}</span>

                                {priceData.source === "yfinance" && (
                                  <span className="text-xs text-green-600">Yahoo Finance</span>
                                )}

                                {priceData.source === "mock" && (
                                  <span className="text-xs text-amber-600">Mock fallback</span>
                                )}

                                {priceData.note && (
                                  <span className="text-xs text-muted-foreground">
                                    {priceData.note}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-red-600">Invalid ticker</span>
                                {priceData.note && (
                                  <span className="text-xs text-muted-foreground">
                                    {priceData.note}
                                  </span>
                                )}
                              </div>
                            )
                          ) : (
                            <div className="flex flex-col gap-1">
                              <Skeleton className="h-4 w-20" />
                              <span className="text-xs text-muted-foreground">Loading price...</span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">{sub.email}</td>

                        <td className="px-4 py-3">{formatAlert(sub)}</td>

                        {isAdmin && (
                          <td className="px-4 py-3">{sub.user_email ?? "-"}</td>
                        )}

                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(sub)}
                              disabled={isRowBusy}
                            >
                              Edit Alert
                            </Button>

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