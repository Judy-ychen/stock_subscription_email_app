import { useState } from "react";
import { Toaster } from "sonner";

import RegisterForm from "./components/auth/RegisterForm";
import { loginUser, logoutUser } from "./lib/authApi";
import { useAuthStore } from "./stores/authStore";
import SubscriptionDashboard from "./components/subscriptions/SubscriptionDashboard";

import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./components/ui/card";
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
    <div className="min-h-screen bg-background p-6 md:p-10">
      <Toaster richColors position="top-right" />

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Stock Subscription App</h1>
            <p className="text-sm text-muted-foreground">
              React + TypeScript + shadcn/ui dashboard
            </p>
          </div>

          {isAuthenticated && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          )}
        </div>

        {!isAuthenticated ? (
          authMode === "login" ? (
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>
                  Sign in to access your subscription dashboard.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setLoginError("");
                        setLoginSuccessMessage("");
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setLoginError("");
                        setLoginSuccessMessage("");
                      }}
                    />
                  </div>

                  {loginError && (
                    <p className="text-sm text-red-600">{loginError}</p>
                  )}

                  {loginSuccessMessage && (
                    <p className="text-sm text-green-600">{loginSuccessMessage}</p>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={isLoggingIn}>
                      {isLoggingIn ? "Logging in..." : "Login"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAuthMode("register");
                        setLoginError("");
                        setLoginSuccessMessage("");
                      }}
                    >
                      Register
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
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
          )
        ) : (
          <SubscriptionDashboard />
        )}
      </div>
    </div>
  );
}

export default App;