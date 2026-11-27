import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../services/api";
import type { User } from "../types";
import "../styles/auth.css";

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
  const passwordDescription = errors.password ? "auth-password-error" : isRegistration ? "auth-password-hint" : undefined;

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
      const message = (caught as { response?: { data?: { message?: string } } }).response?.data?.message;
      setRequestError(message || "Something went wrong. Please try again.");
    }
  }

  return (
    <main className="store-container auth-page">
      <Link className="store-text-link auth-back" to={returnTo}>
        <span aria-hidden="true">←</span> {returnTo === "/checkout" ? "Back to your cart" : "Back to menu"}
      </Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-photo" aria-hidden="true" />
        <div className="auth-card__body">
          <h1 id="auth-title">{isRegistration ? "Create your account" : "Welcome back"}</h1>
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
              <div className="auth-field">
                <label htmlFor="auth-name">Name</label>
                <input id="auth-name" autoComplete="name" required aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "auth-name-error" : undefined} {...register("name")} />
                {errors.name && <p className="auth-field-error" id="auth-name-error" role="alert">{errors.name.message}</p>}
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>
              <input id="auth-email" type="email" autoComplete="email" autoCapitalize="none" required aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "auth-email-error" : undefined} {...register("email")} />
              {errors.email && <p className="auth-field-error" id="auth-email-error" role="alert">{errors.email.message}</p>}
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-password">
                <input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={isRegistration ? "new-password" : "current-password"}
                  autoCapitalize="none" spellCheck={false} required aria-invalid={Boolean(errors.password)}
                  aria-describedby={passwordDescription} {...register("password")} />
                <button type="button" aria-controls="auth-password" aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</button>
              </div>
              {errors.password ? <p className="auth-field-error" id="auth-password-error" role="alert">{errors.password.message}</p>
                : isRegistration && <p className="auth-field-hint" id="auth-password-hint">Use at least 8 characters.</p>}
            </div>
            {requestError && <p className="auth-request-error" role="alert">{requestError}</p>}
            <button className="store-button auth-submit" type="submit" disabled={isSubmitting}>
              {isRegistration ? isSubmitting ? "Creating account…" : "Create account"
                : isSubmitting ? "Signing in…" : "Sign in"}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="auth-switch">
            {isRegistration ? "Already have an account?" : "New to Slice?"}{" "}
            <Link className="store-text-link" to={isRegistration ? "/login" : "/register"} state={{ returnTo }}>
              {isRegistration ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
