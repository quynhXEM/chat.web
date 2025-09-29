import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const APP_ID = process.env.REACT_APP_ID;
const APP_TOKEN = process.env.REACT_APP_TOKEN;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:8080"; // chỉnh nếu cần

if (!APP_ID || !APP_TOKEN) {
    // eslint-disable-next-line no-console
    console.error("Missing APP_ID/APP_TOKEN in environment");
    process.exit(1);
}

const app = express();

// Basic CORS for browser clients (8080 -> 4000)
const corsMiddleware: express.RequestHandler = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", CORS_ORIGIN === "*" ? "*" : CORS_ORIGIN);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        res.sendStatus(200);
        return;
    }
    next();
};
app.use(corsMiddleware);

app.get("/api/servers", async (req, res) => {
    try {
        const limit = (req.query.limit ?? 100) as string | number;
        const fields = (req.query.fields ?? "domain,is_default") as string;
        const meta = (req.query.meta ?? "filter_count") as string;

        const url = `${process.env.REACT_APP_API_URL}/items/connect_server?filter[app_id]=${encodeURIComponent(
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

app.get("/api/metadata", async (req, res) => {
    try {
        const url = `${process.env.REACT_APP_API_URL}/items/app/${process.env.REACT_APP_ID}?fields=*,translation.*&deep[translation][_filter][language_code]=en-US`
        const upstream = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${APP_TOKEN}`,
            },
        });
        const contentType = upstream.headers.get("content-type") || "application/json";
        const text = await upstream.json();
        res.status(upstream.status).type(contentType).send(text);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Proxy error" });
    }
})

app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Proxy listening on http://localhost:${PORT}`);
});


