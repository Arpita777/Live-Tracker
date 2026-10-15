import { Hono } from "hono";
import { cors } from "hono/cors";
import { PullQuerySchema, PushRequestSchema, formatHlc } from "@tracker/schema";
import { getEpoch, type Db } from "./db";
import { pullMutations } from "./pull";
import { pushMutations } from "./push";

// The app is built from a db we pass in, so tests can give it an in-memory one
export function createApp(db: Db) {
  const app = new Hono();

  app.use("*", cors()); // the web app runs on a different origin

  app.get("/", (c) => c.text("Tracker sync server is running. Try /health"));

  app.get("/health", (c) => {
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM mutations")
      .get() as unknown as {
      n: number;
    };
    return c.json({
      ok: true,
      mutations: row.n,
      epoch: getEpoch(db),
      sampleHlc: formatHlc({ wall: Date.now(), counter: 0, node: "server" }),
    });
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

  app.get("/pull", (c) => {
    const parsed = PullQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        { error: "Invalid query", issues: parsed.error.issues },
        400
      );
    }
    const { after, limit } = parsed.data;
    return c.json({ ...pullMutations(db, after, limit), epoch: getEpoch(db) });
  });

  return app;
}
