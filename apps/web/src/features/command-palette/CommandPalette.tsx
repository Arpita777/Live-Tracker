import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { Issue } from "@tracker/schema";
import "./palette.css";

export type Command = { id: string; label: string; run: () => void };

type Props = {
  issues: Issue[];
  commands: Command[];
  onCreate: (title: string) => void;
  onOpenIssue: (id: string) => void;
  onClose: () => void;
};

export function CommandPalette({
  issues,
  commands,
  onCreate,
  onOpenIssue,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Build the list of choices for what has been typed so far
  const items = useMemo(() => {
    const text = query.trim();
    const q = text.toLowerCase();
    const result: Command[] = [];

    if (q) {
      result.push({
        id: "create",
        label: `Create issue: "${text}"`,
        run: () => onCreate(text),
      });
    }

    for (const c of commands) {
      if (!q || c.label.toLowerCase().includes(q)) result.push(c);
    }

    if (q) {
      let found = 0;
      for (const issue of issues) {
        if (issue.title.toLowerCase().includes(q)) {
          result.push({
            id: issue.id,
            label: `Open: ${issue.title}`,
            run: () => onOpenIssue(issue.id),
          });
          if (++found === 8) break; // show at most 8 matches
        }
      }
    }
    return result;
  }, [query, commands, issues, onCreate, onOpenIssue]);

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  // Keep the highlighted row visible when arrowing through a long list
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function runItem(item: Command | undefined) {
    if (!item) return;
    item.run();
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((activeIndex + 1) % Math.max(items.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((activeIndex - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runItem(items[activeIndex]);
    } else if (e.key === "Escape") {
      e.stopPropagation(); // don't also close the detail panel behind us
      onClose();
    }
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder="Type a command or search issues..."
          aria-label="Command search"
        />

        <ul ref={listRef} role="listbox">
          {items.length === 0 && <li className="palette-empty">No results</li>}
          {items.map((item, index) => (
            <li
              key={item.id}
              data-index={index}
              role="option"
              aria-selected={index === activeIndex}
              className={
                index === activeIndex ? "palette-item active" : "palette-item"
              }
              onMouseEnter={() => setActive(index)}
              onClick={() => runItem(item)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
