#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".qodo"
]);

function getArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  const value = args[idx + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
}

function hasFlag(args, name) {
  return args.includes(name);
}

function decodeEntities(input) {
  return String(input)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      if (!Number.isFinite(code)) return _;
      return String.fromCodePoint(code);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code)) return _;
      return String.fromCodePoint(code);
    });
}

function stripHtmlToText(html) {
  let out = String(html);
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  out = out.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ");
  out = out.replace(/<!--([\s\S]*?)-->/g, " ");
  out = out.replace(/<[^>]+>/g, " ");
  out = decodeEntities(out);
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function wordCount(text) {
  if (!text) return 0;
  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function extractFirst(html, regex) {
  const match = String(html).match(regex);
  if (!match) return null;
  return match[1] ?? null;
}

function extractMetaContent(html, metaName) {
  const escapedName = String(metaName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagRe = new RegExp(`<meta\\s+[^>]*name=["']${escapedName}["'][^>]*>`, "i");
  const tagMatch = String(html).match(tagRe);
  const tag = tagMatch ? tagMatch[0] : null;
  if (!tag) return null;
  const content = extractFirst(tag, /\bcontent=["']([^"']*)["']/i);
  return content ? decodeEntities(content).trim() : null;
}

function extractHrefs(html) {
  const hrefs = [];
  const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(String(html)))) {
    hrefs.push(match[1]);
  }
  return hrefs;
}

function countImagesMissingAlt(html) {
  const re = /<img\b[^>]*>/gi;
  let match;
  let total = 0;
  let missing = 0;
  while ((match = re.exec(String(html)))) {
    total += 1;
    const tag = match[0];
    const alt = extractFirst(tag, /\balt=["']([^"']*)["']/i);
    if (alt == null || String(alt).trim() === "") missing += 1;
  }
  return { total, missing };
}

function extractParagraphWordStats(html) {
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const lengths = [];
  let match;
  while ((match = re.exec(String(html)))) {
    const text = stripHtmlToText(match[1]);
    const wc = wordCount(text);
    if (wc > 0) lengths.push(wc);
  }
  lengths.sort((a, b) => b - a);
  return {
    paragraphCount: lengths.length,
    maxParagraphWords: lengths[0] ?? 0,
    avgParagraphWords:
      lengths.length === 0
        ? 0
        : Math.round(lengths.reduce((sum, n) => sum + n, 0) / lengths.length)
  };
}

function findSuspiciousPhrases(text) {
  const hay = String(text);
  const checks = [
    { id: "lorem_ipsum", re: /\blorem ipsum\b/i },
    { id: "coming_soon", re: /\bcoming soon\b/i },
    { id: "under_construction", re: /\bunder construction\b/i },
    { id: "TODO", re: /\bTODO\b/ },
    { id: "TBD", re: /\bTBD\b/ }
  ];
  return checks.filter(({ re }) => re.test(hay)).map(({ id }) => id);
}

async function walk(dir, { ignoredDirs }) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      out.push(...(await walk(full, { ignoredDirs })));
      continue;
    }
    if (entry.isFile()) out.push(full);
  }
  return out;
}

function basenameLower(filePath) {
  return path.basename(filePath).toLowerCase();
}

function isTrustPageName(fileNameLower) {
  const names = new Set([
    "privacy.html",
    "privacy-policy.html",
    "datenschutz.html",
    "impressum.html",
    "terms.html",
    "terms-of-service.html",
    "tos.html",
    "about.html",
    "contact.html",
    "support.html",
    "help.html",
    "cookie.html",
    "cookies.html"
  ]);
  return names.has(fileNameLower);
}

function formatBool(value) {
  return value ? "yes" : "no";
}

function padRight(input, width) {
  const raw = String(input);
  if (raw.length >= width) return raw;
  return raw + " ".repeat(width - raw.length);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const root = path.resolve(getArgValue(args, "--root") || process.cwd());
  const json = hasFlag(args, "--json");
  const minWords = Number(getArgValue(args, "--min-words") || 250);
  const minParagraphWords = Number(getArgValue(args, "--min-paragraph-words") || 40);

  if (!Number.isFinite(minWords) || minWords <= 0) {
    console.error("Invalid --min-words value.");
    process.exitCode = 2;
    return;
  }
  if (!Number.isFinite(minParagraphWords) || minParagraphWords <= 0) {
    console.error("Invalid --min-paragraph-words value.");
    process.exitCode = 2;
    return;
  }

  const files = await walk(root, { ignoredDirs: DEFAULT_IGNORED_DIRS });
  const htmlFiles = files
    .filter((f) => f.toLowerCase().endsWith(".html"))
    .sort((a, b) => a.localeCompare(b));

  const trustPagesFound = new Set(
    htmlFiles
      .map((f) => basenameLower(f))
      .filter((name) => isTrustPageName(name))
  );

  let serverSource = "";
  const serverPath = path.join(root, "server.js");
  if (await fileExists(serverPath)) {
    try {
      serverSource = await fs.readFile(serverPath, "utf8");
    } catch {}
  }

  const siteChecks = {
    robotsTxt:
      (await fileExists(path.join(root, "public", "robots.txt"))) ||
      (serverSource ? serverSource.includes('"/robots.txt"') || serverSource.includes("'/robots.txt'") : false),
    sitemapXml:
      (await fileExists(path.join(root, "public", "sitemap.xml"))) ||
      (serverSource ? serverSource.includes('"/sitemap.xml"') || serverSource.includes("'/sitemap.xml'") : false),
    trustPagesFound: Array.from(trustPagesFound).sort()
  };

  const pages = [];
  for (const filePath of htmlFiles) {
    const rel = path.relative(root, filePath) || filePath;
    const raw = await fs.readFile(filePath, "utf8");
    const title = extractFirst(raw, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const description = extractMetaContent(raw, "description");
    const robots = extractMetaContent(raw, "robots");
    const hasH1 = /<h1\b[^>]*>/i.test(raw);
    const hasAdsense = raw.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js");
    const hrefs = extractHrefs(raw);
    const internalLinks = hrefs.filter((h) => !/^https?:\/\//i.test(h) && !/^mailto:/i.test(h));
    const plainText = stripHtmlToText(raw);
    const words = wordCount(plainText);
    const paragraphStats = extractParagraphWordStats(raw);
    const suspicious = findSuspiciousPhrases(plainText);
    const imgAlt = countImagesMissingAlt(raw);

    const warnings = [];
    if (!title || title.trim().length < 4) warnings.push("missing_title");
    if (!description || description.trim().length < 30) warnings.push("missing_meta_description");
    if (!hasH1) warnings.push("missing_h1");
    if (robots && /noindex|nofollow/i.test(robots)) warnings.push("robots_noindex_or_nofollow");
    if (words < minWords) warnings.push("low_total_text");
    if (paragraphStats.maxParagraphWords < minParagraphWords) warnings.push("no_substantive_paragraphs");
    if (hasAdsense && (words < minWords || paragraphStats.maxParagraphWords < minParagraphWords)) {
      warnings.push("ads_on_thin_page");
    }
    if (imgAlt.missing > 0) warnings.push("images_missing_alt");
    if (suspicious.length > 0) warnings.push(`placeholder_text:${suspicious.join(",")}`);

    pages.push({
      file: rel,
      title: title ? decodeEntities(title).replace(/\s+/g, " ").trim() : null,
      metaDescription: description || null,
      metaRobots: robots || null,
      hasH1,
      hasAdsense,
      words,
      paragraphCount: paragraphStats.paragraphCount,
      maxParagraphWords: paragraphStats.maxParagraphWords,
      avgParagraphWords: paragraphStats.avgParagraphWords,
      internalLinkCount: internalLinks.length,
      imageCount: imgAlt.total,
      imagesMissingAlt: imgAlt.missing,
      warnings
    });
  }

  const overallWarnings = [];
  if (!siteChecks.robotsTxt) overallWarnings.push("missing_robots_txt");
  if (!siteChecks.sitemapXml) overallWarnings.push("missing_sitemap_xml");
  if (
    !(
      trustPagesFound.has("privacy.html") ||
      trustPagesFound.has("privacy-policy.html") ||
      trustPagesFound.has("datenschutz.html")
    )
  ) {
    overallWarnings.push("missing_privacy_page");
  }
  if (!(trustPagesFound.has("terms.html") || trustPagesFound.has("terms-of-service.html") || trustPagesFound.has("tos.html"))) {
    overallWarnings.push("missing_terms_page");
  }
  if (!(trustPagesFound.has("about.html") || trustPagesFound.has("impressum.html"))) {
    overallWarnings.push("missing_about_or_imprint_page");
  }
  if (!(trustPagesFound.has("contact.html") || trustPagesFound.has("support.html"))) {
    overallWarnings.push("missing_contact_or_support_page");
  }

  const result = {
    root,
    thresholds: { minWords, minParagraphWords },
    siteChecks,
    overallWarnings,
    pages
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\\n`);
  } else {
    console.log("AdSense readiness audit (heuristic)");
    console.log(`Root: ${root}`);
    console.log(`Pages scanned: ${pages.length}`);
    console.log("");

    console.log("Site-level checks");
    console.log(`- public/robots.txt: ${formatBool(siteChecks.robotsTxt)}`);
    console.log(`- public/sitemap.xml: ${formatBool(siteChecks.sitemapXml)}`);
    console.log(`- Trust pages found: ${siteChecks.trustPagesFound.length ? siteChecks.trustPagesFound.join(", ") : "none"}`);
    if (overallWarnings.length) console.log(`- Warnings: ${overallWarnings.join(", ")}`);
    console.log("");

    console.log("Per-page summary");
    console.log(
      `${padRight("file", 18)}  ${padRight("words", 5)}  ${padRight("maxP", 4)}  ${padRight("ads", 3)}  warnings`
    );
    for (const p of pages) {
      const warnings = p.warnings.length ? p.warnings.join("|") : "-";
      console.log(
        `${padRight(p.file, 18)}  ${padRight(p.words, 5)}  ${padRight(p.maxParagraphWords, 4)}  ${padRight(p.hasAdsense ? "yes" : "no", 3)}  ${warnings}`
      );
    }

    console.log("");
    console.log("Tips (based on common AdSense review failures)");
    console.log(`- Add at least one content page with real paragraphs (>= ${minParagraphWords} words each), not only UI labels.`);
    console.log("- Add and link: privacy policy, terms, about/imprint, and contact/support (footer links work well).");
    console.log("- Add unique <meta name=\"description\"> per page.");
    console.log("- Avoid showing ads on pages with very little text content.");
  }

  // Non-zero exit if we found anything notable.
  const anyPageWarnings = pages.some((p) => p.warnings.length > 0);
  if (overallWarnings.length > 0 || anyPageWarnings) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 2;
});
