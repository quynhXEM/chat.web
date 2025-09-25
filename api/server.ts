import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const APP_ID = process.env.REACT_APP_ID;
const APP_TOKEN = process.env.REACT_APP_TOKEN;

if (!APP_ID || !APP_TOKEN) {
    // eslint-disable-next-line no-console
    console.error("Missing APP_ID/APP_TOKEN in environment");
    process.exit(1);
}

const app = express();

app.get("/api/servers", async (req, res) => {
    try {
        const limit = (req.query.limit ?? 100) as string | number;
        const fields = (req.query.fields ?? "domain,is_default") as string;
        const meta = (req.query.meta ?? "filter_count") as string;

        const url = `https://soc.socjsc.com/items/connect_server?filter[app_id]=${encodeURIComponent(
            APP_ID as string,
        )}&filter[status]=published&limit=${limit}&fields=${encodeURIComponent(fields)}&meta=${encodeURIComponent(meta)}`;

        const upstream = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${APP_TOKEN}`,
            },
        });

        const contentType = upstream.headers.get("content-type") || "application/json";
        const text = await upstream.text();
        res.status(upstream.status).type(contentType).send(text);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        res.status(500).json({ error: "Proxy error" });
    }
});

app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Proxy listening on http://localhost:${PORT}`);
});


