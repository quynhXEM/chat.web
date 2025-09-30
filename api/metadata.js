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
    const url = `${process.env.REACT_APP_API_URL}/items/app/${process.env.REACT_APP_ID}?fields=*,translation.*&deep[translation][_filter][language_code]=en-US`;

    const upstream = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${APP_TOKEN}`,
      },
    });

    const text = await upstream.json();
    res
      .status(upstream.status)
      .type(upstream.headers.get("content-type") || "application/json")
      .send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
};
