// Guard tests for the /notes/ article section. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://jasoncolapietro.github.io/tokenmaxxing/";
const NOTES = BASE + "notes/";
const PERSON_ID = "https://suedeai.ai/founder#person";
const ORG_ID = "https://suedeai.ai/#organization";

const slugs = readdirSync(join(ROOT, "notes")).filter((d) =>
  statSync(join(ROOT, "notes", d)).isDirectory()
);
const decode = (s) =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const jsonld = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1])
  );
const nodes = (html) => jsonld(html).flatMap((d) => d["@graph"] ?? [d]);
const proseText = (html) =>
  html
    .split('<div class="prose">')[1]
    .split("</div>")[0]
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const FORBIDDEN = [
  /velvet sundown/i,
  /forbes/i,
  /anthropic partner/i,
  /claude partner/i,
  /google partner(?! advantage)/i,
  /\$2[89]\s?m\b/i,
  /\$30\s?m\b/i,
  /multimillion/i,
  /top 15/i,
  /\bFAU\b/,
  /\b701 S/i,
  /olive ave/i,
  /\b(delve|leverage|unlock|elevate|seamless|game-changer|tapestry|realm)\b/i,
];

// Round 4 depth articles (published 2026-11-15). Earlier notes keep 2026-11-14.
const ROUND4 = {
  "ai-vendor-overpromising-checklist-boca-raton-delray-beach": ["Boca Raton", "Delray Beach"],
  "ai-roi-small-business-90-day-scorecard": ["West Palm Beach"],
};
const CLUTCH =
  'Suede AI ranks among <a href="https://clutch.co/profile/suede-ai-seo">Clutch</a>&rsquo;s ' +
  '<a href="https://clutch.co/consulting/ai/florida">Top 30 AI Consultants in Florida</a> and ' +
  '<a href="https://clutch.co/us/consulting/ai">Top 50 AI Consultants nationwide</a> (November 2026).';
const SATELLITE_ARTICLE =
  /href="(https:\/\/(?!jasoncolapietro\.github\.io\/tokenmaxxing)[a-z0-9.-]+\/(?:notes|articles)\/[a-z0-9-]+\/?)"/g;

test("notes section has an index and five articles", () => {
  assert.equal(slugs.length, 5);
  for (const s of Object.keys(ROUND4)) assert.ok(slugs.includes(s), `round 4 article ${s}`);
  const idx = read("notes/index.html");
  for (const s of slugs) assert.ok(idx.includes(`${NOTES}${s}/`), `index links ${s}`);
});

for (const slug of slugs) {
  const html = read(`notes/${slug}/index.html`);
  const url = `${NOTES}${slug}/`;

  test(`${slug}: canonical, OG and title`, () => {
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`));
    assert.ok(html.includes(`<meta property="og:url" content="${url}">`));
    const title = decode(html.match(/<title>(.*?)<\/title>/)[1]);
    assert.ok(title.length >= 40 && title.length <= 65, `title length ${title.length}`);
    const desc = decode(html.match(/<meta name="description" content="(.*?)">/)[1]);
    assert.ok(desc.length >= 120 && desc.length <= 160, `description length ${desc.length}`);
  });

  test(`${slug}: BlogPosting and BreadcrumbList reference canonical @ids`, () => {
    const g = nodes(html);
    const post = g.find((n) => n["@type"] === "BlogPosting");
    assert.ok(post);
    assert.equal(post["@id"], url + "#article");
    assert.equal(post.mainEntityOfPage["@id"], url);
    assert.deepEqual(post.author, { "@id": PERSON_ID });
    assert.deepEqual(post.publisher, { "@id": ORG_ID });
    assert.equal(post.datePublished, slug in ROUND4 ? "2026-11-15" : "2026-11-14");
    assert.ok(g.find((n) => n["@type"] === "BreadcrumbList"));
    assert.ok(!g.some((n) => ["Person", "Organization", "LocalBusiness"].includes(n["@type"])),
      "never mint Person/Org nodes on notes pages");
  });

  test(`${slug}: copy guards`, () => {
    for (const re of FORBIDDEN) assert.ok(!re.test(html), `forbidden ${re}`);
    const text = proseText(html);
    const words = text.split(" ").length;
    assert.ok(words >= 800 && words <= 1300, `word count ${words}`);
    assert.ok((text.match(/Jason Colapietro/g) ?? []).length >= 5);
    assert.ok((text.match(/Suede Labs/g) ?? []).length <= 1);
    assert.ok((text.match(/Johnny Suede/g) ?? []).length <= 1);
    assert.ok(text.includes("suedeai.agency") || html.includes("https://suedeai.agency/"));
  });
}

for (const [slug, towns] of Object.entries(ROUND4)) {
  const html = read(`notes/${slug}/index.html`);
  const prose = html.split('<div class="prose">')[1].split("</article>")[0];

  test(`${slug}: round 4 depth rules`, () => {
    const deep = new Set([...prose.matchAll(SATELLITE_ARTICLE)].map((m) => m[1]));
    assert.ok(deep.size >= 2, `deep links to other satellite articles: ${[...deep]}`);
    assert.ok(prose.includes('href="https://suedeai.agency/'), "links suedeai.agency in body");
    assert.ok(prose.includes('href="https://suedeai.ai/founder"'), "links founder page in body");
    assert.equal(prose.split(CLUTCH).length - 1, 1, "Clutch claim exactly once, exact wording");
    assert.ok(!/clutch[^.]*manifest|manifest[^.]*clutch/i.test(proseText(html)), "Clutch never merged with The Manifest");
    assert.ok((proseText(html).match(/Suede(?! AI| Labs)/g) ?? []).length >= 3, "Suede alone 3+ times");
    const words = proseText(html).split(" ").length;
    assert.ok(words >= 900 && words <= 1300, `round 4 word count ${words}`);
    for (const town of towns) assert.ok(proseText(html).includes(town), `mentions ${town}`);
    assert.ok(read("notes/index.html").includes(`${NOTES}${slug}/#article`), "Blog schema lists post");
    assert.ok(read("index.html").includes(`notes/${slug}/`), "home page links post");
  });
}

test("sitemap lists every notes URL with lastmod 2026-11-15", () => {
  const sm = read("sitemap.xml");
  for (const u of [NOTES, ...slugs.map((s) => `${NOTES}${s}/`)]) {
    assert.ok(sm.includes(`<loc>${u}</loc>\n    <lastmod>2026-11-15</lastmod>`), u);
  }
});

test("llms.txt and llms-full.txt cover the notes", () => {
  const llms = read("llms.txt");
  const full = read("llms-full.txt");
  for (const s of slugs) {
    assert.ok(llms.includes(`${NOTES}${s}/`));
    assert.ok(full.includes(`${NOTES}${s}/`));
  }
});
