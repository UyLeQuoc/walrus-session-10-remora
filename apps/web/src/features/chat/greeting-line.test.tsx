import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Greeting } from "./greeting";
import { greetingText } from "./greeting";
import { GreetingLine } from "./greeting-line";

const spark: Greeting = {
  id: "spark",
  hello: "Oh, hello",
  invite: "What are we figuring out today?",
  accent: "spark",
};

describe("greeting line", () => {
  it("pairs a serif hello with an invitation and keeps one spoken sentence", () => {
    const { container } = render(<GreetingLine greeting={spark} />);
    const spoken = greetingText(spark);
    const quiet = container.querySelector(".sr-only");
    expect(quiet?.textContent).toBe(spoken);
    expect(quiet?.closest("[aria-hidden='true']")).toBeNull();
    const hello = container.querySelector(".font-greeting");
    expect(hello?.textContent).toContain("Oh, hello");
    expect(hello?.textContent).toContain("✦");
    expect(container.textContent).toContain("What are we figuring out today?");
    expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
  });
});
