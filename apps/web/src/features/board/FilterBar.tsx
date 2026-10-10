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
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <input
        type="search"
        value={searchText}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search titles..."
        aria-label="Search issues"
      />
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
      <button onClick={onClear}>Clear</button>
    </div>
  );
}
