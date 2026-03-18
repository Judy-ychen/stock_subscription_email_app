export type UserProfile = {
  id: number;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
};

export type LoginResponse = {
  access: string;
  refresh: string;
};

export type RefreshResponse = {
  access: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  password_confirm?: string;
};

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;

  setTokens: (access: string, refresh: string) => void;
  setUser: (user: UserProfile | null) => void;
  loginSuccess: (access: string, refresh: string, user: UserProfile) => void;
  logout: () => void;
};