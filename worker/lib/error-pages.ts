import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type AuthErrorPageOptions = {
  title: string;
  message: string;
  status?: ContentfulStatusCode;
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
};

export function authErrorPage(c: Context, options: AuthErrorPageOptions) {
  return c.html(renderAuthErrorPage(options), options.status ?? 400);
}

export function signInLinkExpiredPage(c: Context) {
  return authErrorPage(c, {
    title: "Sign-in link expired",
    message:
      "This sign-in session expired or could not be verified. Start sign-in again to continue.",
    primaryAction: {
      label: "Sign in again",
      href: "/login"
    },
    secondaryAction: {
      label: "Create an account",
      href: "/register"
    }
  });
}

export function authenticationCouldNotCompletePage(c: Context, status: ContentfulStatusCode = 400) {
  return authErrorPage(c, {
    title: "Authentication could not be completed",
    message: "Start sign-in again to continue.",
    status,
    primaryAction: {
      label: "Sign in again",
      href: "/login"
    },
    secondaryAction: {
      label: "Create an account",
      href: "/register"
    }
  });
}

export function emailVerificationRequiredPage(c: Context) {
  return authErrorPage(c, {
    title: "Email verification required",
    message: "Please verify your email address, then sign in again.",
    primaryAction: {
      label: "Sign in again",
      href: "/login"
    }
  });
}

function renderAuthErrorPage(options: AuthErrorPageOptions) {
  const secondaryAction = options.secondaryAction
    ? `<a class="secondary-action" href="${escapeHtml(options.secondaryAction.href)}">${escapeHtml(options.secondaryAction.label)}</a>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)} | RSL Internet Collective</title>
    <style>
      :root {
        color-scheme: light;
        --rsl-blue: #2454a6;
        --rsl-blue-dark: #173d7a;
        --rsl-text: #182230;
        --rsl-muted: #667085;
        --rsl-border: #d9e2f2;
        --rsl-bg: #f6f8fb;
      }

      * {
        box-sizing: border-box;
      }

      body {
        min-height: 100vh;
        margin: 0;
        color: var(--rsl-text);
        background: var(--rsl-bg);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px 20px;
      }

      .panel {
        width: min(100%, 520px);
        border: 1px solid var(--rsl-border);
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 18px 44px rgba(24, 34, 48, 0.08);
        padding: 32px;
      }

      .brand {
        color: var(--rsl-blue-dark);
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0;
        margin-bottom: 28px;
      }

      h1 {
        font-size: 28px;
        line-height: 1.2;
        margin: 0 0 12px;
      }

      p {
        color: var(--rsl-muted);
        font-size: 16px;
        line-height: 1.55;
        margin: 0;
      }

      .actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }

      a {
        min-height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
      }

      .primary-action {
        color: #ffffff;
        background: var(--rsl-blue);
      }

      .primary-action:hover {
        background: var(--rsl-blue-dark);
      }

      .secondary-action {
        color: var(--rsl-blue-dark);
        border: 1px solid var(--rsl-border);
        background: #ffffff;
      }

      @media (max-width: 520px) {
        .panel {
          padding: 24px;
        }

        .actions {
          align-items: stretch;
          flex-direction: column;
        }

        a {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel" aria-labelledby="auth-error-title">
        <div class="brand">RSL Internet Collective</div>
        <h1 id="auth-error-title">${escapeHtml(options.title)}</h1>
        <p>${escapeHtml(options.message)}</p>
        <div class="actions">
          <a class="primary-action" href="${escapeHtml(options.primaryAction.href)}">${escapeHtml(options.primaryAction.label)}</a>
          ${secondaryAction}
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
