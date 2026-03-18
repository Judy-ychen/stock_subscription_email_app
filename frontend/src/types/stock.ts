export type StockValidationResponse = {
  ticker: string;
  valid: boolean;
};

export type StockPriceResponse = {
  ticker: string;
  price: number | null;
  source: "yfinance" | "mock" | "cache" | string;
};

export type StockSnapshotResponse = {
  ticker: string;
  price: number;
  previous_close: number;
  source: "yfinance" | "mock" | string;
};