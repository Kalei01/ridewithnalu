import { describe, expect, it } from "vitest";
import { isAutomatedVisitor } from "./automated-visitor";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const PIXEL =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
// A real Android phone brand whose user agent ends in "bot".
const CUBOT =
  "Mozilla/5.0 (Linux; Android 13; CUBOT KingKong 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

describe("isAutomatedVisitor", () => {
  it("counts ordinary phones", () => {
    expect(isAutomatedVisitor({ userAgent: IPHONE, webdriver: false })).toBe(false);
    expect(isAutomatedVisitor({ userAgent: PIXEL })).toBe(false);
    expect(isAutomatedVisitor({ userAgent: CUBOT })).toBe(false);
  });

  it("leaves out browsers driven by software", () => {
    expect(isAutomatedVisitor({ userAgent: IPHONE, webdriver: true })).toBe(true);
    expect(
      isAutomatedVisitor({
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/126.0.0.0 Safari/537.36",
      }),
    ).toBe(true);
  });

  it("leaves out search and AI crawlers", () => {
    for (const agent of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      "Mozilla/5.0 (compatible; PerplexityBot/1.0)",
      "facebookexternalhit/1.1",
    ]) {
      expect(isAutomatedVisitor({ userAgent: agent })).toBe(true);
    }
  });

  it("leaves out command-line fetchers and missing user agents", () => {
    expect(isAutomatedVisitor({ userAgent: "curl/8.5.0" })).toBe(true);
    expect(isAutomatedVisitor({ userAgent: "python-requests/2.31" })).toBe(true);
    expect(isAutomatedVisitor({ userAgent: "" })).toBe(true);
    expect(isAutomatedVisitor({ userAgent: null })).toBe(true);
  });
});
