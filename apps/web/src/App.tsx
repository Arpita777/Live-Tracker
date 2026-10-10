import { useMemo, useState, useTransition } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/db";
import { createIssue } from "./db/issueRepo";
import { Board } from "./features/board/Board";
import { FilterBar } from "./features/board/FilterBar";
import {
  DEFAULT_FILTERS,
  filterIssues,
  type Filters,
} from "./features/board/filterIssues";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

export default function App() {
  const [title, setTitle] = useState("");

  // Two copies of the search text:
  // searchText = what's in the box (urgent, must update instantly)
  // filters    = what the board uses (can wait a moment)
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isPending, startTransition] = useTransition();

  const issues = useLiveQuery(
    () =>
      db.issues
        .where("projectId")
        .equals(PROJECT_ID)
        .filter((i) => i.deletedAt === null)
        .toArray(),
    []
  );

  const visibleIssues = useMemo(
    () => filterIssues(issues ?? [], filters),
    [issues, filters]
  );

  function handleSearchChange(value: string) {
    setSearchText(value); // urgent: the box updates right away
    startTransition(() => {
      setFilters((f) => ({ ...f, search: value })); // can wait
    });
  }

  function handlePriorityChange(priority: Filters["priority"]) {
    startTransition(() => {
      setFilters((f) => ({ ...f, priority }));
    });
  }

  function handleClear() {
    setSearchText("");
    setFilters(DEFAULT_FILTERS);
  }

  async function handleAdd() {
    if (!title.trim()) return;
    await createIssue({ projectId: PROJECT_ID, title: title.trim() });
    setTitle("");
  }

  const hasFilters = filters.search !== "" || filters.priority !== "all";
  const total = issues?.length ?? 0;

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

      <FilterBar
        searchText={searchText}
        priority={filters.priority}
        onSearchChange={handleSearchChange}
        onPriorityChange={handlePriorityChange}
        onClear={handleClear}
      />

      {hasFilters && (
        <p style={{ opacity: 0.7 }}>
          Showing {visibleIssues.length} of {total} issues
          {visibleIssues.length === 0 && " (nothing matches, try Clear)"}
        </p>
      )}

      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        <Board issues={visibleIssues} />
      </div>
    </div>
  );
}
