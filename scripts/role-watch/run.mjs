#!/usr/bin/env node
// Daily watch of data-platform engineering openings.
// Discovers jobs from public Greenhouse and Ashby board APIs, and rechecks
// a short list of company pages that do not publish a board API.
// LinkedIn, Naukri, and Indeed are not crawled.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCES = resolve(ROOT, "scripts/role-watch/sources.json");
const SNAPSHOT = resolve(ROOT, "data/platform-roles.json");
const UA = "DevSetuRoleWatch/1.0 (+https://github.com/Devsetu-Org/Devsetu)";

const INDIA =
  /\b(india|bengaluru|bangalore|hyderabad|pune|chennai|gurugram|gurgaon|noida|mumbai|delhi|kolkata)\b/i;

export function regionOf(location) {
  return INDIA.test(location || "") ? "India" : "Other";
}

export function isEngineeringTitle(title) {
  const t = title.toLowerCase();
  if (/\b(sales|recruiter|marketing|account executive|analyst|scientist|intern|counsel|designer)\b/.test(t)) {
    return false;
  }
  if (/\bmanager\b/.test(t) && !/engineering manager/.test(t)) return false;
  return /\b(engineer|architect|sre|site reliability)\b/.test(t);
}

/** @returns {"Spark"|"Kafka"|"Both"|"Airflow"|"Other"|null} */
export function trackOf(title) {
  const t = title.toLowerCase();
  const spark = /\bspark\b/.test(t);
  const kafka = /\b(kafka|flink|streaming)\b/.test(t);
  const airflow = /\b(airflow|astronomer|orchestration|dagster)\b/.test(t);
  const other = /\b(data platform|data infrastructure|lakehouse|iceberg|trino|data catalog)\b/.test(t);
  if (!spark && !kafka && !airflow && !other) return null;
  if (spark && kafka) return "Both";
  if (spark) return "Spark";
  if (kafka) return "Kafka";
  if (airflow) return "Airflow";
  return "Other";
}

export function refineTrack(titleTrack, text) {
  if (titleTrack !== "Other" || !text) return titleTrack;
  const counts = {
    Spark: (text.match(/\bspark\b/gi) || []).length,
    Kafka: (text.match(/\bkafka\b/gi) || []).length,
    Airflow: (text.match(/\bairflow\b/gi) || []).length,
  };
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [name, count] = ranked[0];
  if (count >= 4 && count >= ranked[1][1] * 2) return name;
  return titleTrack;
}

function pageState(status, text, title) {
  const lower = text.toLowerCase();
  if (lower.includes(title.toLowerCase())) return "open";
  if (status === 404 || status === 410) return "closed";
  return "unknown";
}

export function payFromMetadata(metadata) {
  if (!Array.isArray(metadata)) return null;
  const hit = metadata.find((item) => /pay transparency/i.test(item.name || "") && item.value?.min_value != null);
  if (!hit) return null;
  const { min_value: min, max_value: max, unit } = hit.value;
  const currency = unit || "USD";
  return `${currency} ${min}–${max}`;
}

function dedupeKey(role) {
  const company = role.company.toLowerCase().replace(/[^a-z0-9]/g, "");
  const title = role.title.toLowerCase().replace(/\s+/g, " ").trim();
  return `${company}|${title}`;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const WORKDAY_QUERIES = ["Data Platform", "Data Infrastructure", "Spark", "Kafka", "Airflow"];

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function getText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(25000),
    redirect: "follow",
  });
  const text = await res.text();
  return { status: res.status, text };
}

function loadPrevious() {
  try {
    const parsed = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    return Array.isArray(parsed.roles) ? parsed.roles : [];
  } catch {
    return [];
  }
}

async function greenhouseJobs(board) {
  const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`);
  const roles = [];
  for (const job of data.jobs || []) {
    if (!isEngineeringTitle(job.title)) continue;
    const track = trackOf(job.title);
    if (!track) continue;
    const location = job.location?.name || "";
    roles.push({
      id: `greenhouse:${board}:${job.id}`,
      source: `greenhouse:${board}`,
      company: job.company_name || board,
      title: job.title,
      track,
      region: regionOf(location),
      location,
      url: job.absolute_url,
      pay: payFromMetadata(job.metadata),
      jobId: job.id,
    });
  }
  await Promise.all(
    roles.map(async (role) => {
      if (role.track !== "Other") return;
      try {
        const detail = await getJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${role.jobId}`);
        role.track = refineTrack(role.track, detail.content || "");
      } catch {
        // Keep the title classification when the detail page does not load.
      }
      delete role.jobId;
    }),
  );
  for (const role of roles) delete role.jobId;
  return roles;
}

async function workdayJobs(board) {
  const roles = [];
  const seen = new Set();
  for (const query of WORKDAY_QUERIES) {
    let offset = 0;
    let total = Infinity;
    while (offset < total && offset < 200) {
      const data = await postJson(`https://${board.host}/wday/cxs/${board.tenant}/${board.site}/jobs`, {
        appliedFacets: {},
        limit: 20,
        offset,
        searchText: query,
      });
      total = data.total || 0;
      const postings = data.jobPostings || [];
      if (!postings.length) break;
      for (const job of postings) {
        if (!job.externalPath || seen.has(job.externalPath)) continue;
        if (!isEngineeringTitle(job.title || "")) continue;
        const track = trackOf(job.title || "");
        if (!track) continue;
        seen.add(job.externalPath);
        const location = job.locationsText || "";
        roles.push({
          id: `workday:${board.tenant}:${job.externalPath}`,
          source: `workday:${board.tenant}`,
          company: board.company,
          title: job.title,
          track,
          region: regionOf(location),
          location,
          url: `https://${board.host}/${board.site}${job.externalPath}`,
          pay: null,
        });
      }
      offset += postings.length;
    }
  }
  return roles;
}

async function ashbyJobs(board) {
  const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${board}`);
  const roles = [];
  for (const job of data.jobs || []) {
    if (job.isListed === false) continue;
    if (!isEngineeringTitle(job.title)) continue;
    const track = trackOf(job.title);
    if (!track) continue;
    const location = job.location || "";
    const company = { sarvam: "Sarvam", sentry: "Sentry" }[board] || board;
    roles.push({
      id: `ashby:${board}:${job.id}`,
      source: `ashby:${board}`,
      company,
      title: job.title,
      track: refineTrack(trackOf(job.title), job.descriptionPlain || ""),
      region: regionOf(location),
      location,
      url: job.jobUrl,
      pay: null,
    });
  }
  return roles;
}

async function pageRole(page) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { status, text } = await getText(page.url);
      return {
        id: `page:${page.url}`,
        source: `page:${page.url}`,
        company: page.company,
        title: page.title,
        track: page.track,
        region: page.region,
        location: "",
        url: page.url,
        pay: null,
        status: pageState(status, text, page.title),
      };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    id: `page:${page.url}`,
    source: `page:${page.url}`,
    company: page.company,
    title: page.title,
    track: page.track,
    region: page.region,
    location: "",
    url: page.url,
    pay: null,
    status: "unknown",
    lastError: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

function merge(previous, discovered, failedSources, now) {
  const byId = new Map(previous.map((role) => [role.id, role]));
  const seenKeys = new Set();
  const next = [];

  for (const found of discovered) {
    const key = dedupeKey(found);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const prior = byId.get(found.id) || previous.find((role) => dedupeKey(role) === key);
    const status = found.status ?? "open";
    next.push({
      ...found,
      status,
      pay: found.pay || prior?.pay || null,
      location: found.location || prior?.location || "",
      region: found.location ? found.region : prior?.region || found.region,
      firstSeen: prior?.firstSeen || now,
      lastSeenOpen: status === "open" ? now : prior?.lastSeenOpen || null,
      lastChecked: now,
      lastError: found.lastError || null,
    });
    if (prior) byId.delete(prior.id);
  }

  for (const role of byId.values()) {
    const boardFailed = role.source !== "page" && failedSources.has(role.source);
    const stillOpen = boardFailed ? role.status : "closed";
    next.push({
      ...role,
      status: stillOpen,
      lastChecked: boardFailed ? role.lastChecked : now,
      lastError: boardFailed ? "source fetch failed; status left unchanged" : null,
    });
  }

  next.sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    if (a.region !== b.region) return a.region === "India" ? -1 : 1;
    return `${a.track}|${a.company}|${a.title}`.localeCompare(`${b.track}|${b.company}|${b.title}`);
  });
  return next;
}

function selfCheck() {
  const assert = (cond, message) => {
    if (!cond) throw new Error(message);
  };
  assert(trackOf("Software Engineer, Spark Platform") === "Spark", "spark");
  assert(trackOf("Staff Software Engineer, Event Streaming Systems") === "Kafka", "streaming");
  assert(trackOf("Data Platform Engineer - Airflow Platform Specialist") === "Airflow", "airflow");
  assert(trackOf("Software Engineer, Data Platform") === "Other", "data platform");
  assert(trackOf("Account Executive") === null, "sales title has no track");
  assert(isEngineeringTitle("Software Engineer, Spark Platform"), "engineer");
  assert(!isEngineeringTitle("Manager, Data Platform Strategy"), "non-engineering manager");
  assert(regionOf("Bengaluru, India") === "India", "india");
  assert(regionOf("San Mateo, CA") === "Other", "us");
  assert(refineTrack("Other", "kafka kafka kafka kafka") === "Kafka", "refine kafka");
  assert(pageState(404, "missing", "Spark Platform") === "closed", "missing page");
  assert(pageState(200, "<html>shell</html>", "Spark Platform") === "unknown", "unreadable page");
  assert(
    payFromMetadata([{ name: "USA: Pay Transparency Range", value: { min_value: 130, max_value: 192, unit: "USD" } }]) ===
      "USD 130–192",
    "pay",
  );
  console.log("role-watch self-check ok");
}

async function main() {
  if (process.argv.includes("--self-check")) {
    selfCheck();
    return;
  }

  const sources = JSON.parse(readFileSync(SOURCES, "utf8"));
  const previous = loadPrevious();
  const discovered = [];
  const failedSources = new Set();
  const now = new Date().toISOString();

  for (const board of sources.greenhouse || []) {
    const source = `greenhouse:${board}`;
    try {
      const roles = await greenhouseJobs(board);
      discovered.push(...roles);
      console.log(`${source}: ${roles.length} platform roles`);
    } catch (error) {
      failedSources.add(source);
      console.error(`${source}: ${error.message}`);
    }
  }

  for (const board of sources.workday || []) {
    const source = `workday:${board.tenant}`;
    try {
      const roles = await workdayJobs(board);
      discovered.push(...roles);
      console.log(`${source}: ${roles.length} platform roles`);
    } catch (error) {
      failedSources.add(source);
      console.error(`${source}: ${error.message}`);
    }
  }

  for (const board of sources.ashby || []) {
    const source = `ashby:${board}`;
    try {
      const roles = await ashbyJobs(board);
      discovered.push(...roles);
      console.log(`${source}: ${roles.length} platform roles`);
    } catch (error) {
      failedSources.add(source);
      console.error(`${source}: ${error.message}`);
    }
  }

  const pageRoles = await Promise.all(
    (sources.pages || []).map(async (page) => {
      const role = await pageRole(page);
      console.log(`page ${page.company}: ${role.status}`);
      return role;
    }),
  );
  discovered.push(...pageRoles);

  const roles = merge(previous, discovered, failedSources, now);
  const open = roles.filter((role) => role.status === "open").length;
  mkdirSync(dirname(SNAPSHOT), { recursive: true });
  writeFileSync(
    SNAPSHOT,
    `${JSON.stringify({ checkedAt: now, open, total: roles.length, roles }, null, 2)}\n`,
  );
  console.log(`wrote ${SNAPSHOT}: ${open} open / ${roles.length} tracked`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
