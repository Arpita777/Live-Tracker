import { useMemo, useState, useTransition, useEffect } from "react";
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
import { IssuePanel } from "./features/issues/IssuePanel";
import { clearIssues, seedIssues } from "./db/seed";
import { IssuePriority } from "@tracker/schema";
import {
  CommandPalette,
  type Command,
} from "./features/command-palette/CommandPalette";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

export default function App() {
  const [title, setTitle] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Two copies of the search text:
  // searchText = what's in the box (urgent, must update instantly)
  // filters    = what the board uses (can wait a moment)
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); // stop the browser's own Cmd+K
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  // Look up from ALL issues (not the filtered ones), so a filter never closes the panel
  const selectedIssue = issues?.find((i) => i.id === selectedId) ?? null;

  const commands: Command[] = [
    { id: "clear", label: "Clear filters", run: handleClear },
    ...IssuePriority.options.map((p) => ({
      id: `priority-${p}`,
      label: `Filter priority: ${p}`,
      run: () => handlePriorityChange(p),
    })),
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1>Tracker</h1>
      {import.meta.env.DEV && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => seedIssues(PROJECT_ID)}>
            Seed 10,000 issues
          </button>{" "}
          <button onClick={() => clearIssues()}>Clear all issues</button>
        </div>
      )}

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
        <Board issues={visibleIssues} onOpenIssue={setSelectedId} />
      </div>

      {selectedIssue && (
        <IssuePanel
          key={selectedIssue.id}
          issue={selectedIssue}
          onClose={() => setSelectedId(null)}
        />
      )}
      {paletteOpen && (
        <CommandPalette
          issues={issues ?? []}
          commands={commands}
          onCreate={(t) => createIssue({ projectId: PROJECT_ID, title: t })}
          onOpenIssue={setSelectedId}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
