import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button, ButtonLink } from "../components/Button";
import { FormField } from "../components/FormField";
import { AuthLayout } from "../features/auth/AuthLayout";
import { api } from "../services/api";

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

export function ForgotPasswordPage() {
  const { state } = useLocation();
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
    <AuthLayout title={sent ? "Check your inbox" : "Forgot your password?"} backTo="/login" backLabel="Back to sign in" backState={state}>
      {sent ? (
        <p className="auth-intro" role="status">If an account matches that email address, you'll receive a password reset link.</p>
      ) : (
        <>
          <p className="auth-intro">Enter your account email to request a password reset link.</p>
          <form className="auth-form" noValidate onSubmit={handleSubmit(submit)}>
            <FormField
              label="Email address"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              error={errors.email?.message}
              {...register("email")}
            />
            {requestError && <p className="auth-request-error" role="alert">{requestError}</p>}
            <Button className="mt-1" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
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
    <AuthLayout title="Choose a new password" backTo="/login" backLabel="Back to sign in" backState={state}>
      {invalidLink || !/^[a-f0-9]{64}$/.test(token) ? (
        <div className="auth-form">
          <p className="auth-request-error" role="alert">This password reset link is invalid or has expired.</p>
          <ButtonLink className="mt-1" to="/forgot-password" state={state}>Request a new link</ButtonLink>
        </div>
      ) : (
        <form className="auth-form" noValidate onSubmit={handleSubmit(submit)}>
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            error={errors.password?.message}
            hint="Use at least 8 characters."
            {...register("password")}
          />
          <FormField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            error={errors.confirmation?.message}
            {...register("confirmation")}
          />
          {requestError && <p className="auth-request-error" role="alert">{requestError}</p>}
          <Button className="mt-1" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
