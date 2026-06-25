import type { ReactNode } from "react";
import styles from "./AuthShell.module.css";

type AuthShellProps = {
  children: ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header} aria-label="RSL Internet Collective">
        <a href="https://rslcollective.org/" aria-label="Go to RSL Collective home">
          <img
            className={styles.logo}
            src="/brand/rsl-internet-collective-logo.svg"
            alt="RSL Internet Collective"
          />
        </a>
      </header>

      <section className={styles.authFrame} aria-label="RSL Internet Collective authentication">
        {children}
      </section>
    </main>
  );
}

export const clerkAuthAppearance = {
  elements: {
    logoBox: {
      display: "none"
    },
    logoImage: {
      display: "none"
    },
    socialButtons: {
      display: "grid",
      gap: "0.75rem",
      gridTemplateColumns: "1fr"
    },
    socialButtonsBlockButton: {
      width: "100%"
    }
  }
};
