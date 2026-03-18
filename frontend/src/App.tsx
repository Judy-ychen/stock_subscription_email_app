import { useState } from "react";
import { Toaster } from "sonner";

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

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      await loginUser(email, password);
    } catch {
      setLoginError("Login failed. Please check your credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
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
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {loginError && (
                  <p className="text-sm text-red-600">{loginError}</p>
                )}

                <Button type="submit" className="w-full" disabled={isLoggingIn}>
                  {isLoggingIn ? "Logging in..." : "Login"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <SubscriptionDashboard />
        )}
      </div>
    </div>
  );
}

export default App;