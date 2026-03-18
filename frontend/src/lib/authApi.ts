import { post, api } from "./api";
import { useAuthStore } from "../stores/authStore";
import type { LoginResponse, RegisterRequest, UserProfile } from "../types/auth";

export const registerUser = async (payload: RegisterRequest) => {
  return post<UserProfile | Record<string, unknown>, RegisterRequest>(
    "/api/auth/register/",
    payload
  );
};

export const fetchCurrentUser = async () => {
  const response = await api.get<UserProfile>("/api/auth/me/");
  useAuthStore.getState().setUser(response.data);
  return response.data;
};

export const loginUser = async (email: string, password: string) => {
  const loginResponse = await api.post<LoginResponse>("/api/auth/login/", {
    email,
    password,
  });

  const { access, refresh } = loginResponse.data;

  useAuthStore.getState().setTokens(access, refresh);

  try {
    const meResponse = await api.get<UserProfile>("/api/auth/me/");
    const user = meResponse.data;

    useAuthStore.getState().loginSuccess(access, refresh, user);

    return {
      access,
      refresh,
      user,
    };
  } catch (error) {
    useAuthStore.getState().logout();
    throw error;
  }
};

export const logoutUser = () => {
  useAuthStore.getState().logout();
};