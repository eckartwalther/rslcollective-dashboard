import type { ReactNode } from "react";
import styles from "./MarkdownDocument.module.css";

type MarkdownDocumentProps = {
  markdown: string;
  skipTitle?: string;
  skipLastUpdated?: boolean;
};

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language: string; value: string };

export function MarkdownDocument({
  markdown,
  skipTitle,
  skipLastUpdated = false
}: MarkdownDocumentProps) {
  const blocks = parseMarkdown(markdown).filter(
    (block) =>
      !(block.type === "heading" && block.level === 1 && block.text === skipTitle) &&
      !(skipLastUpdated && block.type === "paragraph" && block.text.startsWith("Last updated:"))
  );

  return (
    <article className={styles.vpDoc} data-testid="onboarding-article-body">
      {blocks.map((block, blockIndex) => (
        <MarkdownBlock key={`${block.type}-${blockIndex}`} block={block} />
      ))}
    </article>
  );
}

export function getMarkdownTitle(markdown: string) {
  const frontmatterTitle = stripFrontmatter(markdown).frontmatter.match(/^title:\s*"(.+)"\s*$/m)?.[1];

  if (frontmatterTitle) {
    return frontmatterTitle;
  }

  const heading = parseMarkdown(markdown).find(
    (block): block is Extract<Block, { type: "heading" }> =>
      block.type === "heading" && block.level === 1
  );

  return heading?.text;
}

export function getMarkdownLastUpdated(markdown: string) {
  return stripFrontmatter(markdown).body.match(/^Last updated:\s*(.+)$/m)?.[1];
}

export function getMarkdownHeadings(markdown: string) {
  return parseMarkdown(markdown)
    .filter(
      (block): block is Extract<Block, { type: "heading" }> =>
        block.type === "heading" && (block.level === 2 || block.level === 3)
    )
    .map((heading) => ({
      id: headingId(heading.text),
      level: heading.level,
      text: heading.text
    }));
}

function MarkdownBlock({ block }: { block: Block }) {
  if (block.type === "heading") {
    const Heading = `h${block.level}` as "h1" | "h2" | "h3";

    return <Heading id={block.level > 1 ? headingId(block.text) : undefined}>{block.text}</Heading>;
  }

  if (block.type === "paragraph") {
    return <p data-testid="onboarding-article-paragraph">{renderInline(block.text)}</p>;
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";

    return (
      <ListTag data-testid="onboarding-article-list">
        {block.items.map((item) => (
          <li key={item}>{renderInline(item)}</li>
        ))}
      </ListTag>
    );
  }

  return <CodeBlock language={block.language} value={block.value} />;
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  return (
    <pre
      aria-label={language ? `${language} example` : "code example"}
      data-testid="onboarding-code-block"
    >
      <code>{value}</code>
    </pre>
  );
}

function parseMarkdown(markdown: string): Block[] {
  const { body } = stripFrontmatter(markdown);
  const lines = body.split(/\r?\n/);
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = normalizeFenceLanguage(trimmed);
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      blocks.push({
        type: "code",
        language,
        value: codeLines.join("\n")
      });
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2]
      });
      index += 1;
      continue;
    }

    const orderedMatch = trimmed.match(/^\s*\d+\.\s+(.+)$/);

    if (orderedMatch) {
      blocks.push({
        type: "list",
        ordered: true,
        items: collectListItems(lines, index, true)
      });
      index = nextIndexAfterList(lines, index, true);
      continue;
    }

    const unorderedMatch = trimmed.match(/^\s*[-*+]\s+(.+)$/);

    if (unorderedMatch) {
      blocks.push({
        type: "list",
        ordered: false,
        items: collectListItems(lines, index, false)
      });
      index = nextIndexAfterList(lines, index, false);
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const paragraphLine = lines[index] ?? "";
      const paragraphTrimmed = paragraphLine.trim();

      if (
        !paragraphTrimmed ||
        paragraphTrimmed.startsWith("```") ||
        paragraphTrimmed.startsWith("#") ||
        paragraphTrimmed.match(/^\s*(\d+\.|[-*+])\s+/)
      ) {
        break;
      }

      paragraphLines.push(paragraphTrimmed);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" ")
    });
  }

  return blocks;
}

function collectListItems(lines: string[], startIndex: number, ordered: boolean) {
  const items: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const itemMatch = matchListItem(lines[index] ?? "", ordered);

    if (!itemMatch) {
      break;
    }

    items.push(itemMatch[1].trim());
    index += 1;

    const nextContentIndex = nextNonEmptyLineIndex(lines, index);

    if (nextContentIndex === index) {
      continue;
    }

    if (!matchListItem(lines[nextContentIndex] ?? "", ordered)) {
      break;
    }

    index = nextContentIndex;
  }

  return items;
}

function nextIndexAfterList(lines: string[], startIndex: number, ordered: boolean) {
  let index = startIndex;

  while (index < lines.length) {
    if (!matchListItem(lines[index] ?? "", ordered)) {
      break;
    }

    index += 1;

    const nextContentIndex = nextNonEmptyLineIndex(lines, index);

    if (nextContentIndex === index) {
      continue;
    }

    if (!matchListItem(lines[nextContentIndex] ?? "", ordered)) {
      break;
    }

    index = nextContentIndex;
  }

  return index;
}

function matchListItem(line: string, ordered: boolean) {
  return ordered ? line.match(/^\s*\d+\.\s+(.+)$/) : line.match(/^\s*[-*+]\s+(.+)$/);
}

function nextNonEmptyLineIndex(lines: string[], startIndex: number) {
  let index = startIndex;

  while (index < lines.length && !(lines[index] ?? "").trim()) {
    index += 1;
  }

  return index;
}

function stripFrontmatter(markdown: string) {
  if (!markdown.startsWith("---")) {
    return { frontmatter: "", body: markdown };
  }

  const end = markdown.indexOf("\n---", 3);

  if (end === -1) {
    return { frontmatter: "", body: markdown };
  }

  return {
    frontmatter: markdown.slice(3, end).trim(),
    body: markdown.slice(end + 4).trim()
  };
}

function renderInline(text: string) {
  const nodes: ReactNode[] = [];
  const codeParts = text.split(/(`[^`]+`)/g);

  codeParts.forEach((part, index) => {
    if (!part) {
      return;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(<code key={`code-${index}`}>{part.slice(1, -1)}</code>);
      return;
    }

    nodes.push(...renderBold(part, index));
  });

  return nodes;
}

function renderBold(text: string, parentIndex: number) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`bold-${parentIndex}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function normalizeFenceLanguage(fence: string) {
  return fence
    .slice(3)
    .trim()
    .replace(/\s*\{.*\}\s*$/, "")
    .split(/\s+/)[0] ?? "";
}

function headingId(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
