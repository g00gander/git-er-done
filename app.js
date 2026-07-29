(function () {
  "use strict";

  window.TM = window.TM || {};

  let data = TM.storage.load();

  const els = {
    themeSelect: document.getElementById("themeSelect"),
    fontSizeSelect: document.getElementById("fontSizeSelect"),
    addTaskBtn: document.getElementById("addTaskBtn"),
    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
    priorityFilter: document.getElementById("priorityFilter"),
    categoryFilter: document.getElementById("categoryFilter"),
    blockedFilter: document.getElementById("blockedFilter"),
    hideCompletedToggle: document.getElementById("hideCompletedToggle"),
    clearFiltersBtn: document.getElementById("clearFiltersBtn"),
    statStrip: document.getElementById("statStrip"),
    statGraphs: document.getElementById("statGraphs"),
    taskTable: document.getElementById("taskTable"),
  };

  const THEME_KEY = "taskManager.theme";
  const FONT_SIZE_KEY = "taskManager.fontSize";

  function resolveTheme(theme) {
    if (theme !== "auto") return theme;
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "mono" : "paper";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", resolveTheme(theme));
  }

  els.themeSelect.addEventListener("change", () => {
    try {
      localStorage.setItem(THEME_KEY, els.themeSelect.value);
    } catch (e) {}
    applyTheme(els.themeSelect.value);
  });

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (els.themeSelect.value === "auto") applyTheme("auto");
    });
  }

  els.fontSizeSelect.addEventListener("change", () => {
    try {
      localStorage.setItem(FONT_SIZE_KEY, els.fontSizeSelect.value);
    } catch (e) {}
    document.documentElement.setAttribute("data-fontsize", els.fontSizeSelect.value);
  });

  const savedTheme = (function () {
    try {
      return localStorage.getItem(THEME_KEY) || "auto";
    } catch (e) {
      return "auto";
    }
  })();
  els.themeSelect.value = savedTheme;

  const savedFontSize = (function () {
    try {
      return localStorage.getItem(FONT_SIZE_KEY) || "normal";
    } catch (e) {
      return "normal";
    }
  })();
  els.fontSizeSelect.value = savedFontSize;
  document.documentElement.setAttribute("data-fontsize", savedFontSize);

  function save() {
    TM.storage.save(data);
  }

  // ---------------- Columns ----------------

  const STATUS_OPTIONS = [
    { value: "not_started", label: "Not Started" },
    { value: "in_progress", label: "In Progress" },
    { value: "under_review", label: "Under Review" },
    { value: "complete", label: "Complete" },
    { value: "overdue", label: "Overdue" },
    { value: "blocked", label: "Blocked" },
    { value: "recurring", label: "Recurring" },
    { value: "cancelled", label: "Cancelled" },
  ];
  const PRIORITY_OPTIONS = [
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];
  const CATEGORY_OPTIONS = [
    { value: "", label: "— Select —" },
    { value: "Salesforce", label: "Salesforce" },
    { value: "Program", label: "Program" },
    { value: "Compliance", label: "Compliance" },
    { value: "Engagement", label: "Engagement" },
    { value: "Administrative", label: "Administrative" },
    { value: "Training", label: "Training" },
    { value: "Adult Apprenticeship", label: "Adult Apprenticeship" },
    { value: "Youth Apprenticeship", label: "Youth Apprenticeship" },
    { value: "Other", label: "Other" },
  ];
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  const STATUS_RANK = Object.fromEntries(STATUS_OPTIONS.map((o, i) => [o.value, i]));

  function knownValues(key) {
    return Array.from(new Set(data.tasks.map((t) => t[key]).filter(Boolean))).sort();
  }

  function isOverdue(row) {
    return row.status !== "complete" && row.dueDate && row.dueDate < TM.helpers.todayIso();
  }

  const COLUMNS = [
    { key: "id", label: "Task ID", type: "computed", compute: (row) => row.id, format: (v, row) => (isOverdue(row) ? `⚠ ${v}` : v) },
    { key: "project", label: "Project", type: "text", placeholder: "e.g. Acme Corp/Onboarding" },
    { key: "task", label: "Task", type: "textarea", required: true, placeholder: "What needs to happen?" },
    { key: "assignedTo", label: "Assigned To", type: "text", datalist: () => knownValues("assignedTo") },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { key: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS },
    { key: "dateCreated", label: "Date Created", type: "date" },
    { key: "dueDate", label: "Due Date", type: "date" },
    { key: "dateCompleted", label: "Date Completed", type: "date" },
    { key: "category", label: "Category", type: "select", options: CATEGORY_OPTIONS },
    { key: "notes", label: "Notes / Next Action", type: "textarea" },
    { key: "blocked", label: "Blocked?", type: "checkbox" },
  ];

  function newTask() {
    const nums = data.tasks.map((t) => parseInt(String(t.id).replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return {
      id: `T-${String(next).padStart(3, "0")}`,
      project: "",
      task: "",
      assignedTo: "",
      status: "not_started",
      priority: "medium",
      dateCreated: TM.helpers.todayIso(),
      dueDate: "",
      dateCompleted: "",
      category: "",
      notes: "",
      blocked: false,
    };
  }

  // ---------------- Filters / sort state ----------------

  const filters = { search: "", status: "all", priority: "all", category: "all", blocked: "all", hideCompleted: false };
  let sortBy = "dueDate";
  let sortDir = "asc";

  function populateCategoryFilter() {
    const current = els.categoryFilter.value;
    const cats = knownValues("category");
    els.categoryFilter.innerHTML =
      `<option value="all">All Categories</option>` + cats.map((c) => `<option value="${TM.helpers.escapeHtml(c)}">${TM.helpers.escapeHtml(c)}</option>`).join("");
    if (cats.includes(current)) els.categoryFilter.value = current;
  }

  function visibleTasks() {
    const q = filters.search.trim().toLowerCase();
    let rows = data.tasks.filter((t) => {
      if (filters.status !== "all" && t.status !== filters.status) return false;
      if (filters.priority !== "all" && t.priority !== filters.priority) return false;
      if (filters.category !== "all" && (t.category || "") !== filters.category) return false;
      if (filters.blocked !== "all" && String(!!t.blocked) !== filters.blocked) return false;
      if (filters.hideCompleted && t.status === "complete") return false;
      if (q) {
        const hay = [t.project, t.task, t.assignedTo, t.notes, t.id].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      let av, bv;
      if (sortBy === "priority") {
        av = PRIORITY_RANK[a.priority] ?? 99;
        bv = PRIORITY_RANK[b.priority] ?? 99;
      } else if (sortBy === "status") {
        av = STATUS_RANK[a.status] ?? 99;
        bv = STATUS_RANK[b.status] ?? 99;
      } else if (sortBy === "blocked") {
        av = a.blocked ? 1 : 0;
        bv = b.blocked ? 1 : 0;
      } else {
        av = a[sortBy] || "";
        bv = b[sortBy] || "";
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }

  // ---------------- Render ----------------

  function renderStats() {
    const tasks = data.tasks;
    const count = (pred) => tasks.filter(pred).length;
    const stats = [
      { label: "Total Tasks", value: tasks.length, cls: "" },
      { label: "Not Started", value: count((t) => t.status === "not_started"), cls: "" },
      { label: "In Progress", value: count((t) => t.status === "in_progress"), cls: "" },
      { label: "Complete", value: count((t) => t.status === "complete"), cls: "" },
      { label: "Blocked", value: count((t) => t.blocked), cls: "stat-blocked" },
      { label: "Overdue", value: count(isOverdue), cls: "stat-overdue" },
    ];
    els.statStrip.innerHTML = stats
      .map(
        (s) => `
      <div class="stat-tile ${s.cls}">
        <div class="stat-tile-value">${s.value}</div>
        <div class="stat-tile-label">${TM.helpers.escapeHtml(s.label)}</div>
      </div>`
      )
      .join("");
  }

  function barGraphPanel(title, rows, total) {
    const h = TM.helpers;
    const body = rows.length
      ? rows
          .map((r) => {
            const pct = total ? Math.round((r.value / total) * 100) : 0;
            const fillCls = r.value > 0 ? `bar-fill ${r.cls}` : "bar-fill bar-fill-zero";
            return `
        <div class="bar-row">
          <div class="bar-label">${h.escapeHtml(r.label)}</div>
          <div class="bar-track"><div class="${fillCls}" style="width:${pct}%"></div></div>
          <div class="bar-count">${r.value}</div>
        </div>`;
          })
          .join("")
      : `<p class="empty-text">No data yet.</p>`;
    return `<div class="stat-graph-panel"><h3>${h.escapeHtml(title)}</h3>${body}</div>`;
  }

  function renderStatGraphs() {
    const tasks = data.tasks;
    const total = tasks.length;

    const statusRows = STATUS_OPTIONS.map((o) => ({
      label: o.label,
      value:
        o.value === "blocked"
          ? tasks.filter((t) => t.blocked && t.status !== "complete").length
          : o.value === "overdue"
          ? tasks.filter(isOverdue).length
          : tasks.filter((t) => t.status === o.value).length,
      cls: `bar-status-${o.value}`,
    }));

    const priorityRows = PRIORITY_OPTIONS.map((o) => ({
      label: o.label,
      value: tasks.filter((t) => t.priority === o.value).length,
      cls: `bar-priority-${o.value}`,
    }));

    const categoryCounts = {};
    tasks.forEach((t) => {
      const key = t.category || "Uncategorized";
      categoryCounts[key] = (categoryCounts[key] || 0) + 1;
    });
    const categoryRows = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, cls: "bar-category" }));

    els.statGraphs.innerHTML = [
      barGraphPanel("By Status", statusRows, total),
      barGraphPanel("By Priority", priorityRows, total),
      barGraphPanel("By Category", categoryRows, total),
    ].join("");
  }

  function renderTable() {
    const rows = visibleTasks();
    TM.helpers.renderEditableTable(els.taskTable, {
      columns: COLUMNS,
      rows,
      context: data,
      emptyText: data.tasks.length ? "No tasks match the current filters." : "No tasks yet — add your first one above.",
      addLabel: "+ Add Task",
      showAddButton: false,
      sortBy,
      sortDir,
      onSort: (key) => {
        if (sortBy === key) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortBy = key;
          sortDir = "asc";
        }
        renderTable();
      },
      rowClassName: (row) => (row.status === "complete" ? "row-complete" : ""),
      onAdd: () => {
        data.tasks.push(newTask());
        save();
        renderAll();
      },
      onChange: (rowId, key, val) => {
        const row = data.tasks.find((r) => r.id === rowId);
        if (row) {
          row[key] = val;
          if (key === "dateCompleted" && val) row.status = "complete";
          if (row.status === "complete" && row.blocked) row.blocked = false;
        }
        save();
        renderAll();
      },
      onDelete: (rowId) => {
        data.tasks = data.tasks.filter((r) => r.id !== rowId);
        save();
        renderAll();
      },
    });

    els.taskTable.querySelectorAll('select[data-key="status"]').forEach((sel) => {
      sel.classList.add(`status-color-${sel.value}`);
    });

    rows.forEach((row) => {
      if (!isOverdue(row)) return;
      const dueInput = els.taskTable.querySelector(`input[data-row-id="${CSS.escape(row.id)}"][data-key="dueDate"]`);
      if (dueInput) dueInput.classList.add("input-overdue");
    });
  }

  function renderAll() {
    populateCategoryFilter();
    renderStats();
    renderStatGraphs();
    renderTable();
  }

  // ---------------- Toolbar wiring ----------------

  els.addTaskBtn.addEventListener("click", () => {
    data.tasks.push(newTask());
    save();
    renderAll();
    const mascot = document.getElementById("mascotImage");
    if (mascot) {
      mascot.classList.remove("shake");
      void mascot.offsetWidth;
      mascot.classList.add("shake");
    }
  });

  els.searchInput.addEventListener("input", () => {
    filters.search = els.searchInput.value;
    renderTable();
  });
  els.statusFilter.addEventListener("change", () => {
    filters.status = els.statusFilter.value;
    renderTable();
  });
  els.priorityFilter.addEventListener("change", () => {
    filters.priority = els.priorityFilter.value;
    renderTable();
  });
  els.categoryFilter.addEventListener("change", () => {
    filters.category = els.categoryFilter.value;
    renderTable();
  });
  els.blockedFilter.addEventListener("change", () => {
    filters.blocked = els.blockedFilter.value;
    renderTable();
  });
  els.hideCompletedToggle.addEventListener("change", () => {
    filters.hideCompleted = els.hideCompletedToggle.checked;
    renderTable();
  });
  els.clearFiltersBtn.addEventListener("click", () => {
    filters.search = "";
    filters.status = "all";
    filters.priority = "all";
    filters.category = "all";
    filters.blocked = "all";
    filters.hideCompleted = false;
    els.searchInput.value = "";
    els.statusFilter.value = "all";
    els.priorityFilter.value = "all";
    els.categoryFilter.value = "all";
    els.blockedFilter.value = "all";
    els.hideCompletedToggle.checked = false;
    renderTable();
  });

  renderAll();
})();
