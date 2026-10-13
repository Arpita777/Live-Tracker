import { z } from "zod";

export const MutationSchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  type: z.enum(["create", "update"]),
  changes: z.record(z.string(), z.unknown()),
  createdAt: z.number().int(),
  hlc: z.string(),
});

export const PushRequestSchema = z.object({
  mutations: z.array(MutationSchema).max(500),
});

export type PushRequest = z.infer<typeof PushRequestSchema>;

export type Mutation = z.infer<typeof MutationSchema>;

export const PullQuerySchema = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const PullResponseSchema = z.object({
  mutations: z.array(MutationSchema),
  cursor: z.number().int(),
  hasMore: z.boolean(),
});

export type PullResponse = z.infer<typeof PullResponseSchema>;
