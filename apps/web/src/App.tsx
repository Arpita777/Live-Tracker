import { useLiveQuery } from "dexie-react-hooks";
import type { Issue } from "@tracker/schema";
import { db } from "./db/db";

const projectId = crypto.randomUUID();

async function addTestIssue() {
  const now = Date.now();
  const issue: Issue = {
    id: crypto.randomUUID(),
    projectId,
    title: `Test issue ${new Date().toLocaleTimeString()}`,
    description: "",
    status: "todo",
    priority: "medium",
    assigneeId: null,
    labels: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.issues.put(issue);
}

export default function App() {
  const issues = useLiveQuery(() => db.issues.toArray(), []);

  return (
    <div>
      <h1>Tracker</h1>
      <button onClick={addTestIssue}>Add test issue</button>
      <ul>
        {issues?.map((i) => (
          <li key={i.id}>{i.title}</li>
        ))}
      </ul>
    </div>
  );
}
