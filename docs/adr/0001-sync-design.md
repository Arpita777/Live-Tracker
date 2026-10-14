# ADR 0001: Local-first sync design

Status: Accepted

## Context

Tracker must feel instant and keep working offline. Several devices can edit
the same issue while disconnected, and they must all end up with the same data
once they reconnect. The server is small and has no accounts yet.

## Decision

1. **The local database is the source of truth for the UI.** Screens read from
   IndexedDB (Dexie live queries) and never wait for the network.
2. **Every write goes through one repository function**, inside a transaction
   that saves the change locally and appends a mutation to an outbox.
3. **Each mutation has a client-generated UUID.** The server stores it under a
   UNIQUE constraint, so a retried send cannot be applied twice.
4. **Ordering uses a hybrid logical clock (HLC)**, not Date.now(). It never goes
   backwards, catches up to timestamps it receives, and includes a node id so
   timestamps are unique. It is formatted so string comparison equals time order.
5. **Conflicts are resolved per field, last write wins.** Each field stores the
   HLC of its last write, and an incoming change applies only if it is newer.
   Edits to different fields from different devices both survive.
6. **The merge is a pure function shared by client and server.** It is
   commutative and idempotent, so notes can arrive in any order, or twice.
7. **Pull uses a server-assigned arrival sequence as the cursor**, not a
   timestamp. A device that was offline can push a note with an old HLC, and a
   timestamp cursor would make other devices skip it.
8. **Deletes are soft.** A delete is a change to `deletedAt`, kept as a tombstone,
   so devices that were offline still learn about it.
9. **Sync is push then pull.** The outbox is emptied only for notes the server
   acknowledged. Received notes and the new cursor are saved in one transaction.

## Alternatives considered

- **Whole-row last write wins:** simpler, but one device's edit erases another's.
- **CRDTs (for example Yjs) for everything:** merge text properly, but heavy for
  a data model that is mostly small fields. Kept as the upgrade path for long
  descriptions.
- **Timestamp cursor for pull:** misses late-arriving notes.
- **Redux as the data store:** duplicates the data already in IndexedDB.

## Consequences

- The UI is fast and works offline.
- Two edits to the same field lose one of them, silently. Mitigation: a conflict
  log and a demo screen (milestone 6).
- Tombstones and the mutation log grow forever. A production system needs
  compaction and snapshots for new devices.
- A client's cursor is only valid for the server database it came from.
- There is no authentication yet. Anyone can push.
