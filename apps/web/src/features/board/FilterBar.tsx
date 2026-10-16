import { IssuePriority } from "@tracker/schema";
import type { Filters } from "./filterIssues";

type Props = {
  searchText: string;
  priority: Filters["priority"];
  onSearchChange: (value: string) => void;
  onPriorityChange: (value: Filters["priority"]) => void;
  onClear: () => void;
};

export function FilterBar({
  searchText,
  priority,
  onSearchChange,
  onPriorityChange,
  onClear,
}: Props) {
  const hasFilters = searchText !== "" || priority !== "all";

  return (
    <>
      <div className="search-field">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search issues..."
          aria-label="Search issues"
        />
      </div>

      <select
        value={priority}
        onChange={(e) =>
          onPriorityChange(e.target.value as Filters["priority"])
        }
        aria-label="Filter by priority"
      >
        <option value="all">All priorities</option>
        {IssuePriority.options.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      {hasFilters && <button onClick={onClear}>Clear filters</button>}
    </>
  );
}
