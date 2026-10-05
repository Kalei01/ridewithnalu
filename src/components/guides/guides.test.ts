import { describe, expect, it } from "vitest";
import { GUIDES, GUIDES_HUB, GUIDE_ORDER } from "./guides";
import { guideHead } from "./guide-head";

const pages = [GUIDES_HUB, ...Object.values(GUIDES)];

describe("guide metadata", () => {
  it.each(pages.map((page) => [page.path, page] as const))("%s has a title under 60 characters", (_path, page) => {
    expect(page.seoTitle.length).toBeLessThan(60);
  });

  it.each(pages.map((page) => [page.path, page] as const))("%s has a 140 to 160 character description", (_path, page) => {
    expect(page.description.length).toBeGreaterThanOrEqual(140);
    expect(page.description.length).toBeLessThanOrEqual(160);
  });

  it("titles, descriptions and paths are unique", () => {
    for (const key of ["seoTitle", "description", "path"] as const) {
      const values = pages.map((page) => page[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("the hub lists every guide once", () => {
    expect([...GUIDE_ORDER].sort()).toEqual(Object.keys(GUIDES).sort());
  });

  it("uses correct Hawaiian spelling for place names", () => {
    const text = pages.map((page) => `${page.seoTitle} ${page.description} ${page.name}`).join(" ");
    expect(text).not.toMatch(/\bOahu\b|(?<!ʻ)\bEwa\b|\bManoa\b|\bWaikiki\b/);
  });
});

describe("guideHead", () => {
  const head = guideHead({
    ...GUIDES.skyline,
    faqs: [{ q: "Question?", a: "Answer." }],
    howTo: { name: "Steps", steps: ["One", "Two"] },
  });

  it("sets canonical, Open Graph image and URL", () => {
    expect(head.links).toContainEqual({ rel: "canonical", href: expect.stringMatching(/\/guides\/skyline-rail-guide$/) });
    const og = Object.fromEntries(
      head.meta.flatMap((m) => ("property" in m && m.property ? [[m.property, m.content]] : [])),
    );
    expect(og["og:image"]).toMatch(/\/social-card\.png$/);
    expect(og["og:url"]).toMatch(/\/guides\/skyline-rail-guide$/);
    expect(og["og:title"]).toBe(GUIDES.skyline.seoTitle);
  });

  it("emits WebPage with breadcrumbs, FAQPage and HowTo JSON-LD", () => {
    const json = JSON.parse(head.scripts[0]!.children) as { "@graph": Array<Record<string, unknown>> };
    const types = json["@graph"].map((node) => node["@type"]);
    expect(types).toEqual(["WebPage", "FAQPage", "HowTo"]);
    const page = json["@graph"][0] as { breadcrumb: { itemListElement: unknown[] } };
    expect(page.breadcrumb.itemListElement).toHaveLength(3);
  });
});
