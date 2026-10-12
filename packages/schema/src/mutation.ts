import { z } from "zod";

export const MutationSchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  type: z.enum(["create", "update"]),
  changes: z.record(z.string(), z.unknown()),
  createdAt: z.number().int(),
});

export type Mutation = z.infer<typeof MutationSchema>;
