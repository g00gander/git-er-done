(function () {
  "use strict";

  window.TM = window.TM || {};

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function todayIso() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function confirmDialog(message) {
    return window.confirm(message);
  }

  // ---------------------------------------------------------------------
  // Remember a manually-resized <textarea>'s height across re-renders, by
  // a caller-supplied stable key (e.g. a row id + column key).
  // ---------------------------------------------------------------------
  const TEXTAREA_SIZE_PREFIX = "taskManager.textareaHeight.";

  function persistTextareaSize(el, key) {
    if (!el || !key) return;
    try {
      const saved = localStorage.getItem(TEXTAREA_SIZE_PREFIX + key);
      if (saved) el.style.height = saved + "px";
    } catch (e) {}
    if (typeof ResizeObserver === "undefined") return;
    let lastHeight = el.offsetHeight;
    const observer = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (!h || h === lastHeight) return;
      lastHeight = h;
      try {
        localStorage.setItem(TEXTAREA_SIZE_PREFIX + key, String(h));
      } catch (e) {}
    });
    observer.observe(el);
  }

  function renderCellHtml(row, col, allRows, context) {
    const value = row[col.key];
    if (col.type === "computed") {
      const raw = col.compute ? col.compute(row, allRows, context) : "";
      const display = col.format ? col.format(raw, row) : raw;
      const inner = display == null ? "" : String(display);
      return `<span class="computed-cell" data-key="${escapeHtml(col.key)}">${col.html ? inner : escapeHtml(inner)}</span>`;
    }
    const common = `data-row-id="${escapeHtml(row.id)}" data-key="${escapeHtml(col.key)}"`;
    const placeholder = col.placeholder ? ` placeholder="${escapeHtml(col.placeholder)}"` : "";
    const required = col.required ? " required" : "";
    switch (col.type) {
      case "textarea":
        return `<textarea ${common}${placeholder}${required} rows="2">${escapeHtml(value)}</textarea>`;
      case "date":
        return `<input type="date" ${common} value="${escapeHtml(value || "")}">`;
      case "checkbox":
        return `<input type="checkbox" ${common} ${value ? "checked" : ""}>`;
      case "select": {
        const opts = typeof col.options === "function" ? col.options(row, allRows, context) : col.options || [];
        const optionsHtml = opts.map((o) => `<option value="${escapeHtml(o.value)}" ${o.value === value ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("");
        return `<select ${common}>${optionsHtml}</select>`;
      }
      default: {
        if (!col.datalist) return `<input type="text" ${common} value="${escapeHtml(value || "")}"${required}${placeholder}>`;
        const listId = `dl-${col.key}-${row.id}`;
        const options = typeof col.datalist === "function" ? col.datalist(row, allRows, context) : col.datalist || [];
        const datalistHtml = `<datalist id="${listId}">${options.map((o) => `<option value="${escapeHtml(o)}">`).join("")}</datalist>`;
        return `<input type="text" list="${listId}" ${common} value="${escapeHtml(value || "")}"${required}${placeholder}>${datalistHtml}`;
      }
    }
  }

  // config: { columns, rows, context, emptyText, addLabel, showAddButton, sortBy, sortDir, onSort(key), rowClassName(row), onAdd, onChange(rowId,key,val), onDelete(rowId) }
  function renderEditableTable(container, config) {
    const { columns, rows, context, emptyText, addLabel, rowClassName, showAddButton = true, sortBy, sortDir, onSort } = config;
    const addButtonHtml = showAddButton ? `<button type="button" class="btn-ghost" data-action="add-row">${escapeHtml(addLabel || "+ Add row")}</button>` : "";

    // Every edit re-renders this table from scratch, which would otherwise
    // destroy the input that just received focus (e.g. via Tab) and drop
    // focus entirely. Capture it here and restore it after rebuilding.
    const activeEl = document.activeElement;
    let restoreFocus = null;
    if (activeEl && container.contains(activeEl) && activeEl.dataset && activeEl.dataset.rowId && activeEl.dataset.key) {
      restoreFocus = {
        rowId: activeEl.dataset.rowId,
        key: activeEl.dataset.key,
        selStart: typeof activeEl.selectionStart === "number" ? activeEl.selectionStart : null,
        selEnd: typeof activeEl.selectionEnd === "number" ? activeEl.selectionEnd : null,
      };
    }

    if (!rows.length) {
      container.innerHTML = `
        <p class="empty-text">${escapeHtml(emptyText || "Nothing here yet.")}</p>
        ${addButtonHtml}
      `;
    } else {
      const thead = `<tr>${columns
        .map((c) => {
          if (!onSort) return `<th>${escapeHtml(c.label)}</th>`;
          const isSorted = c.key === sortBy;
          const arrow = isSorted ? `<span class="sort-arrow">${sortDir === "desc" ? "▼" : "▲"}</span>` : "";
          return `<th class="th-sortable${isSorted ? " th-sorted" : ""}" data-sort-key="${escapeHtml(c.key)}">${escapeHtml(c.label)}${arrow}</th>`;
        })
        .join("")}<th class="col-actions"></th></tr>`;
      const tbody = rows
        .map((row) => {
          const cls = rowClassName ? rowClassName(row) : "";
          return `
        <tr data-row="${escapeHtml(row.id)}"${cls ? ` class="${escapeHtml(cls)}"` : ""}>
          ${columns.map((c) => `<td class="col-${escapeHtml(c.type || "text")}">${renderCellHtml(row, c, rows, context)}</td>`).join("")}
          <td class="col-actions"><button type="button" class="btn-icon btn-delete" data-delete-row="${escapeHtml(row.id)}" title="Delete row">✕</button></td>
        </tr>`;
        })
        .join("");
      container.innerHTML = `
        <div class="editable-table-wrap">
          <table class="editable-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
        ${addButtonHtml}
      `;
      container.querySelectorAll("textarea[data-row-id]").forEach((ta) => {
        persistTextareaSize(ta, `${ta.dataset.rowId}:${ta.dataset.key}`);
      });
    }

    if (restoreFocus) {
      const el = container.querySelector(`[data-row-id="${CSS.escape(restoreFocus.rowId)}"][data-key="${CSS.escape(restoreFocus.key)}"]`);
      if (el) {
        el.focus();
        if (restoreFocus.selStart != null && typeof el.setSelectionRange === "function") {
          try {
            el.setSelectionRange(restoreFocus.selStart, restoreFocus.selEnd);
          } catch (e) {}
        }
      }
    }

    container.onclick = (e) => {
      const delBtn = e.target.closest("[data-delete-row]");
      if (delBtn) {
        e.stopPropagation();
        if (confirmDialog("Delete this task? This cannot be undone.")) config.onDelete(delBtn.dataset.deleteRow);
        return;
      }
      const addBtn = e.target.closest('[data-action="add-row"]');
      if (addBtn) {
        e.stopPropagation();
        config.onAdd();
        return;
      }
      const sortTh = e.target.closest("[data-sort-key]");
      if (sortTh && config.onSort) {
        e.stopPropagation();
        config.onSort(sortTh.dataset.sortKey);
      }
    };

    container.onchange = (e) => {
      const target = e.target;
      const rowId = target.dataset.rowId;
      const key = target.dataset.key;
      if (!rowId || !key) return;
      e.stopPropagation();
      let value;
      if (target.type === "checkbox") value = target.checked;
      else value = target.value;
      config.onChange(rowId, key, value);
    };
  }

  TM.helpers = { escapeHtml, formatDate, todayIso, confirmDialog, persistTextareaSize, renderEditableTable };
})();
