/* eslint-disable matrix-org/require-copyright-header */
const fetch = require("node-fetch");

module.exports = async (req, res) => {
  const APP_ID = process.env.REACT_APP_ID;
  const APP_TOKEN = process.env.REACT_APP_TOKEN;

  if (!APP_ID || !APP_TOKEN) {
    res.status(500).json({ error: "Missing REACT_APP_ID/REACT_APP_TOKEN in environment" });
    return;
  }

  try {
    const { limit = "100", fields = "domain,is_default", meta = "filter_count" } = req.query;

    const url = `https://soc.socjsc.com/items/connect_server?filter[app_id]=${encodeURIComponent(
      APP_ID
    )}&filter[status]=published&limit=${encodeURIComponent(limit)}&fields=${encodeURIComponent(
      fields
    )}&meta=${encodeURIComponent(meta)}`;

    const upstream = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${APP_TOKEN}`,
      },
    });

    const text = await upstream.text();
    res
      .status(upstream.status)
      .setHeader("Content-Type", upstream.headers.get("content-type") || "application/json")
      .send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
};
