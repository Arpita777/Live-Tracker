import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/db";
import { createIssue, deleteIssue, updateIssue } from "./db/issueRepo";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111"; // fixed for now

export default function App() {
  const [title, setTitle] = useState("");

  const issues = useLiveQuery(
    () =>
      db.issues
        .where("projectId")
        .equals(PROJECT_ID)
        .filter((i) => i.deletedAt === null)
        .toArray(),
    []
  );

  async function handleAdd() {
    if (!title.trim()) return;
    await createIssue({ projectId: PROJECT_ID, title: title.trim() });
    setTitle("");
  }

  return (
    <div>
      <h1>Tracker</h1>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New issue title"
      />
      <button onClick={handleAdd}>Add</button>

      <ul>
        {issues?.map((i) => (
          <li key={i.id}>
            {i.title} [{i.status}]{" "}
            <button onClick={() => updateIssue(i.id, { status: "done" })}>
              Mark done
            </button>{" "}
            <button onClick={() => deleteIssue(i.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
