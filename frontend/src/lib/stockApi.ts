import { get } from "./api";

import type {
  StockPriceResponse,
  StockValidationResponse,
} from "../types/stock";

export const validateTicker = async (
  ticker: string
): Promise<StockValidationResponse> => {
  return get<StockValidationResponse>(
    `/api/stocks/validate/${encodeURIComponent(ticker)}/`
  );
};

export const fetchStockPrice = async (
  ticker: string
): Promise<StockPriceResponse> => {
  return get<StockPriceResponse>(
    `/api/stocks/price/${encodeURIComponent(ticker)}/`
  );
};