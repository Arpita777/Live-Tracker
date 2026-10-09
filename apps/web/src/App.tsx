import { IssueSchema, type Issue } from "@tracker/schema";

const sample: Issue = {
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  title: "First issue",
  description: "",
  status: "todo",
  priority: "medium",
  assigneeId: null,
  labels: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  deletedAt: null,
};

console.log(IssueSchema.safeParse(sample).success); // true
console.log(IssueSchema.safeParse({ ...sample, title: "" }).success); // false

export default function App() {
  return <h1>Tracker</h1>;
}
