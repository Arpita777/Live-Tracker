import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/db";
import { createIssue } from "./db/issueRepo";
import { Board } from "./features/board/Board";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

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
    <div style={{ padding: 24 }}>
      <h1>Tracker</h1>

      <div style={{ marginBottom: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="New issue title"
        />{" "}
        <button onClick={handleAdd}>Add</button>
      </div>

      <Board issues={issues ?? []} />
    </div>
  );
}
