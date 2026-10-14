import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { openDb } from "./db";

const db = openDb(process.env.DB_PATH ?? "tracker.db");
const app = createApp(db);
const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`Sync server listening on http://localhost:${info.port}`);
});
