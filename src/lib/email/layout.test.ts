import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmail, unsubscribeUrl, welcomeEmail } from "./layout";

describe("Nalu emails", () => {
  const unsub = unsubscribeUrl("3f2b8c1e-0000-4000-8000-000000000001");

  it("builds the unsubscribe link on ridenalu.com", () => {
    expect(unsub).toBe("https://ridenalu.com/api/public/unsubscribe?t=3f2b8c1e-0000-4000-8000-000000000001");
  });

  it("puts the logo, button, steps and unsubscribe link in the welcome email", () => {
    const email = renderEmail(welcomeEmail(), unsub);
    expect(email.html).toContain("https://ridenalu.com/icons/icon-192.png");
    expect(email.html).toContain("Open Nalu");
    expect(email.html).toContain("Save home and work");
    expect(email.html).toContain(unsub);
    expect(email.text).toContain(`Unsubscribe: ${unsub}`);
    expect(email.text).toContain("1. Add Nalu to your Home Screen");
  });

  it("escapes text so nothing can inject HTML", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    const email = renderEmail({ ...welcomeEmail(), heading: "<script>" }, unsub);
    expect(email.html).not.toContain("<script>");
  });
});
