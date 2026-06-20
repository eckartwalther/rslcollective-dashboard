import { render, screen, within } from "@testing-library/react";
import { MarkdownDocument } from "../src/components/dashboard/MarkdownDocument";
import onboardingMarkdown from "../src/content/onboard.md?raw";

const removedSummaryLabel = ["Onboarding", "summary"].join(" ");

describe("MarkdownDocument", () => {
  it("renders consecutive ordered lines as one ordered list", () => {
    const { container } = render(<MarkdownDocument markdown={"1. First\n2. Second\n3. Third"} />);
    const orderedLists = container.querySelectorAll("ol");
    const items = within(orderedLists[0]).getAllByRole("listitem");

    expect(orderedLists).toHaveLength(1);
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.textContent)).toEqual(["First", "Second", "Third"]);
  });

  it("renders consecutive unordered lines as one unordered list", () => {
    const { container } = render(<MarkdownDocument markdown={"* Alpha\n* Beta\n* Gamma"} />);
    const unorderedLists = container.querySelectorAll("ul");
    const items = within(unorderedLists[0]).getAllByRole("listitem");

    expect(unorderedLists).toHaveLength(1);
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.textContent)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("renders the onboarding workflow as a single ordered list", () => {
    const { container } = render(<MarkdownDocument markdown={onboardingMarkdown} />);
    const orderedLists = Array.from(container.querySelectorAll("ol"));
    const workflowList = orderedLists.find((list) =>
      within(list).queryByText(
        /The publisher defines the content it wants to make available by publishing one or more RSL files/
      )
    );

    expect(workflowList).toBeTruthy();

    const items = within(workflowList as HTMLOListElement).getAllByRole("listitem");

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(
      "The publisher defines the content it wants to make available"
    );
    expect(items[1]).toHaveTextContent("The publisher makes those RSL files discoverable");
    expect(items[2]).toHaveTextContent("The publisher enrolls each website or subdomain root");
  });

  it("renders the readiness checklist as a single unordered list", () => {
    const { container } = render(<MarkdownDocument markdown={onboardingMarkdown} />);
    const unorderedLists = Array.from(container.querySelectorAll("ul"));
    const checklist = unorderedLists.find((list) =>
      within(list).queryByText(
        "Published one or more RSL declarations that reference the RSL Collective License."
      )
    );

    expect(checklist).toBeTruthy();

    const items = within(checklist as HTMLUListElement).getAllByRole("listitem");

    expect(items.length).toBeGreaterThanOrEqual(9);
    expect(items[0]).toHaveTextContent(
      "Published one or more RSL declarations that reference the RSL Collective License."
    );
    expect(items[items.length - 1]).toHaveTextContent(
      "Confirmed who will handle enrollment: your Enrollment Partner or your internal team."
    );
  });

  it("hides frontmatter and code fence annotations", () => {
    render(<MarkdownDocument markdown={onboardingMarkdown} />);

    expect(screen.queryByText(removedSummaryLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(/lastUpdated:\s*true/)).not.toBeInTheDocument();
    expect(screen.queryByText(/outline:\s*\[2,3\]/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\{1,10\}/)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("xml example").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("html example").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("text example").length).toBeGreaterThan(0);
  });
});
