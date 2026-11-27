import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, ButtonLink } from "../components/Button";
import { AuthLayout } from "../features/auth/AuthLayout";
import { api, apiErrorMessage } from "../services/api";

type RegistrationNotice = {
  registered?: boolean;
  deliveryFailed?: boolean;
  verificationUrl?: string;
  returnTo?: string;
};

export function VerifyEmailPage({ signedIn }: { signedIn: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const registration = location.state as RegistrationNotice | null;
  const returnTo = registration?.returnTo === "/checkout" ? "/checkout" : "/";
  const token = new URLSearchParams(location.hash.slice(1)).get("token");
  const [verificationUrl, setVerificationUrl] = useState(registration?.verificationUrl);
  const [verified, setVerified] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (token) {
        await api.post("/auth/verify-email", { token });
        setVerified(true);
        navigate("/verify-email", { replace: true, state: { returnTo: registration?.returnTo } });
      } else {
        const { data } = await api.post<{ verificationUrl?: string }>("/auth/resend-verification");
        setVerificationUrl(data.verificationUrl);
        setSent(true);
      }
    } catch (caught) {
      setError(apiErrorMessage(caught, "Request failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Confirm your email"
      backTo={returnTo}
      backLabel={returnTo === "/checkout" ? "Back to your cart" : "Back to menu"}
    >
      <div className="auth-form">
        {verified && <p className="text-muted" role="status">Email confirmed. Sign in to continue.</p>}
        {!verified && !token && (
          <p className="text-muted" role="status">
            {registration?.deliveryFailed && !sent
              ? "Your account was created. Sign in to request another verification email."
              : verificationUrl
                ? "Open the local verification link below."
                : registration?.registered || sent
                  ? "Check your inbox for the verification link."
                  : "Use the link in your inbox to confirm your address."}
          </p>
        )}
        {!verified && !token && verificationUrl && (
          <Link className="action-link justify-self-start" to={verificationUrl} state={{ returnTo }}>Open local verification link</Link>
        )}
        {error && <p className="auth-request-error" role="alert">{error}</p>}
        {!verified && (token || signedIn) && (
          <Button onClick={submit} disabled={busy}>
            {token ? "Confirm email" : "Send another verification email"}
          </Button>
        )}
        {token && error && signedIn && (
          <Link className="action-link justify-self-start" to="/verify-email" state={{ returnTo }} onClick={() => setError("")}>Request a new link</Link>
        )}
        <ButtonLink variant={verified ? "primary" : "outline"} to="/login" state={{ returnTo }}>Sign in</ButtonLink>
      </div>
    </AuthLayout>
  );
}
