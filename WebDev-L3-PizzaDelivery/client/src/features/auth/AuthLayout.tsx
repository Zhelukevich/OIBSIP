import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import "../../styles/auth.css";

export function AuthLayout({
  title, backTo, backLabel, backState, children,
}: {
  title: string;
  backTo: string;
  backLabel: string;
  backState?: unknown;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <PageContainer className="auth-page">
      <Link className="action-link auth-back" to={backTo} state={backState}>
        <span aria-hidden="true">←</span> {backLabel}
      </Link>
      <section className="auth-card" aria-labelledby={titleId}>
        <div className="auth-photo" aria-hidden="true" />
        <div className="auth-card__body">
          <h1 id={titleId}>{title}</h1>
          {children}
        </div>
      </section>
    </PageContainer>
  );
}
