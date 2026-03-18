let refreshPromise: Promise<string | null> | null = null;

export const getRefreshPromise = (): Promise<string | null> | null => refreshPromise;

export const setRefreshPromise = (promise: Promise<string | null> | null) => {
  refreshPromise = promise;
};