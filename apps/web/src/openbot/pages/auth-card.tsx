/*
 * Ported from nightly-labs/openbot packages/ui/src/features/account/AccountLogin.tsx and
 * auth.css (.account-login-shell, .account-login, .account-login-primary) @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * The centred sign-in card: a mark, an optional title, one line, and the actions as full-width
 * 44px buttons. The caller brings its own mark, copy and wallet picker; openbot's logo, wordmark
 * and e-mail form are not part of it.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AuthCard({
  mark,
  title,
  description,
  children,
  foot,
  className,
}: {
  mark?: ReactNode;
  /** Rendered as an h2: a page's own h1 stays its page title. */
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="auth" className={cn("ob-auth", className)}>
      <section data-slot="auth-card" className="ob-auth-card">
        {mark ? <div className="ob-auth-mark">{mark}</div> : null}
        {title ? <h2 className="ob-auth-title">{title}</h2> : null}
        {description ? <p className="ob-auth-description">{description}</p> : null}
        {children ? <div className="ob-auth-actions">{children}</div> : null}
        {foot ? <p className="ob-auth-foot">{foot}</p> : null}
      </section>
    </div>
  );
}
