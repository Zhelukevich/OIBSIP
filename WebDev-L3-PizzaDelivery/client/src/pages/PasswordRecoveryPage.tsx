import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../services/api";
import "../styles/auth.css";

const recoverySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

const resetSchema = z.object({
  password: z.string().min(8, "Enter at least 8 characters."),
  confirmation: z.string(),
}).refine(({ password, confirmation }) => password === confirmation, {
  path: ["confirmation"],
  message: "Passwords do not match.",
});

function RecoveryCard({ title, children }: { title: string; children: ReactNode }) {
  const { state } = useLocation();
  return (
    <main className="store-container auth-page">
      <Link className="store-text-link auth-back" to="/login" state={state}>Back to sign in</Link>
      <section className="auth-card" aria-labelledby="recovery-title">
        <div className="auth-photo" aria-hidden="true" />
        <div className="auth-card__body">
          <h1 id="recovery-title">{title}</h1>
          {children}
        </div>
      </section>
    </main>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [requestError, setRequestError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof recoverySchema>>({
    resolver: zodResolver(recoverySchema),
  });

  async function submit(values: z.infer<typeof recoverySchema>) {
    setRequestError("");
    try {
      await api.post("/auth/forgot-password", values);
      setSent(true);
    } catch (error) {
      setRequestError(isAxiosError(error) && error.response?.status === 503
        ? "Password reset email is unavailable. Try again later."
        : "We couldn't request a reset link. Please try again.");
    }
  }

  return (
    <RecoveryCard title={sent ? "Check your inbox" : "Forgot your password?"}>
      {sent ? (
        <p className="auth-intro" role="status">If an account matches that email address, you'll receive a password reset link.</p>
      ) : (
        <>
          <p className="auth-intro">Enter your account email to request a password reset link.</p>
          <form className="auth-form" noValidate onSubmit={handleSubmit(submit)}>
            <div className="auth-field">
              <label htmlFor="recovery-email">Email address</label>
              <input id="recovery-email" type="email" autoComplete="email" autoCapitalize="none" required
                aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "recovery-email-error" : undefined}
                {...register("email")} />
              {errors.email && <p id="recovery-email-error" className="auth-field-error" role="alert">{errors.email.message}</p>}
            </div>
            {requestError && <p className="auth-request-error" role="alert">{requestError}</p>}
            <button className="store-button auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      )}
    </RecoveryCard>
  );
}

export function ResetPasswordPage() {
  const { hash, state } = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(hash.slice(1)).get("token") ?? "";
  const [invalidLink, setInvalidLink] = useState(false);
  const [requestError, setRequestError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
  });

  async function submit({ password }: z.infer<typeof resetSchema>) {
    setRequestError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      navigate("/login", { replace: true, state: { returnTo: state?.returnTo, passwordReset: true } });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 400) {
        setInvalidLink(true);
        return;
      }
      setRequestError("We couldn't update your password. Please try again.");
    }
  }

  return (
    <RecoveryCard title="Choose a new password">
      {invalidLink || !/^[a-f0-9]{64}$/.test(token) ? (
        <div className="auth-form">
          <p className="auth-request-error" role="alert">This password reset link is invalid or has expired.</p>
          <Link className="store-button auth-submit" to="/forgot-password" state={state}>Request a new link</Link>
        </div>
      ) : (
        <form className="auth-form" noValidate onSubmit={handleSubmit(submit)}>
          <div className="auth-field">
            <label htmlFor="reset-password">New password</label>
            <input id="reset-password" type="password" autoComplete="new-password" required
              aria-invalid={Boolean(errors.password)} aria-describedby="reset-password-help" {...register("password")} />
            <p id="reset-password-help" className={errors.password ? "auth-field-error" : "auth-field-hint"}
              role={errors.password ? "alert" : undefined}>{errors.password?.message ?? "Use at least 8 characters."}</p>
          </div>
          <div className="auth-field">
            <label htmlFor="reset-confirmation">Confirm new password</label>
            <input id="reset-confirmation" type="password" autoComplete="new-password" required
              aria-invalid={Boolean(errors.confirmation)} aria-describedby={errors.confirmation ? "reset-confirmation-error" : undefined}
              {...register("confirmation")} />
            {errors.confirmation && <p id="reset-confirmation-error" className="auth-field-error" role="alert">{errors.confirmation.message}</p>}
          </div>
          {requestError && <p className="auth-request-error" role="alert">{requestError}</p>}
          <button className="store-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </RecoveryCard>
  );
}
