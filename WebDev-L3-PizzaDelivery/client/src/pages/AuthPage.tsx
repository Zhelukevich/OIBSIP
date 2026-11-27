import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { AuthLayout } from "../features/auth/AuthLayout";
import { api, apiErrorMessage } from "../services/api";
import type { User } from "../types";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Enter at least 8 characters."),
  name: z.string().trim().optional(),
});

const registerSchema = loginSchema.refine(({ name }) => Boolean(name && name.length >= 2), {
  path: ["name"],
  message: "Enter at least 2 characters.",
});

export function AuthPage({ mode, onAuth }: {
  mode: "login" | "register";
  onAuth: (user: User, token: string) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo === "/checkout" ? "/checkout" : "/";
  const isRegistration = mode === "register";
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(isRegistration ? registerSchema : loginSchema),
  });
  const [requestError, setRequestError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit({ name, email, password }: z.infer<typeof loginSchema>) {
    try {
      if (isRegistration) {
        const { data } = await api.post<{ verificationUrl?: string; verificationDeliveryFailed?: boolean }>("/auth/register", { name, email, password });
        navigate("/verify-email", { state: {
          verificationUrl: data.verificationUrl,
          deliveryFailed: data.verificationDeliveryFailed,
          registered: true,
          returnTo,
        } });
        return;
      }

      const { data } = await api.post<{ user: User; token: string }>("/auth/login", { email, password });
      onAuth(data.user, data.token);
      const destination = data.user.emailVerified
        ? returnTo === "/" && data.user.role === "admin" ? "/admin" : returnTo
        : "/verify-email";
      navigate(destination, { state: { returnTo } });
    } catch (caught) {
      setRequestError(apiErrorMessage(caught, "Something went wrong. Please try again."));
    }
  }

  return (
    <AuthLayout
      title={isRegistration ? "Create your account" : "Welcome back"}
      backTo={returnTo}
      backLabel={returnTo === "/checkout" ? "Back to your cart" : "Back to menu"}
    >
      {!isRegistration && location.state?.passwordReset && (
        <p className="auth-intro" role="status">Password updated. Sign in with your new password.</p>
      )}
      <p className="auth-intro">
        {isRegistration ? "We’ll send you a link to confirm your email."
          : returnTo === "/checkout" ? "Sign in to continue with your order."
          : "Sign in to order pizza and track your orders."}
      </p>

      <form className="auth-form" noValidate onSubmit={(event) => {
        setRequestError("");
        void handleSubmit(submit)(event);
      }}>
        {isRegistration && (
          <FormField label="Name" autoComplete="name" required error={errors.name?.message} {...register("name")} />
        )}
        <FormField
          label="Email address"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          id="auth-password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete={isRegistration ? "new-password" : "current-password"}
          autoCapitalize="none"
          spellCheck={false}
          required
          error={errors.password?.message}
          hint={isRegistration ? "Use at least 8 characters." : undefined}
          endAdornment={
            <button
              className="auth-password-toggle"
              type="button"
              aria-controls="auth-password"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          }
          {...register("password")}
        />
        {!isRegistration && (
          <Link className="action-link justify-self-start" to="/forgot-password" state={{ returnTo }}>Forgot your password?</Link>
        )}
        {requestError && <p className="auth-request-error" role="alert">{requestError}</p>}
        <Button className="mt-1" type="submit" disabled={isSubmitting}>
          {isRegistration ? isSubmitting ? "Creating account…" : "Create account"
            : isSubmitting ? "Signing in…" : "Sign in"}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </Button>
      </form>

      <p className="auth-switch">
        {isRegistration ? "Already have an account?" : "New to Slice?"}{" "}
        <Link className="action-link" to={isRegistration ? "/login" : "/register"} state={{ returnTo }}>
          {isRegistration ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </AuthLayout>
  );
}
