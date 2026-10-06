/**
 * Spots visitors that are software, not riders: headless browsers used for
 * testing, search and AI crawlers, and command-line fetchers. The private
 * weekly-users number leaves them out so it stays close to real people.
 *
 * This only catches visitors that identify themselves. An agent driving an
 * ordinary-looking browser can't be told apart, so the number is still an
 * estimate.
 */
const AUTOMATED_AGENT =
  /headlesschrome|phantomjs|puppeteer|playwright|selenium|lighthouse|chrome-lighthouse|googlebot|google-inspectiontool|adsbot|bingbot|bingpreview|duckduckbot|baiduspider|yandex|slurp|applebot|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|gptbot|chatgpt|oai-searchbot|claudebot|claude-user|claude-web|anthropic|perplexity|bytespider|ccbot|petalbot|semrush|ahrefs|mj12bot|dotbot|python-requests|python-urllib|aiohttp|curl\/|wget\/|go-http-client|node-fetch|axios\/|\b(?:crawler|spider|scraper)\b/i;

export function isAutomatedVisitor(input: {
  userAgent?: string | null;
  webdriver?: boolean | null;
}): boolean {
  if (input.webdriver === true) return true;
  const agent = input.userAgent?.trim() ?? "";
  // Real browsers always send a user agent.
  if (!agent) return true;
  return AUTOMATED_AGENT.test(agent);
}
