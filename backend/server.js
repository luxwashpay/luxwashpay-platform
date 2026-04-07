import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import Stripe from "stripe";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (req.path && req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

const env = (name, fallback = "") => {
  const value = process.env[name];
  return value === undefined ? fallback : value;
};

const port = Number(env("PORT", "3000"));
const host = env("HOST", "127.0.0.1");
const stripeSecretKey = env("STRIPE_SECRET_KEY");
const stripeCurrency = env("STRIPE_CURRENCY", "gbp");
const stripeConnectAccountId = env("STRIPE_CONNECT_ACCOUNT_ID");
const platformFeePence = Number(env("PLATFORM_FEE_PENCE", "50"));
const publicAppUrl = env("PUBLIC_APP_URL", "").replace(/\/+$/, "");
const publicTopupPath = env("PUBLIC_TOPUP_PATH", "/");

const rawUnipayBaseUrl = env("UNIPAY_BASE_URL", "").trim();
const unipayBaseUrl = rawUnipayBaseUrl ? rawUnipayBaseUrl.replace(/\/+$/, "") + "/" : "";
const unipayAuthMode = env("UNIPAY_AUTH_MODE", "oauth2");
const unipayClientId = env("UNIPAY_CLIENT_ID");
const unipayClientSecret = env("UNIPAY_CLIENT_SECRET");
const unipayStaticToken = env("UNIPAY_STATIC_TOKEN");
const unipayTokenUrl = env("UNIPAY_TOKEN_URL", unipayBaseUrl ? new URL("getAccessToken", unipayBaseUrl).toString() : "");
const unipaySendClientHeaders = env("UNIPAY_SEND_CLIENT_HEADERS", "false").toLowerCase() === "true";
const unipayHeaderClientIdName = env("UNIPAY_HEADER_CLIENT_ID_NAME", "X-Client-Id");
const unipayHeaderClientSecretName = env("UNIPAY_HEADER_CLIENT_SECRET_NAME", "X-Client-Secret");
const unipayPaymentDesc = env("UNIPAY_PAYMENT_DESC", "stripe payment");
const unipayDefaultBoxNum = env("UNIPAY_BOX_NUM", "19");
const unipayStatusRetries = Number(env("UNIPAY_STATUS_RETRIES", "5"));
const unipayStatusDelayMs = Number(env("UNIPAY_STATUS_DELAY_MS", "1500"));
const unipayTimeoutMs = Number(env("UNIPAY_TIMEOUT_MS", "15000"));

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const completedSessions = new Map();
const appVersion = "2026-03-26-auth-auto-v2";
const runtimeDataDir = env("RUNTIME_DATA_DIR", process.env.VERCEL ? "/tmp/luxwash-data" : path.join(__dirname, "data"));
const transactionsFile = path.join(runtimeDataDir, "transactions.json");
let memoryTransactions = null;
const settingsFile = path.join(runtimeDataDir, "settings.json");
let memorySettings = null;
const settingsStore = env("SETTINGS_STORE", "file").toLowerCase();
let stripeAccountCache = null;
let stripeAccountCacheAt = 0;
const STRIPE_SETTINGS_CACHE_MS = 5 * 60 * 1000;
const DASHBOARD_STRIPE_SESSION_LIMIT = Math.max(1, Math.min(1000, Number(env("DASHBOARD_STRIPE_SESSION_LIMIT", "500")) || 500));

const dashboardAdminPin = env("DASHBOARD_ADMIN_PIN", "");
const requireDashboardPin = dashboardAdminPin && dashboardAdminPin.length >= 3;
const defaultBaysEnv = env("LUXWASH_BAYS", "260529,260530,260531,260532,260533");
const defaultBonusPacksEnv = env("BONUS_PACKS", "5:6,6:7,10:11,20:23");

let tokenCache = { value: "", expiresAt: 0 };
let autoAuthStrategyName = "";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseBays(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function parseBonusPacks(value) {
  if (Array.isArray(value)) {
    return value
      .map((pack) => ({
        pay: Number(pack?.pay),
        credit: Number(pack?.credit),
      }))
      .filter((pack) => Number.isFinite(pack.pay) && Number.isFinite(pack.credit) && pack.pay > 0 && pack.credit >= pack.pay);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [payStr, creditStr] = chunk.split(":");
        const pay = Number(payStr);
        const credit = Number(creditStr);
        return { pay, credit };
      })
      .filter((pack) => Number.isFinite(pack.pay) && Number.isFinite(pack.credit) && pack.pay > 0 && pack.credit >= pack.pay);
  }
  return [];
}

function getDefaultStaffVisibility() {
  return {
    filters: true,
    revenue: true,
    charts: true,
    bayPerformance: true,
    forecasts: true,
    heatmap: true,
    alerts: true,
    transactions: true,
  };
}

function parseStaffVisibility(value) {
  const defaults = getDefaultStaffVisibility();
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch (_) {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return defaults;
  }
  return Object.keys(defaults).reduce((next, key) => {
    next[key] = typeof parsed[key] === "boolean" ? parsed[key] : defaults[key];
    return next;
  }, {});
}

const defaultBays = parseBays(defaultBaysEnv);
const defaultBonusPacks = parseBonusPacks(defaultBonusPacksEnv);
const fallbackBonusPacks = defaultBonusPacks.length ? defaultBonusPacks : [{ pay: 5, credit: 6 }, { pay: 6, credit: 7 }, { pay: 10, credit: 11 }, { pay: 20, credit: 23 }];

function mergeBonusPacksWithDefaults(value) {
  const merged = new Map();
  fallbackBonusPacks.forEach((pack) => merged.set(String(pack.pay), pack));
  parseBonusPacks(value).forEach((pack) => merged.set(String(pack.pay), pack));
  return Array.from(merged.values()).sort((a, b) => a.pay - b.pay);
}

function getDefaultSettings() {
  return {
    bonusEnabled: false,
    bonusMode: "manual",
    bonusDisplayMode: "selected",
    bonusPack: fallbackBonusPacks[0]?.pay || 5,
    bonusPacks: fallbackBonusPacks,
    bays: defaultBays.length ? defaultBays : [String(unipayDefaultBoxNum)],
    staffVisibility: getDefaultStaffVisibility(),
  };
}

function parseSettingsFromMetadata(meta) {
  if (!meta || typeof meta !== "object") {
    return null;
  }
  const next = {};
  if (meta.luxwash_bonus_enabled !== undefined) {
    next.bonusEnabled = String(meta.luxwash_bonus_enabled) === "1";
  }
  if (meta.luxwash_bonus_mode === "manual" || meta.luxwash_bonus_mode === "recommended") {
    next.bonusMode = meta.luxwash_bonus_mode;
  }
  if (meta.luxwash_bonus_display_mode === "selected" || meta.luxwash_bonus_display_mode === "all") {
    next.bonusDisplayMode = meta.luxwash_bonus_display_mode;
  }
  if (meta.luxwash_bonus_pack && Number.isFinite(Number(meta.luxwash_bonus_pack))) {
    next.bonusPack = Number(meta.luxwash_bonus_pack);
  }
  if (meta.luxwash_bonus_packs) {
    try {
      const parsed = JSON.parse(meta.luxwash_bonus_packs);
      const packs = parseBonusPacks(parsed);
      if (packs.length) {
        next.bonusPacks = packs;
      }
    } catch (_) {}
  }
  if (meta.luxwash_bays) {
    const bays = parseBays(meta.luxwash_bays);
    if (bays.length) {
      next.bays = bays;
    }
  }
  if (meta.luxwash_staff_visibility) {
    next.staffVisibility = parseStaffVisibility(meta.luxwash_staff_visibility);
  }
  return next;
}

async function getStripeAccount() {
  if (!stripe) {
    return null;
  }
  const now = Date.now();
  if (stripeAccountCache && now - stripeAccountCacheAt < STRIPE_SETTINGS_CACHE_MS) {
    return stripeAccountCache;
  }
  const account = await stripe.accounts.retrieve();
  stripeAccountCache = account;
  stripeAccountCacheAt = now;
  return account;
}

async function readSettings() {
  if (memorySettings) {
    return memorySettings;
  }
  if (settingsStore === "stripe" && stripe) {
    try {
      const account = await getStripeAccount();
      const metaSettings = parseSettingsFromMetadata(account?.metadata);
      if (metaSettings) {
          const merged = { ...getDefaultSettings(), ...metaSettings };
          merged.bonusPacks = mergeBonusPacksWithDefaults(merged.bonusPacks);
          memorySettings = merged;
          return merged;
      }
    } catch (_) {
      // fall through to file
    }
  }
  try {
    const raw = await fs.readFile(settingsFile, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const merged = { ...getDefaultSettings(), ...parsed };
      merged.bonusPacks = mergeBonusPacksWithDefaults(merged.bonusPacks);
      return merged;
    }
    return getDefaultSettings();
  } catch (error) {
    if (error.code === "ENOENT") {
      return getDefaultSettings();
    }
    if (["EROFS", "EACCES", "EPERM"].includes(error.code)) {
      memorySettings = memorySettings || getDefaultSettings();
      return memorySettings;
    }
    throw error;
  }
}

async function writeSettings(settings) {
  if (settingsStore === "stripe" && stripe) {
    try {
      const metadata = {
        luxwash_bonus_enabled: settings.bonusEnabled ? "1" : "0",
        luxwash_bonus_mode: settings.bonusMode || "manual",
        luxwash_bonus_display_mode: settings.bonusDisplayMode || "selected",
        luxwash_bonus_pack: String(settings.bonusPack || ""),
        luxwash_bonus_packs: JSON.stringify(settings.bonusPacks || []),
        luxwash_bays: Array.isArray(settings.bays) ? settings.bays.join(",") : "",
        luxwash_staff_visibility: JSON.stringify(parseStaffVisibility(settings.staffVisibility)),
      };
      const account = await getStripeAccount();
      if (account?.id) {
        await stripe.accounts.update(account.id, { metadata });
        memorySettings = settings;
        return;
      }
    } catch (error) {
      if (!/permission|provided key|required permissions|rak_/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }
  try {
    await fs.mkdir(path.dirname(settingsFile), { recursive: true });
    await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2));
    memorySettings = null;
  } catch (error) {
    if (["ENOENT", "EROFS", "EACCES", "EPERM"].includes(error.code)) {
      memorySettings = settings;
      return;
    }
    throw error;
  }
}

function sanitizeSettings(payload, current) {
  const next = { ...current };
  if (typeof payload?.bonusEnabled === "boolean") {
    next.bonusEnabled = payload.bonusEnabled;
  }
  if (payload?.bonusMode === "manual" || payload?.bonusMode === "recommended") {
    next.bonusMode = payload.bonusMode;
  }
  if (payload?.bonusDisplayMode === "selected" || payload?.bonusDisplayMode === "all") {
    next.bonusDisplayMode = payload.bonusDisplayMode;
  }
  if (payload?.bonusPack !== undefined && Number.isFinite(Number(payload.bonusPack))) {
    next.bonusPack = Number(payload.bonusPack);
  }
  if (payload?.bonusPacks !== undefined) {
    const parsed = parseBonusPacks(payload.bonusPacks);
      if (parsed.length) {
        next.bonusPacks = mergeBonusPacksWithDefaults(parsed);
        if (!parsed.find((pack) => pack.pay === next.bonusPack)) {
          next.bonusPack = next.bonusPacks[0].pay;
        }
      }
  }
  if (payload?.bays !== undefined) {
    const parsed = parseBays(payload.bays);
    if (parsed.length) {
      next.bays = parsed;
    }
  }
  if (payload?.staffVisibility !== undefined) {
    next.staffVisibility = parseStaffVisibility(payload.staffVisibility);
  }
  return next;
}

async function readTransactions() {
  if (Array.isArray(memoryTransactions)) {
    return memoryTransactions;
  }
  try {
    const raw = await fs.readFile(transactionsFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    if (["EROFS", "EACCES", "EPERM"].includes(error.code)) {
      memoryTransactions = memoryTransactions || [];
      return memoryTransactions;
    }
    throw error;
  }
}

async function writeTransactions(list) {
  try {
    await fs.mkdir(path.dirname(transactionsFile), { recursive: true });
    await fs.writeFile(transactionsFile, JSON.stringify(list, null, 2));
    memoryTransactions = null;
  } catch (error) {
    if (["ENOENT", "EROFS", "EACCES", "EPERM"].includes(error.code)) {
      memoryTransactions = list;
      return;
    }
    throw error;
  }
}

function toDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function filterByRange(list, start, end) {
  return list.filter((item) => {
    const ts = new Date(item.createdAt).getTime();
    return ts >= start && ts <= end;
  });
}

function filterByBay(list, bay) {
  if (!bay) {
    return list;
  }
  return list.filter((item) => String(item.boxNum) === String(bay));
}

function parseDateInput(value, endOfDay = false) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.getTime();
}

function applyFilters(list, query) {
  const bay = query?.bay;
  const startMs = parseDateInput(query?.start);
  const endMs = parseDateInput(query?.end, true);
  let filtered = list;
  if (startMs !== null && endMs !== null) {
    filtered = filterByRange(filtered, startMs, endMs);
  } else if (startMs !== null) {
    filtered = filterByRange(filtered, startMs, Date.now());
  } else if (endMs !== null) {
    filtered = filterByRange(filtered, 0, endMs);
  }
  return filterByBay(filtered, bay);
}

function sumAmounts(list) {
  return list.reduce((total, item) => total + Number(item.amount || 0), 0);
}

async function logTransaction(entry) {
  const transactions = await readTransactions();
  transactions.unshift(entry);
  await writeTransactions(transactions.slice(0, 1000));
}

function getCheckoutMetadata(session) {
  const sessionMeta = session?.metadata || {};
  const paymentIntentMeta = typeof session?.payment_intent === "object" && session.payment_intent?.metadata
    ? session.payment_intent.metadata
    : {};
  return { ...paymentIntentMeta, ...sessionMeta };
}

async function readStripePaidTransactions() {
  if (!stripe) {
    return [];
  }

  try {
    const allSessions = [];
    let startingAfter;

    do {
      const page = await stripe.checkout.sessions.list({
        limit: Math.min(100, Math.max(1, DASHBOARD_STRIPE_SESSION_LIMIT - allSessions.length)),
        starting_after: startingAfter,
        expand: ["data.payment_intent"],
      });

      allSessions.push(...page.data);
      startingAfter = page.has_more && allSessions.length < DASHBOARD_STRIPE_SESSION_LIMIT
        ? page.data[page.data.length - 1]?.id
        : undefined;
    } while (startingAfter);

    return allSessions
      .filter((session) => session.payment_status === "paid")
      .map((session) => {
        const meta = getCheckoutMetadata(session);
        const amount = meta.topup_amount_charged
          ? Number(meta.topup_amount_charged)
          : meta.topup_amount
            ? Number(meta.topup_amount)
            : Number((session.amount_total || 0) / 100);
        const creditAmount = meta.topup_amount_credit
          ? Number(meta.topup_amount_credit)
          : amount;
        const bonusAmount = meta.bonus_amount
          ? Number(meta.bonus_amount)
          : Math.max(0, creditAmount - amount);

        return {
          id: `stripe_${session.id}`,
          sessionId: session.id,
          amount,
          creditAmount,
          bonusAmount,
          boxNum: meta.box_num ? Number(meta.box_num) : null,
          payId: meta.unipay_pay_id || null,
          createdAt: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          status: meta.unipay_status || "paid",
          source: "stripe",
        };
      })
      .filter((tx) => tx.boxNum);
  } catch (_) {
    return [];
  }
}

function mergeTransactions(localTransactions, stripeTransactions) {
  const merged = new Map();

  stripeTransactions.forEach((tx) => {
    merged.set(tx.sessionId || tx.id, tx);
  });

  localTransactions.forEach((tx) => {
    const key = tx.sessionId || tx.id;
    const existing = merged.get(key) || {};
    merged.set(key, {
      ...existing,
      ...tx,
      amount: tx.amount ?? existing.amount,
      creditAmount: tx.creditAmount ?? existing.creditAmount,
      bonusAmount: tx.bonusAmount ?? existing.bonusAmount,
      source: existing.source ? `${existing.source}+local` : "local",
    });
  });

  return Array.from(merged.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function readDashboardTransactions() {
  const [localTransactions, stripeTransactions, settings] = await Promise.all([
    readTransactions(),
    readStripePaidTransactions(),
    readSettings().catch(() => getDefaultSettings()),
  ]);
  const configuredBays = new Set(parseBays(settings?.bays || defaultBays).map(String));

  return mergeTransactions(localTransactions, stripeTransactions)
    .filter((tx) => !configuredBays.size || configuredBays.has(String(tx.boxNum)));
}

function assertConfigured() {
  if (!stripe) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to backend/.env");
  }
  if (!unipayBaseUrl || unipayBaseUrl === "/") {
    throw new Error("Unipay is not configured. Add UNIPAY_BASE_URL to backend/.env");
  }
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseAmount(input) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    throw new Error("Amount is invalid");
  }
  const normalized = Math.round(parsed * 100) / 100;
  if (normalized < 1 || normalized > 200) {
    throw new Error("Amount must be between £1 and £200");
  }
  return normalized;
}

function parseBoxNum(input) {
  const fallback = input === undefined || input === null || input === "" ? unipayDefaultBoxNum : input;
  const parsed = Number(fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Box number is invalid");
  }
  return parsed;
}

function formatBayLabel(boxNum, bays) {
  const list = Array.isArray(bays) ? bays.map(String) : [];
  const idx = list.findIndex((bay) => String(bay) === String(boxNum));
  if (idx >= 0) {
    return `Bay ${idx + 1}`;
  }
  return `Bay ${boxNum}`;
}

function resolvePublicBaseUrl(req) {
  if (publicAppUrl) {
    return publicAppUrl;
  }
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const host = forwardedHost || String(req.headers.host || "").trim();
  const proto = forwardedProto || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
  if (host) {
    return `${proto}://${host}`;
  }
  return "http://127.0.0.1:5500";
}

function resolveTopupPath() {
  if (!publicTopupPath) {
    return "/";
  }
  return publicTopupPath.startsWith("/") ? publicTopupPath : `/${publicTopupPath}`;
}

function joinUnipayPath(path) {
  return new URL(path.replace(/^\/+/, ""), unipayBaseUrl).toString();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = unipayTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getTokenFromResponse(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  if (payload.access_token || payload.token || payload.accessToken) {
    return payload.access_token || payload.token || payload.accessToken || "";
  }
  if (payload.data && typeof payload.data === "object") {
    return payload.data.access_token || payload.data.token || payload.data.accessToken || "";
  }
  return "";
}

function getBasicAuthHeader() {
  if (!unipayClientId || !unipayClientSecret) {
    return "";
  }
  return `Basic ${Buffer.from(`${unipayClientId}:${unipayClientSecret}`).toString("base64")}`;
}

function applyClientHeaders(headers, force = false) {
  if (!force && !unipaySendClientHeaders) {
    return;
  }
  if (unipayClientId) {
    headers[unipayHeaderClientIdName] = unipayClientId;
    headers.client_id = unipayClientId;
  }
  if (unipayClientSecret) {
    headers[unipayHeaderClientSecretName] = unipayClientSecret;
    headers.client_secret = unipayClientSecret;
  }
}

function applyOptionalClientHeaders(headers) {
  applyClientHeaders(headers, false);
}

function applyForcedClientHeaders(headers) {
  applyClientHeaders(headers, true);
}

async function getUnipayAccessToken(forceRefresh = false) {
  if (unipayAuthMode === "none" || unipayAuthMode === "basic" || unipayAuthMode === "client_headers") {
    return "";
  }

  if (unipayAuthMode === "bearer") {
    if (!unipayStaticToken) {
      throw new Error("UNIPAY_STATIC_TOKEN is required when UNIPAY_AUTH_MODE=bearer");
    }
    return unipayStaticToken;
  }

  if (!unipayTokenUrl) {
    throw new Error("UNIPAY_TOKEN_URL is required when UNIPAY_AUTH_MODE=oauth2");
  }

  const now = Date.now();
  if (!forceRefresh && tokenCache.value && tokenCache.expiresAt > now + 10000) {
    return tokenCache.value;
  }

  if (!unipayClientId || !unipayClientSecret) {
    throw new Error("Unipay credentials are missing");
  }

  const formBody = new URLSearchParams({
    client_id: unipayClientId,
    client_secret: unipayClientSecret,
  }).toString();
  const formBodyWithGrant = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: unipayClientId,
    client_secret: unipayClientSecret,
  }).toString();
  const formGrantOnlyBody = new URLSearchParams({
    grant_type: "client_credentials",
  }).toString();
  const basicAuth = getBasicAuthHeader();

  const attempts = [
    {
      label: "json(client_id+client_secret)",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: unipayClientId,
        client_secret: unipayClientSecret,
      }),
    },
    {
      label: "form(client_id+client_secret)",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    },
    {
      label: "json(grant_type+client_id+client_secret)",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: unipayClientId,
        client_secret: unipayClientSecret,
      }),
    },
    {
      label: "form(grant_type+client_id+client_secret)",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBodyWithGrant,
    },
  ];
  if (basicAuth) {
    attempts.push(
      {
        label: "form(grant_type)+basic",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: basicAuth,
        },
        body: formGrantOnlyBody,
      },
      {
        label: "json(grant_type)+basic",
        headers: {
          "Content-Type": "application/json",
          Authorization: basicAuth,
        },
        body: JSON.stringify({ grant_type: "client_credentials" }),
      },
    );
  }

  let lastError = "Unable to fetch token";

  for (const attempt of attempts) {
    const headers = { Accept: "application/json", ...attempt.headers };
    applyOptionalClientHeaders(headers);

    const response = await fetchWithTimeout(unipayTokenUrl, {
      method: "POST",
      headers,
      body: attempt.body,
    });

    const payload = await parseResponse(response);
    if (response.ok) {
      const token = getTokenFromResponse(payload);
      if (!token) {
        lastError = "Token endpoint responded without access_token";
        continue;
      }
      const expiresIn = Number(payload.expires_in || 3600);
      tokenCache = {
        value: token,
        expiresAt: Date.now() + expiresIn * 1000,
      };
      return token;
    }

    const details = payload?.error_description || payload?.error || payload?.message || JSON.stringify(payload);
    lastError = `Token request failed (${response.status}) [${attempt.label}]: ${details}`;
  }

  throw new Error(`${lastError}. Check UNIPAY_TOKEN_URL or switch UNIPAY_AUTH_MODE.`);
}

async function getUnipayAuthHeaders(hasRetried = false) {
  const headers = {};

  if (unipayAuthMode === "none") {
    applyOptionalClientHeaders(headers);
    return headers;
  }

  if (unipayAuthMode === "basic") {
    const basicAuth = getBasicAuthHeader();
    if (!basicAuth) {
      throw new Error("Unipay basic auth requires UNIPAY_CLIENT_ID and UNIPAY_CLIENT_SECRET");
    }
    headers.Authorization = basicAuth;
    applyOptionalClientHeaders(headers);
    return headers;
  }

  if (unipayAuthMode === "bearer") {
    if (!unipayStaticToken) {
      throw new Error("Unipay bearer auth requires UNIPAY_STATIC_TOKEN");
    }
    headers.Authorization = `Bearer ${unipayStaticToken}`;
    applyOptionalClientHeaders(headers);
    return headers;
  }

  if (unipayAuthMode === "client_headers") {
    applyForcedClientHeaders(headers);
    return headers;
  }

  const token = await getUnipayAccessToken(hasRetried);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  applyOptionalClientHeaders(headers);
  return headers;
}

function buildAutoAuthStrategies() {
  const strategies = [];
  const basicAuth = getBasicAuthHeader();

  if (unipayStaticToken) {
    strategies.push({
      name: "bearer_static",
      getHeaders: async () => {
        const headers = { Authorization: `Bearer ${unipayStaticToken}` };
        applyOptionalClientHeaders(headers);
        return headers;
      },
    });
  }

  strategies.push({
    name: "oauth2",
    getHeaders: async () => {
      const token = await getUnipayAccessToken(false);
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      applyOptionalClientHeaders(headers);
      return headers;
    },
    onUnauthorized: () => {
      tokenCache = { value: "", expiresAt: 0 };
    },
  });

  if (basicAuth) {
    strategies.push({
      name: "basic",
      getHeaders: async () => ({ Authorization: basicAuth }),
    });
    strategies.push({
      name: "basic_with_headers",
      getHeaders: async () => {
        const headers = { Authorization: basicAuth };
        applyForcedClientHeaders(headers);
        return headers;
      },
    });
  }

  if (unipayClientId || unipayClientSecret) {
    strategies.push({
      name: "client_headers",
      getHeaders: async () => {
        const headers = {};
        applyForcedClientHeaders(headers);
        return headers;
      },
    });
  }

  strategies.push({
    name: "none",
    getHeaders: async () => ({}),
  });

  if (!autoAuthStrategyName) {
    return strategies;
  }

  const preferred = strategies.find((strategy) => strategy.name === autoAuthStrategyName);
  if (!preferred) {
    return strategies;
  }

  return [preferred, ...strategies.filter((strategy) => strategy.name !== autoAuthStrategyName)];
}

async function sendUnipayRequest(method, path, payload, authHeaders) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(authHeaders || {}),
  };

  const response = await fetchWithTimeout(joinUnipayPath(path), {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const body = await parseResponse(response);
  return { response, body };
}

async function unipayRequestAuto(method, path, payload) {
  const strategyErrors = [];
  const strategies = buildAutoAuthStrategies();

  for (const strategy of strategies) {
    let authHeaders;
    try {
      authHeaders = await strategy.getHeaders();
    } catch (error) {
      strategyErrors.push(`${strategy.name}: ${error.message}`);
      continue;
    }

    const { response, body } = await sendUnipayRequest(method, path, payload, authHeaders);

    if (response.ok) {
      autoAuthStrategyName = strategy.name;
      return body;
    }

    if (response.status === 401 || response.status === 403) {
      if (typeof strategy.onUnauthorized === "function") {
        strategy.onUnauthorized();
      }
      strategyErrors.push(`${strategy.name}: ${response.status} ${JSON.stringify(body)}`);
      continue;
    }

    throw new Error(`Unipay ${method} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }

  throw new Error(`Unipay authentication failed for all strategies: ${strategyErrors.join(" | ")}`);
}

async function unipayRequest(method, path, payload, hasRetried = false) {
  if (unipayAuthMode === "auto") {
    return unipayRequestAuto(method, path, payload);
  }

  const authHeaders = await getUnipayAuthHeaders(hasRetried);
  const { response, body } = await sendUnipayRequest(method, path, payload, authHeaders);

  if (response.status === 401 && !hasRetried && unipayAuthMode === "oauth2") {
    tokenCache = { value: "", expiresAt: 0 };
    return unipayRequest(method, path, payload, true);
  }

  if (!response.ok) {
    throw new Error(`Unipay ${method} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }

  return body;
}

function machineUnavailable(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  if (
    payload.online === false ||
    payload.is_online === false ||
    payload.isOnline === false ||
    payload.available === false
  ) {
    return true;
  }
  if (typeof payload.status === "string") {
    const status = payload.status.toLowerCase();
    if (["offline", "unavailable", "busy", "error"].includes(status)) {
      return true;
    }
  }
  return false;
}

async function checkBoxAvailability(boxNum, amount) {
  const availability = await unipayRequest("GET", `boxServices/${boxNum}`);
  if (machineUnavailable(availability)) {
    throw new Error("Selected bay is currently unavailable");
  }

  const min = toNumber(
    availability.min_amount ??
      availability.minAmount ??
      availability.amount_min ??
      availability.sur_rules?.min_sum,
  );
  const max = toNumber(
    availability.max_amount ??
      availability.maxAmount ??
      availability.amount_max ??
      availability.sur_rules?.max_sum,
  );

  if (min !== null && amount < min) {
    throw new Error(`Minimum allowed amount for this bay is £${min.toFixed(2)}`);
  }
  if (max !== null && amount > max) {
    throw new Error(`Maximum allowed amount for this bay is £${max.toFixed(2)}`);
  }

  return availability;
}

async function registerUnipayPayment(boxNum, amount) {
  const pennies = Math.round(Number(amount) * 100);
  const amountWhole = Math.floor(pennies / 100);
  const kop = pennies % 100;

  const payload = await unipayRequest("POST", "payRequest", {
    amount: amountWhole,
    box_num: boxNum,
    desc: unipayPaymentDesc,
    kop,
  });

  const payId = payload.pay_id ?? payload.payId ?? payload.id;
  if (!payId) {
    throw new Error(`Unipay payRequest did not return pay_id: ${JSON.stringify(payload)}`);
  }

  const payIdInt = Number(payId);
  if (!Number.isInteger(payIdInt) || payIdInt <= 0) {
    throw new Error(`Unipay pay_id is not a valid integer: ${JSON.stringify(payId)}`);
  }

  return { payId: payIdInt, payload };
}

async function acknowledgeUnipayPayment(payId) {
  return unipayRequest("POST", "payAck", { pay_id: payId });
}

function extractStatusCode(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const code = payload.status ?? payload.pay_status ?? payload.state ?? payload.code;
  const parsed = Number(code);
  return Number.isFinite(parsed) ? parsed : null;
}

async function waitForUnipayStatus(payId) {
  let lastPayload = {};

  for (let attempt = 0; attempt < unipayStatusRetries; attempt += 1) {
    const payload = await unipayRequest("GET", `payStatus/${payId}`);
    lastPayload = payload;
    const statusCode = extractStatusCode(payload);

    if (statusCode === 2) {
      return payload;
    }
    if (statusCode === 3) {
      throw new Error("Machine start failed (status 3)");
    }

    if (attempt < unipayStatusRetries - 1) {
      await delay(unipayStatusDelayMs);
    }
  }

  return lastPayload;
}

app.get("/api/health", async (_req, res) => {
  res.json({
    ok: true,
    appVersion,
    stripeConfigured: Boolean(stripeSecretKey),
    unipayBaseUrl: unipayBaseUrl || null,
    unipayAuthMode,
    unipayAutoAuthStrategy: autoAuthStrategyName || null,
    unipayTokenUrl: unipayTokenUrl || null,
    unipaySendClientHeaders,
    defaultBox: unipayDefaultBoxNum,
  });
});

app.get("/api/settings", async (_req, res) => {
  try {
    const settings = await readSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load settings" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    if (requireDashboardPin) {
      const provided = String(req.body?.pin || "");
      if (provided !== String(dashboardAdminPin)) {
        return res.status(403).json({ error: "Invalid admin PIN" });
      }
    }
    const current = await readSettings();
    const next = sanitizeSettings(req.body || {}, current);
    await writeSettings(next);
    res.json(next);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to save settings" });
  }
});

app.post("/api/topup/create-session", async (req, res) => {
  try {
    assertConfigured();

    const amountCharged = parseAmount(req.body?.amount);
    const boxNum = parseBoxNum(req.body?.boxNum);
    let creditAmount = amountCharged;
    if (req.body?.creditAmount !== undefined) {
      creditAmount = parseAmount(req.body?.creditAmount);
      if (creditAmount < amountCharged) {
        creditAmount = amountCharged;
      }
    }
    const bonusAmount = Math.max(0, creditAmount - amountCharged);

    await checkBoxAvailability(boxNum, creditAmount);

    const settings = await readSettings();
    const bayLabel = formatBayLabel(boxNum, settings?.bays || defaultBays);

    const baseUrl = resolvePublicBaseUrl(req);
    const topupPath = resolveTopupPath();
    const successUrl = `${baseUrl}${topupPath}?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}${topupPath}?payment=cancelled`;

    const paymentIntentData = {
      metadata: {
        box_num: String(boxNum),
        topup_amount_charged: amountCharged.toFixed(2),
        topup_amount_credit: creditAmount.toFixed(2),
        bonus_amount: bonusAmount.toFixed(2),
      },
    };

    if (stripeConnectAccountId) {
      paymentIntentData.application_fee_amount = Math.max(0, Math.floor(platformFeePence));
      paymentIntentData.transfer_data = { destination: stripeConnectAccountId };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: stripeCurrency,
            unit_amount: Math.round(amountCharged * 100),
            product_data: {
              name: `LuxWash Top Up - ${bayLabel}`,
              description: `Machine top-up £${amountCharged.toFixed(2)}${bonusAmount > 0 ? ` (+£${bonusAmount.toFixed(2)} bonus)` : ""}${bayLabel === `Bay ${boxNum}` ? "" : ` • Box ${boxNum}`}`,
            },
          },
        },
      ],
      metadata: {
        box_num: String(boxNum),
        topup_amount: amountCharged.toFixed(2),
        topup_amount_charged: amountCharged.toFixed(2),
        topup_amount_credit: creditAmount.toFixed(2),
        bonus_amount: bonusAmount.toFixed(2),
      },
      payment_intent_data: paymentIntentData,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to create checkout session" });
  }
});

app.post("/api/topup/confirm", async (req, res) => {
  try {
    assertConfigured();

    const sessionId = req.body?.sessionId;
    if (!sessionId || typeof sessionId !== "string") {
      throw new Error("sessionId is required");
    }

    if (completedSessions.has(sessionId)) {
      return res.json(completedSessions.get(sessionId));
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });
    if (!session || session.payment_status !== "paid") {
      throw new Error("Payment is not confirmed yet");
    }

    const sessionMeta = session.metadata || {};
    const paymentIntentMeta = typeof session.payment_intent === "object" && session.payment_intent?.metadata
      ? session.payment_intent.metadata
      : {};

    const amountChargedFromSession = sessionMeta.topup_amount_charged
      ? Number(sessionMeta.topup_amount_charged)
      : paymentIntentMeta.topup_amount_charged
        ? Number(paymentIntentMeta.topup_amount_charged)
        : sessionMeta.topup_amount
          ? Number(sessionMeta.topup_amount)
          : Number((session.amount_total || 0) / 100);
    const amountCreditFromSession = sessionMeta.topup_amount_credit
      ? Number(sessionMeta.topup_amount_credit)
      : paymentIntentMeta.topup_amount_credit
        ? Number(paymentIntentMeta.topup_amount_credit)
      : amountChargedFromSession;

    const amountCharged = parseAmount(amountChargedFromSession);
    let creditAmount = parseAmount(amountCreditFromSession);
    if (creditAmount < amountCharged) {
      creditAmount = amountCharged;
    }
    const bonusAmount = Math.max(0, creditAmount - amountCharged);
    const boxNum = parseBoxNum(req.body?.boxNum ?? sessionMeta.box_num ?? paymentIntentMeta.box_num);

    await checkBoxAvailability(boxNum, creditAmount);

    let payment;
    let statusPayload;
    try {
      payment = await registerUnipayPayment(boxNum, creditAmount);
      await acknowledgeUnipayPayment(payment.payId);
      statusPayload = await waitForUnipayStatus(payment.payId);
    } catch (error) {
      await logTransaction({
        id: `tx_${sessionId}`,
        sessionId,
        amount: amountCharged,
        creditAmount,
        bonusAmount,
        boxNum,
        payId: payment?.payId ?? null,
        createdAt: new Date().toISOString(),
        status: "failed",
        error: error.message,
      });
      throw error;
    }

    const result = {
      ok: true,
      sessionId,
      amount: amountCharged,
      creditAmount,
      bonusAmount,
      boxNum,
      payId: payment.payId,
      unipayStatus: statusPayload,
    };

    await logTransaction({
      id: `tx_${sessionId}`,
      sessionId,
      amount: amountCharged,
      creditAmount,
      bonusAmount,
      boxNum,
      payId: payment.payId,
      createdAt: new Date().toISOString(),
      status: "started",
    });

    completedSessions.set(sessionId, result);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Unable to complete top-up" });
  }
});

app.get("/api/dashboard/summary", async (_req, res) => {
  try {
    const transactions = await readDashboardTransactions();
    const filtered = applyFilters(transactions, _req.query);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = now.getTime();

    const today = filterByRange(filtered, startOfDay, end);
    const week = filterByRange(filtered, startOfWeek, end);
    const month = filterByRange(filtered, startOfMonth, end);

    const last7 = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
      const daily = filterByRange(filtered, dayStart, dayEnd);
      last7.push({ date: toDateKey(day), total: Number(sumAmounts(daily).toFixed(2)) });
    }

    const byBay = {};
    filtered.forEach((tx) => {
      const key = String(tx.boxNum || "unknown");
      byBay[key] = (byBay[key] || 0) + Number(tx.amount || 0);
    });

    res.json({
      totals: {
        today: Number(sumAmounts(today).toFixed(2)),
        week: Number(sumAmounts(week).toFixed(2)),
        month: Number(sumAmounts(month).toFixed(2)),
        all: Number(sumAmounts(filtered).toFixed(2)),
      },
      counts: {
        today: today.length,
        week: week.length,
        month: month.length,
        all: filtered.length,
      },
      byBay,
      last7,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to build summary" });
  }
});

app.get("/api/dashboard/transactions", async (req, res) => {
  try {
    const transactions = await readDashboardTransactions();
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const filtered = applyFilters(transactions, req.query);
    res.json({ items: filtered.slice(0, limit) });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load transactions" });
  }
});

app.get("/api/dashboard/transactions.csv", async (_req, res) => {
  try {
    const transactions = await readDashboardTransactions();
    const filtered = applyFilters(transactions, _req.query);
    const headers = ["createdAt", "boxNum", "amount", "creditAmount", "bonusAmount", "payId", "status", "error", "sessionId"];
    const rows = [headers.join(",")];
    filtered.forEach((tx) => {
      const values = headers.map((key) => {
        const raw = tx[key] ?? "";
        const str = String(raw).replace(/\"/g, '\"\"');
        return `"${str}"`;
      });
      rows.push(values.join(","));
    });
    res.setHeader("Content-Type", "text/csv");
    res.send(rows.join("\n"));
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to export csv" });
  }
});

app.get("/api/dashboard/alerts", async (req, res) => {
  try {
    const transactions = await readDashboardTransactions();
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const filtered = applyFilters(transactions, req.query);
    const failed = filtered.filter((tx) => tx.status === "failed").slice(0, limit);
    res.json({ items: failed });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load alerts" });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, host, () => {
    console.log(`LuxWash backend ${appVersion} running on http://${host}:${port}`);
  });
}

export default app;
