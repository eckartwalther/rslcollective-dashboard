import onboardingMarkdown from "../../content/onboard.md?raw";
import { MarkdownDocument, getMarkdownHeadings } from "./MarkdownDocument";
import styles from "./OnboardingGuide.module.css";

const headings = getMarkdownHeadings(onboardingMarkdown);

export function OnboardingGuide() {
  return (
    <div className={styles.docsPage} data-testid="onboarding-doc-layout">
      <div className={styles.docsLayout}>
        <main className={styles.docsMain}>
          <MarkdownDocument markdown={onboardingMarkdown} />
        </main>
        <aside className={styles.docsToc} aria-label="On this page">
          <p className={styles.docsTocTitle}>On this page</p>
          <nav className={styles.docsTocList}>
            {headings.map((heading) => (
              <a
                key={heading.id}
                className={`${styles.docsTocLink} ${
                  heading.level === 3 ? styles.docsTocSubLink : ""
                }`}
                href={`#${heading.id}`}
              >
                {heading.text}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}
