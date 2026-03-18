import axios from "axios";
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "../stores/authStore";
import type { RefreshResponse } from "../types/auth";
import { getRefreshPromise, setRefreshPromise } from "../utils/tokenRefresh";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = useAuthStore.getState().accessToken;

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

const refreshAccessToken = async (): Promise<string | null> => {
  const { refreshToken, logout, setTokens } = useAuthStore.getState();

  if (!refreshToken) {
    logout();
    return null;
  }

  try {
    const response = await axios.post<RefreshResponse>(
      `${API_BASE_URL}/api/auth/refresh/`,
      {
        refresh: refreshToken,
      }
    );

    const newAccessToken = response.data.access;

    // keep same refresh token
    setTokens(newAccessToken, refreshToken);

    return newAccessToken;
  } catch {
    logout();
    return null;
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    let refreshPromise = getRefreshPromise();

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken();
      setRefreshPromise(refreshPromise);
    }

    const newAccessToken = await refreshPromise;

    if (getRefreshPromise() === refreshPromise) {
      setRefreshPromise(null);
    }

    if (!newAccessToken) {
      return Promise.reject(error);
    }

    originalRequest.headers = originalRequest.headers ?? {};
    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

    return api(originalRequest);
  }
);

// typed helpers
export const get = async <T>(url: string): Promise<T> => {
  const response: AxiosResponse<T> = await api.get(url);
  return response.data;
};

export const post = async <TResponse, TRequest = unknown>(
  url: string,
  data?: TRequest
): Promise<TResponse> => {
  const response: AxiosResponse<TResponse> = await api.post(url, data);
  return response.data;
};

export const del = async <TResponse = void>(url: string): Promise<TResponse> => {
  const response: AxiosResponse<TResponse> = await api.delete(url);
  return response.data;
};