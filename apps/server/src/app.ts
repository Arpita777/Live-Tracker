import { Hono } from "hono";
import { cors } from "hono/cors";
import { formatHlc } from "@tracker/schema";
import type { Db } from "./db";

// The app is built from a db we pass in, so tests can give it an in-memory one
export function createApp(db: Db) {
  const app = new Hono();

  app.use("*", cors()); // the web app runs on a different port

  app.get("/health", (c) => {
    const row = db.prepare("SELECT COUNT(*) AS n FROM mutations").get() as {
      n: number;
    };
    return c.json({
      ok: true,
      mutations: row.n,
      // proves the shared package is linked
      sampleHlc: formatHlc({ wall: Date.now(), counter: 0, node: "server" }),
    });
  });

  return app;
}
