import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";

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
        const { data } = await api.post("/auth/resend-verification");
        setVerificationUrl(data.verificationUrl);
        setSent(true);
      }
    } catch (caught) {
      setError((caught as { response?: { data?: { message?: string } } }).response?.data?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <section className="rounded-cards bg-paper-white p-8 shadow-sm">
        <h1 className="mb-4 text-heading-sm font-bold">Confirm your email</h1>
        {verified && <p role="status">Email confirmed. Sign in to continue.</p>}
        {!verified && !token && (
          <p role="status">
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
          <Link className="mt-4 block text-indigo-bolt" to={verificationUrl} state={{ returnTo: registration?.returnTo }}>Open local verification link</Link>
        )}
        {error && <p className="form-error mt-4" role="alert">{error}</p>}
        {!verified && (token || signedIn) && (
          <button className="mt-5 w-full rounded-buttons bg-indigo-bolt px-5 py-3 font-bold text-white" onClick={submit} disabled={busy}>
            {token ? "Confirm email" : "Send another verification email"}
          </button>
        )}
        {token && error && signedIn && (
          <Link className="mt-4 block text-indigo-bolt" to="/verify-email" onClick={() => setError("")}>Request a new link</Link>
        )}
        <Link className="mt-5 block text-center text-sm text-indigo-bolt" to="/login" state={{ returnTo: registration?.returnTo }}>Sign in</Link>
      </section>
    </main>
  );
}
