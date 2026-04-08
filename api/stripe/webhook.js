import app from "../../backend/server.js";

export default function handler(req, res) {
  const qIndex = (req.url || "").indexOf("?");
  const qs = qIndex >= 0 ? req.url.slice(qIndex) : "";
  req.url = "/api/stripe/webhook" + qs;
  return app(req, res);
}
