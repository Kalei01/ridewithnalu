import { SITE_URL } from "@/lib/site";

export type GuideFaq = { q: string; a: string };

type HeadInput = {
  path: string;
  seoTitle: string;
  description: string;
  name: string;
  /** Shown visibly on the page and repeated in FAQPage JSON-LD. */
  faqs: GuideFaq[];
  /** Only for pages where step-by-step instructions fit naturally. */
  howTo?: { name: string; steps: string[] };
  /** Breadcrumb trail above this page; defaults to Nalu > Guides. */
  parents?: Array<{ name: string; path: string }>;
  /** Extra JSON-LD nodes (for example an ItemList or Organization). */
  extraGraph?: Array<Record<string, unknown>>;
};

const SOCIAL_CARD = SITE_URL + "/social-card.png";

/** head() for a guide page: title, description, canonical, Open Graph and JSON-LD. */
export function guideHead(input: HeadInput) {
  const url = SITE_URL + input.path;
  const parents = input.parents ?? [
    { name: "Nalu", path: "/" },
    { name: "Guides", path: "/guides" },
  ];
  const trail = [...parents, { name: input.name, path: input.path }];

  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "WebPage",
      "@id": url + "#webpage",
      name: input.seoTitle.replace(/ \| Nalu$/, ""),
      url,
      description: input.description,
      inLanguage: "en-US",
      dateModified: "2026-10-05",
      isPartOf: { "@type": "WebSite", name: "Nalu", url: SITE_URL },
      primaryImageOfPage: SOCIAL_CARD,
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: trail.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: SITE_URL + item.path,
        })),
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: input.faqs.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];
  if (input.howTo) {
    graph.push({
      "@type": "HowTo",
      name: input.howTo.name,
      step: input.howTo.steps.map((text, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        text,
      })),
    });
  }
  if (input.extraGraph) graph.push(...input.extraGraph);

  return {
    meta: [
      { title: input.seoTitle },
      { name: "description", content: input.description },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:type", content: "article" },
      { property: "og:site_name", content: "Nalu" },
      { property: "og:title", content: input.seoTitle },
      { property: "og:description", content: input.description },
      { property: "og:url", content: url },
      { property: "og:image", content: SOCIAL_CARD },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:title", content: input.seoTitle },
      { name: "twitter:description", content: input.description },
      { name: "twitter:image", content: SOCIAL_CARD },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      },
    ],
  };
}
