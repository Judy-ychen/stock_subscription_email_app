import { useState } from "react";
import { Toaster } from "sonner";

import RegisterForm from "./components/auth/RegisterForm";
import { loginUser, logoutUser } from "./lib/authApi";
import { useAuthStore } from "./stores/authStore";
import SubscriptionDashboard from "./components/subscriptions/SubscriptionDashboard";

import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

function App() {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("12345678");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginSuccessMessage, setLoginSuccessMessage] = useState("");

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      await loginUser(email, password);
      setLoginSuccessMessage("");
    } catch {
      setLoginError("Login failed. Please check your credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setLoginError("");
    setLoginSuccessMessage("");
    setPassword("");
    setAuthMode("login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40 text-foreground">
      <Toaster richColors position="top-right" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 md:px-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <header className="relative z-10 mb-8 rounded-3xl border border-border/70 bg-background/85 px-6 py-6 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="h-[50px] text-center rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold tracking-wider text-slate-800">
              DEMO PROJECT
            </div>

            {isAuthenticated && (
              <div className="flex items-center gap-3">
                <div className="h-[50px] text-center rounded-xl border border-border bg-background px-4 py-3 shadow-sm">
                  <p className="text-center text-base font-semibold text-slate-900 truncate">
                    {user?.email}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="h-[50px] py-3 text-base rounded-xl"
                >
                  Logout
                </Button>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-center">
            <h1 className="text-center text-5xl font-bold tracking-tight text-black md:text-6xl whitespace-nowrap"
            style={{ color: "#111111" }}>
              Stock Subscription App
            </h1>
          </div>

          <p className="mt-10 text-center text-base font-medium text-slate-600 dark:text-slate-300 md:text-xl">
            Track tickers, manage subscriptions, and receive AI-generated stock update emails.
          </p>
        </header>

        {!isAuthenticated ? (
          <main className="flex flex-1 items-center justify-center">
            {authMode === "login" ? (
              <Card className="w-full max-w-md rounded-3xl border border-border/70 shadow-xl backdrop-blur">
                <CardHeader className="space-y-4 pb-4">
                  <div className="flex justify-center">
                    <div className="rounded-xl bg-primary/10 px-3 py-1 text-sm font-semibold text-foreground">
                      Welcome back
                    </div>
                  </div>

                  <div className="space-y-2 text-center">
                    <CardTitle className="text-3xl md:text-4xl font-bold text-foreground">
                      Login
                    </CardTitle>
                    <CardDescription className="text-base leading-7 text-slate-600 dark:text-slate-300">
                      Sign in to access your stock subscriptions and email alerts.
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label
                        htmlFor="login-email"
                        className="text-base font-semibold text-foreground"
                      >
                        Email
                      </Label>
                      <Input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setLoginError("");
                          setLoginSuccessMessage("");
                        }}
                        className="h-12 rounded-xl text-base"
                        placeholder="Enter your email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="login-password"
                        className="text-base font-semibold text-foreground"
                      >
                        Password
                      </Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setLoginError("");
                          setLoginSuccessMessage("");
                        }}
                        className="h-12 rounded-xl text-base"
                        placeholder="Enter your password"
                      />
                    </div>

                    {loginError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                        {loginError}
                      </div>
                    )}

                    {loginSuccessMessage && (
                      <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-600">
                        {loginSuccessMessage}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        type="submit"
                        className="h-12 flex-1 rounded-xl text-base"
                        disabled={isLoggingIn}
                      >
                        {isLoggingIn ? "Logging in..." : "Login"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-xl text-base"
                        onClick={() => {
                          setAuthMode("register");
                          setLoginError("");
                          setLoginSuccessMessage("");
                        }}
                      >
                        Create account
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <div className="w-full max-w-md">
                <RegisterForm
                  onSuccess={(registeredEmail) => {
                    setAuthMode("login");
                    setEmail(registeredEmail);
                    setPassword("");
                    setLoginError("");
                    setLoginSuccessMessage("Registration succeeded. Please log in.");
                  }}
                  onBackToLogin={() => {
                    setAuthMode("login");
                    setLoginError("");
                    setLoginSuccessMessage("");
                  }}
                />
              </div>
            )}
          </main>
        ) : (
          <main className="relative z-10">
            <SubscriptionDashboard />
          </main>
        )}
      </div>
    </div>
  );
}

export default App;