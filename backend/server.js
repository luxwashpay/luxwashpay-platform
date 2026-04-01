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
const publicAppUrl = env("PUBLIC_APP_URL", "http://127.0.0.1:5500").replace(/\/+$/, "");
const publicTopupPath = env("PUBLIC_TOPUP_PATH", "/luxwash_v11_booking_fee.html");

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
const transactionsFile = path.join(__dirname, "data", "transactions.json");

let tokenCache = { value: "", expiresAt: 0 };
let autoAuthStrategyName = "";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readTransactions() {
  try {
    const raw = await fs.readFile(transactionsFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeTransactions(list) {
  await fs.writeFile(transactionsFile, JSON.stringify(list, null, 2));
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

app.post("/api/topup/create-session", async (req, res) => {
  try {
    assertConfigured();

    const amount = parseAmount(req.body?.amount);
    const boxNum = parseBoxNum(req.body?.boxNum);

    await checkBoxAvailability(boxNum, amount);

    const successUrl = `${publicAppUrl}${publicTopupPath}?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${publicAppUrl}${publicTopupPath}?payment=cancelled`;

    const paymentIntentData = {
      metadata: {
        box_num: String(boxNum),
        topup_amount: amount.toFixed(2),
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
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `LuxWash Top Up - Bay ${boxNum}`,
              description: `Machine top-up credit £${amount.toFixed(2)}`,
            },
          },
        },
      ],
      metadata: {
        box_num: String(boxNum),
        topup_amount: amount.toFixed(2),
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

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== "paid") {
      throw new Error("Payment is not confirmed yet");
    }

    const amountFromSession = session.metadata?.topup_amount
      ? Number(session.metadata.topup_amount)
      : Number((session.amount_total || 0) / 100);

    const amount = parseAmount(amountFromSession);
    const boxNum = parseBoxNum(req.body?.boxNum ?? session.metadata?.box_num);

    await checkBoxAvailability(boxNum, amount);

    let payment;
    let statusPayload;
    try {
      payment = await registerUnipayPayment(boxNum, amount);
      await acknowledgeUnipayPayment(payment.payId);
      statusPayload = await waitForUnipayStatus(payment.payId);
    } catch (error) {
      await logTransaction({
        id: `tx_${sessionId}`,
        sessionId,
        amount,
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
      amount,
      boxNum,
      payId: payment.payId,
      unipayStatus: statusPayload,
    };

    await logTransaction({
      id: `tx_${sessionId}`,
      sessionId,
      amount,
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
    const transactions = await readTransactions();
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
    const transactions = await readTransactions();
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const filtered = applyFilters(transactions, req.query);
    res.json({ items: filtered.slice(0, limit) });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load transactions" });
  }
});

app.get("/api/dashboard/transactions.csv", async (_req, res) => {
  try {
    const transactions = await readTransactions();
    const filtered = applyFilters(transactions, _req.query);
    const headers = ["createdAt", "boxNum", "amount", "payId", "status", "error", "sessionId"];
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
    const transactions = await readTransactions();
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const filtered = applyFilters(transactions, req.query);
    const failed = filtered.filter((tx) => tx.status === "failed").slice(0, limit);
    res.json({ items: failed });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load alerts" });
  }
});

app.listen(port, host, () => {
  console.log(`LuxWash backend ${appVersion} running on http://${host}:${port}`);
});
