import { Hono } from "hono";
import { cors } from "hono/cors";
import { formatHlc } from "@tracker/schema";
import type { Db } from "./db";
import { pushMutations } from "./push";
import { PullQuerySchema, PushRequestSchema } from "@tracker/schema";
import { pullMutations } from "./pull";

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

  app.get("/pull", (c) => {
    const parsed = PullQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        { error: "Invalid query", issues: parsed.error.issues },
        400
      );
    }
    const { after, limit } = parsed.data;
    return c.json(pullMutations(db, after, limit));
  });

  app.post("/push", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Body must be valid JSON" }, 400);
    }

    const parsed = PushRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", issues: parsed.error.issues },
        400
      );
    }

    return c.json(pushMutations(db, parsed.data.mutations));
  });

  return app;
}
