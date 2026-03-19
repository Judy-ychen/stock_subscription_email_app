import { useState } from "react";
import { registerUser } from "../../lib/authApi";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

function getApiErrorMessage(error: unknown): string {
  const fallback = "Registration failed.";

  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response
  ) {
    const data = error.response.data as Record<string, unknown>;

    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return String(data.non_field_errors[0]);
    }

    for (const value of Object.values(data)) {
      if (Array.isArray(value) && value.length > 0) {
        return String(value[0]);
      }
    }

    if (typeof data.detail === "string") {
      return data.detail;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

type RegisterFormProps = {
  onSuccess?: (registeredEmail: string) => void;
  onBackToLogin?: () => void;
};

export default function RegisterForm({
  onSuccess,
  onBackToLogin,
}: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!email.trim()) {
      setErrorMessage("Email is required.");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Password is required.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await registerUser({
        email: email.trim().toLowerCase(),
        password,
        password2: passwordConfirm,
      });

      setSuccessMessage("Registration succeeded. You can now log in.");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");

      if (onSuccess) {
        onSuccess(email.trim().toLowerCase());
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>
          Register a new account for the stock subscription app.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="register-email">Email</Label>
            <Input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-password">Password</Label>
            <Input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-password-confirm">Confirm Password</Label>
            <Input
              id="register-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => {
                setPasswordConfirm(e.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
            />
          </div>

          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Registering..." : "Register"}
            </Button>

            {onBackToLogin && (
              <Button type="button" variant="outline" onClick={onBackToLogin}>
                Back to Login
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}