# Git 'er Done!

A lightweight, single-page task manager. No build step, no backend, no account —
just open the page and start tracking work by project, priority, assignee, and due date.

## Features

- Track tasks with project, assignee, status, priority, category, due date, and notes
- Filter by status, priority, category, blocked state, or free-text search
- Sortable columns and a stats strip/graphs summarizing your task list
- Multiple color themes (Auto, Midnight, Aurora, Ember, Forest, Solstice, Paper, Mono)
- Adjustable font size
- Data is saved locally in your browser — nothing leaves your machine

## Getting started

1. Download or clone this repo.
2. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).

That's it — no install, no server, no dependencies.

## Data & storage

All task data is stored in your browser's `localStorage`, scoped to wherever you're
serving `index.html` from. There is no server component and no data included in this
repo — you start with an empty task list.

Because it's `localStorage`:

- Your data stays on your machine and is tied to that specific browser.
- Clearing your browser's site data/cache will erase your tasks.
- Opening the file from a different browser, machine, or file path starts fresh.

## Project structure

```
index.html   Page markup and controls
app.js       App logic: task fields, filters, rendering, stats
helpers.js   Shared UI/table helper functions
storage.js   localStorage load/save
style.css    Themes and layout
assets/      Images (mascot, etc.)
```
