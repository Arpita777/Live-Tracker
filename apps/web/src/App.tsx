import { useEffect, useMemo, useState, useTransition } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { IssuePriority } from "@tracker/schema";
import { db } from "./db/db";
import { createIssue } from "./db/issueRepo";
import { countOpenConflicts } from "./db/conflictRepo";
import { loadSampleIssues } from "./db/sampleData";
import { clearIssues, seedIssues } from "./db/seed";
import { sync } from "./sync/syncClient";
import { startAutoSync, triggerSync } from "./sync/autoSync";
import { useSyncStatus } from "./sync/useSyncStatus";
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

const SHORTCUT = /Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K";

export default function App() {
  const [title, setTitle] = useState("");

  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isPending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);

  const syncStatus = useSyncStatus();

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

  // Start automatic sync once, stop it when the app unmounts
  useEffect(() => startAutoSync(sync), []);

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

  async function handleLoadSamples() {
    setLoadingSamples(true);
    try {
      await loadSampleIssues(PROJECT_ID);
    } finally {
      setLoadingSamples(false);
    }
  }

  function pill(): { text: string; detail: string; tone: string } {
    switch (syncStatus.phase) {
      case "syncing":
        return syncStatus.lastSyncedAt === null
          ? {
              text: "Connecting...",
              detail:
                "Connecting to the server. The free plan can take up to a minute to wake up.",
              tone: "syncing",
            }
          : { text: "Syncing...", detail: "Syncing changes", tone: "syncing" };
      case "offline":
        return {
          text: "Offline",
          detail:
            "You are offline. Changes are saved on this device and will sync later.",
          tone: "",
        };
      case "error":
        return {
          text: "Retrying...",
          detail:
            "Can't reach the server. Changes are saved locally and will sync when it is back.",
          tone: "error",
        };
      default:
        return pendingCount > 0
          ? {
              text: `${pendingCount} pending`,
              detail: `${pendingCount} change(s) waiting to sync`,
              tone: "",
            }
          : { text: "Synced", detail: "All changes synced", tone: "ok" };
    }
  }

  const syncPill = pill();
  const hasFilters = filters.search !== "" || filters.priority !== "all";
  const total = issues?.length ?? 0;
  const isEmpty = issues !== undefined && total === 0;
  const selectedIssue = issues?.find((i) => i.id === selectedId) ?? null;

  const commands: Command[] = [
    { id: "clear", label: "Clear filters", run: handleClear },
    {
      id: "conflicts",
      label: "Open conflicts",
      run: () => setConflictsOpen(true),
    },
    { id: "sync", label: "Sync now", run: triggerSync },
    { id: "samples", label: "Load sample issues", run: handleLoadSamples },
    ...IssuePriority.options.map((p) => ({
      id: `priority-${p}`,
      label: `Filter priority: ${p}`,
      run: () => handlePriorityChange(p),
    })),
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.svg" alt="" width={28} height={28} />
          <h1>Tracker</h1>
        </div>

        <div className="add-form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add an issue and press Enter"
            aria-label="New issue title"
          />
          <button className="primary" onClick={handleAdd}>
            Add
          </button>
        </div>

        <div className="topbar-right">
          {openConflicts > 0 && (
            <button
              className="conflict-badge"
              onClick={() => setConflictsOpen(true)}
            >
              {openConflicts} conflict{openConflicts > 1 ? "s" : ""}
            </button>
          )}

          <button
            className={`sync-pill ${syncPill.tone}`}
            onClick={triggerSync}
            disabled={syncStatus.phase === "syncing"}
            title={`${syncPill.detail} (click to sync now)`}
            aria-live="polite"
            aria-label={`${syncPill.detail}. Click to sync now.`}
          >
            <span className="sync-dot" aria-hidden="true" />
            {syncPill.text}
          </button>

          <button
            className="cmdk-btn"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
          >
            Commands <kbd>{SHORTCUT}</kbd>
          </button>
        </div>
      </header>

      <div className="toolbar">
        <FilterBar
          searchText={searchText}
          priority={filters.priority}
          onSearchChange={handleSearchChange}
          onPriorityChange={handlePriorityChange}
          onClear={handleClear}
        />
        <span className="toolbar-count" aria-live="polite">
          {hasFilters
            ? `${visibleIssues.length} of ${total} issues`
            : `${total} issue${total === 1 ? "" : "s"}`}
          {hasFilters && visibleIssues.length === 0 && " · nothing matches"}
        </span>
      </div>

      <div className="board-area" style={{ opacity: isPending ? 0.6 : 1 }}>
        {isEmpty ? (
          <div className="empty-state">
            <h2>Your board is empty</h2>
            <p>
              Add an issue above, or load a set of sample frontend tasks to try
              drag and drop, filters, the command palette and sync.
            </p>
            <div className="empty-actions">
              <button
                className="primary"
                onClick={handleLoadSamples}
                disabled={loadingSamples}
              >
                {loadingSamples ? "Loading..." : "Load sample issues"}
              </button>
            </div>
          </div>
        ) : (
          <Board issues={visibleIssues} onOpenIssue={setSelectedId} />
        )}
      </div>

      <footer className="app-footer">
        <div className="footer-hints">
          <span>
            <kbd>Tab</kbd> focus a card
          </span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>←</kbd>
            <kbd>→</kbd> move
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>[</kbd>
            <kbd>]</kbd> change status
          </span>
          <span>
            <kbd>Space</kbd> drag
          </span>
        </div>
        {import.meta.env.DEV && (
          <div className="dev-bar">
            <span className="dev-badge">DEV</span>
            <button onClick={() => seedIssues(PROJECT_ID)}>Seed 10,000</button>
            <button className="danger-btn" onClick={() => clearIssues()}>
              Clear local Data
            </button>
          </div>
        )}
      </footer>

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
