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
