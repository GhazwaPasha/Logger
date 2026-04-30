# Second memory (Obsidian vault)

Open this **`second-memory`** directory as your Obsidian vault: **File → Open folder as vault**.

This folder is the repo’s **basic info layer**: decisions, conventions, infra, domain rules, and **what we changed** in substantive tasks—so new work in this workspace (and new Cursor sessions) can start from written context, not only chat history.

## Layout

| Path | Purpose |
|------|---------|
| `Inbox/Chat-inbox.md` | Default log: agents document substantive work here before finishing a task (rule **second-memory**) |
| `Topics/` | Longer-lived notes (by theme); link from the inbox |
| `Inbox/_session-log.txt` | One line per completed Agent run from Cursor `stop` hook (audit only; gitignored) |

## Cursor

Rule **second-memory** (always on) instructs agents to **document by default** in `Inbox/Chat-inbox.md` and to use this vault as orientation when starting related work. The `stop` hook appends a timestamp line to `_session-log.txt` (not a transcript).

## Relation to `Logger-obsidian-vault/`

That folder was an earlier Obsidian vault at the repo root (default Welcome note only). It has been **removed** so there is a **single** vault: **`second-memory/`**. Your Obsidian app settings were copied into **`second-memory/.obsidian`**. In Obsidian, open **`second-memory`** as the vault—not a duplicate folder.
