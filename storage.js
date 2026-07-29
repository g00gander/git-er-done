(function () {
  "use strict";

  window.TM = window.TM || {};

  const STORAGE_KEY = "taskManager.data";
  const SCHEMA_VERSION = 1;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function emptyData() {
    return { schemaVersion: SCHEMA_VERSION, tasks: [] };
  }

  function migrate(data) {
    if (!data || typeof data !== "object") return emptyData();
    if (!Array.isArray(data.tasks)) data.tasks = [];
    if (typeof data.schemaVersion !== "number") data.schemaVersion = SCHEMA_VERSION;
    data.schemaVersion = SCHEMA_VERSION;
    return data;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        const seeded = emptyData();
        save(seeded);
        return seeded;
      }
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.error("Failed to load Task Manager data", e);
      return emptyData();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save Task Manager data", e);
    }
  }

  TM.storage = { STORAGE_KEY, SCHEMA_VERSION, uid, emptyData, load, save };
})();
