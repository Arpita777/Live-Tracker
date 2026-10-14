import { useEffect, useMemo, useState, useTransition } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { IssuePriority } from "@tracker/schema";
import { db } from "./db/db";
import { createIssue } from "./db/issueRepo";
import { countOpenConflicts } from "./db/conflictRepo";
import { clearIssues, seedIssues } from "./db/seed";
import { sync } from "./sync/syncClient";
import { Board } from "./features/board/Board";
import { FilterBar } from "./features/board/FilterBar";
import {
  DEFAULT_FILTERS,
  filterIssues,
  type Filters,
} from "./features/board/filterIssues";
import { IssuePanel } from "./features/issues/IssuePanel";
import { ConflictPanel } from "./features/conflicts/ConflictPanel";
import {
  CommandPalette,
  type Command,
} from "./features/command-palette/CommandPalette";
import "./app.css";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

export default function App() {
  const [title, setTitle] = useState("");

  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isPending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);

  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">(
    "idle"
  );
  const [syncMessage, setSyncMessage] = useState("");

  const issues = useLiveQuery(
    () =>
      db.issues
        .where("projectId")
        .equals(PROJECT_ID)
        .filter((i) => i.deletedAt === null)
        .toArray(),
    []
  );

  const pendingCount = useLiveQuery(() => db.outbox.count(), [], 0);
  const openConflicts = useLiveQuery(() => countOpenConflicts(), [], 0);

  const visibleIssues = useMemo(
    () => filterIssues(issues ?? [], filters),
    [issues, filters]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSearchChange(value: string) {
    setSearchText(value);
    startTransition(() => {
      setFilters((f) => ({ ...f, search: value }));
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

  async function handleSync() {
    setSyncState("syncing");
    try {
      const result = await sync.syncNow();
      setSyncState("idle");
      setSyncMessage(
        `Sent ${result.pushed} · fetched ${result.pulled}` +
          (result.conflicts > 0 ? ` · ${result.conflicts} conflict(s)` : "")
      );
    } catch (error) {
      setSyncState("error");
      setSyncMessage(error instanceof Error ? error.message : "Sync failed");
    }
  }

  const hasFilters = filters.search !== "" || filters.priority !== "all";
  const total = issues?.length ?? 0;
  const selectedIssue = issues?.find((i) => i.id === selectedId) ?? null;

  const commands: Command[] = [
    { id: "clear", label: "Clear filters", run: handleClear },
    {
      id: "conflicts",
      label: "Open conflicts",
      run: () => setConflictsOpen(true),
    },
    ...IssuePriority.options.map((p) => ({
      id: `priority-${p}`,
      label: `Filter priority: ${p}`,
      run: () => handlePriorityChange(p),
    })),
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tracker</h1>

        <div className="add-form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="New issue title"
            aria-label="New issue title"
          />
          <button className="primary" onClick={handleAdd}>
            Add issue
          </button>
        </div>

        <button onClick={handleSync} disabled={syncState === "syncing"}>
          {syncState === "syncing" ? "Syncing..." : "Sync now"}
        </button>
        <span
          className="hint"
          style={syncState === "error" ? { color: "var(--danger)" } : undefined}
        >
          {syncMessage}
        </span>
        <span className="hint">{pendingCount} pending changes</span>
        {openConflicts > 0 && (
          <button
            onClick={() => setConflictsOpen(true)}
            style={{ color: "var(--danger)" }}
          >
            {openConflicts} conflict(s)
          </button>
        )}
        <span className="hint">Cmd+K for commands</span>
      </header>

      {import.meta.env.DEV && (
        <div className="dev-bar">
          Dev tools:
          <button onClick={() => seedIssues(PROJECT_ID)}>
            Seed 10,000 issues
          </button>
          <button onClick={() => clearIssues()}>Clear all</button>
        </div>
      )}

      <FilterBar
        searchText={searchText}
        priority={filters.priority}
        onSearchChange={handleSearchChange}
        onPriorityChange={handlePriorityChange}
        onClear={handleClear}
      />

      <p className="count">
        Showing {visibleIssues.length} of {total} issues
        {hasFilters &&
          visibleIssues.length === 0 &&
          " (nothing matches, try Clear)"}
        {" · "}Tab to a card, arrows move, Enter opens, [ ] change status, Space
        drags
      </p>

      <div className="board-area" style={{ opacity: isPending ? 0.6 : 1 }}>
        <Board issues={visibleIssues} onOpenIssue={setSelectedId} />
      </div>

      {selectedIssue && (
        <IssuePanel
          key={selectedIssue.id}
          issue={selectedIssue}
          onClose={() => setSelectedId(null)}
        />
      )}

      {conflictsOpen && (
        <ConflictPanel onClose={() => setConflictsOpen(false)} />
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
