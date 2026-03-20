export type StockValidationResponse = {
  ticker: string;
  valid: boolean;
  reason?: "invalid" | "provider_unavailable" | "mock_mode" | null;
};

export type StockPriceResponse = {
  ticker: string;
  price: number | null;
  source: "yfinance" | "mock" | "cache" | "invalid" | "unavailable";
  note?: string | null;
};

export type StockSnapshotResponse = {
  ticker: string;
  price: number;
  previous_close: number;
  source: "yfinance" | "mock" | string;
};