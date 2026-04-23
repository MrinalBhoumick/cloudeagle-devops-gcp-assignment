/**
 * sync-service — interactive dashboard (theme, latency, JSON, keyboard)
 */
(function () {
  "use strict";

  const THEME_KEY = "sync-spring-ui-theme";
  const healthOut = document.getElementById("healthOut");
  const healthWrap = document.getElementById("healthWrap");
  const healthBadge = document.getElementById("healthBadge");
  const healthMeta = document.getElementById("healthMeta");
  const infoOut = document.getElementById("infoOut");
  const infoWrap = document.getElementById("infoWrap");
  const verFoot = document.getElementById("verFoot");
  const profileFoot = document.getElementById("profileFoot");
  const toast = document.getElementById("toast");
  const meshSlider = document.getElementById("meshSlider");
  const root = document.documentElement;
  const btnTheme = document.getElementById("btnTheme");
  const statHealthMs = document.getElementById("statHealthMs");
  const statInfoMs = document.getElementById("statInfoMs");
  const statSession = document.getElementById("statSession");

  let lastInfoJson = "";
  let lastInfoObj = null;
  const sessionStart = performance.now();
  const HEALTH_INTERVAL_MS = 15000;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toRichJsonHtml(value, indent) {
    const pad = function (n) {
      return new Array(n * 2 + 1).join(" ");
    };
    if (value === null) {
      return '<span class="j-n">null</span>';
    }
    const t = typeof value;
    if (t === "boolean") {
      return '<span class="j-b">' + (value ? "true" : "false") + "</span>";
    }
    if (t === "number") {
      return '<span class="j-num">' + String(value) + "</span>";
    }
    if (t === "string") {
      return '<span class="j-str">"' + escapeHtml(value) + '"</span>';
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "[]";
      }
      let s = "[\n";
      for (let i = 0; i < value.length; i += 1) {
        s += pad(indent + 1) + toRichJsonHtml(value[i], indent + 1);
        s += i < value.length - 1 ? ",\n" : "\n";
      }
      s += pad(indent) + "]";
      return s;
    }
    if (t === "object") {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return "{}";
      }
      let s = "{\n";
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        s += pad(indent + 1) + '<span class="j-k">"' + escapeHtml(k) + '"</span>: ';
        s += toRichJsonHtml(value[k], indent + 1);
        s += i < keys.length - 1 ? ",\n" : "\n";
      }
      s += pad(indent) + "}";
      return s;
    }
    return escapeHtml(String(value));
  }

  function setPreRich(pre, elWrap, data) {
    if (!pre) {
      return;
    }
    pre.classList.add("code-block--rich");
    pre.innerHTML = toRichJsonHtml(data, 0);
    if (elWrap) {
      elWrap.classList.remove("is-loading");
    }
  }

  function setPreText(pre, elWrap, text) {
    if (!pre) {
      return;
    }
    pre.classList.remove("code-block--rich");
    pre.textContent = text;
    if (elWrap) {
      elWrap.classList.remove("is-loading");
    }
  }

  function setMesh(v) {
    const n = (Number(v) / 100) * 0.85;
    root.style.setProperty("--mesh", String(0.15 + n));
  }

  if (meshSlider) {
    setMesh(meshSlider.value);
    meshSlider.addEventListener("input", function () {
      setMesh(this.value);
    });
  }

  function fmtClock() {
    const el = document.getElementById("clockLabel");
    if (!el) {
      return;
    }
    const t = new Date();
    el.textContent = t.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  setInterval(fmtClock, 1000);
  fmtClock();

  function setSessionTime() {
    if (!statSession) {
      return;
    }
    const sec = Math.floor((performance.now() - sessionStart) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    statSession.textContent = m > 0 ? m + "m " + s + "s" : sec + "s";
  }
  setInterval(setSessionTime, 1000);
  setSessionTime();

  function setBadge(state, text) {
    if (!healthBadge) {
      return;
    }
    healthBadge.className = "status-badge";
    if (state === "up") {
      healthBadge.classList.add("status-badge--up");
    } else if (state === "down") {
      healthBadge.classList.add("status-badge--down");
    } else {
      healthBadge.classList.add("status-badge--load");
    }
    healthBadge.textContent = text;
  }

  function showToast(msg) {
    if (!toast) {
      return;
    }
    toast.textContent = msg || "Done";
    toast.hidden = false;
    toast.setAttribute("aria-hidden", "false");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toast.hidden = true;
      toast.setAttribute("aria-hidden", "true");
    }, 2200);
  }

  async function loadHealth() {
    setBadge("load", "…");
    if (healthMeta) {
      healthMeta.textContent = "";
    }
    if (healthWrap) {
      healthWrap.classList.add("is-loading");
    }
    if (healthOut) {
      healthOut.textContent = "Loading…";
    }
    const t0 = performance.now();
    try {
      const res = await fetch("/actuator/health", { cache: "no-store" });
      const data = await res.json().catch(function () {
        return { error: "Not JSON" };
      });
      const ms = Math.round(performance.now() - t0);
      if (statHealthMs) {
        statHealthMs.textContent = ms + " ms";
      }
      if (data && data.error) {
        setPreText(healthOut, healthWrap, JSON.stringify(data, null, 2));
      } else {
        setPreRich(healthOut, healthWrap, data);
      }
      if (res.ok) {
        const st = (data && data.status) || "";
        if (String(st).toUpperCase() === "UP") {
          setBadge("up", "UP");
        } else {
          setBadge("down", st || "DOWN");
        }
        if (healthMeta) {
          healthMeta.textContent = "HTTP " + res.status;
        }
      } else {
        setBadge("down", "ERR");
        if (healthMeta) {
          healthMeta.textContent = "HTTP " + res.status;
        }
      }
    } catch (e) {
      setBadge("down", "FAIL");
      if (statHealthMs) {
        statHealthMs.textContent = "—";
      }
      setPreText(healthOut, healthWrap, String((e && e.message) || e));
      if (healthMeta) {
        healthMeta.textContent = "network";
      }
    }
  }

  async function loadInfo() {
    if (infoWrap) {
      infoWrap.classList.add("is-loading");
    }
    if (infoOut) {
      infoOut.textContent = "Loading…";
    }
    const t0 = performance.now();
    try {
      const res = await fetch("/api/v1/info", { cache: "no-store" });
      const data = await res.json();
      const ms = Math.round(performance.now() - t0);
      if (statInfoMs) {
        statInfoMs.textContent = ms + " ms";
      }
      lastInfoObj = data;
      lastInfoJson = JSON.stringify(data, null, 2);
      setPreRich(infoOut, infoWrap, data);
      if (verFoot) {
        verFoot.textContent = "v " + (data.version || "—");
      }
      if (profileFoot && data.activeProfiles) {
        profileFoot.textContent = data.activeProfiles.join ? data.activeProfiles.join(", ") : String(data.activeProfiles);
      } else if (profileFoot) {
        profileFoot.textContent = "—";
      }
    } catch (e) {
      if (statInfoMs) {
        statInfoMs.textContent = "—";
      }
      lastInfoJson = "";
      lastInfoObj = null;
      setPreText(infoOut, infoWrap, String((e && e.message) || e));
    }
  }

  function copyInfo() {
    const t = lastInfoJson || (infoOut && infoOut.textContent) || "";
    if (!t || t === "Loading…") {
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(
        function () {
          showToast("Info JSON copied");
        },
        function () {
          showToast("Copy failed");
        }
      );
    } else {
      showToast("Clipboard unavailable");
    }
  }

  function applyTheme(dark) {
    const theme = dark ? "dark" : "light";
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
    if (btnTheme) {
      btnTheme.setAttribute("aria-pressed", dark ? "true" : "false");
      btnTheme.title = dark ? "Light mode (T)" : "Dark mode (T)";
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", dark ? "#05080f" : "#f0f4ff");
    }
  }

  function toggleTheme() {
    const isDark = root.getAttribute("data-theme") !== "light";
    applyTheme(!isDark);
  }

  (function initTheme() {
    let t = "dark";
    try {
      t = localStorage.getItem(THEME_KEY) || "dark";
    } catch (e) {}
    if (t !== "light" && t !== "dark") {
      t = "dark";
    }
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      try {
        if (!localStorage.getItem(THEME_KEY)) {
          t = "light";
        }
      } catch (e) {}
    }
    applyTheme(t === "dark");
  })();

  if (btnTheme) {
    btnTheme.addEventListener("click", toggleTheme);
  }

  const btnH = document.getElementById("btnHealth");
  const btnI = document.getElementById("btnInfo");
  const btnC = document.getElementById("btnCopy");
  if (btnH) {
    btnH.addEventListener("click", loadHealth);
  }
  if (btnI) {
    btnI.addEventListener("click", loadInfo);
  }
  if (btnC) {
    btnC.addEventListener("click", copyInfo);
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.target && (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA" || ev.target.isContentEditable)) {
      return;
    }
    const k = ev.key.toLowerCase();
    if (k === "r") {
      loadHealth();
    } else if (k === "i") {
      loadInfo();
    } else if (k === "c") {
      copyInfo();
    } else if (k === "t") {
      ev.preventDefault();
      toggleTheme();
    } else if (k === "l") {
      document.dispatchEvent(new Event("app-reload-items"));
    }
  });

  document.querySelectorAll("[data-tilt]").forEach(function (card) {
    card.addEventListener("mousemove", function (ev) {
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      const rx = (y * -5).toFixed(2);
      const ry = (x * 7).toFixed(2);
      card.style.transform = "perspective(960px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateZ(0)";
    });
    card.addEventListener("mouseleave", function () {
      card.style.transform = "";
    });
  });

  document.querySelectorAll(".reveal").forEach(function (el) {
    el.classList.add("reveal--pending");
  });
  if (window.IntersectionObserver) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            e.target.classList.remove("reveal--pending");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.08 }
    );
    document.querySelectorAll(".reveal").forEach(function (el) {
      io.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  loadInfo();
  loadHealth();
  setInterval(loadHealth, HEALTH_INTERVAL_MS);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      loadHealth();
      loadInfo();
    }
  });
})();

/* —— CRUD /api/v1/items —— */
(function () {
  "use strict";

  const API = "/api/v1/items";
  const toast = document.getElementById("toast");
  const tbody = document.getElementById("itemsTbody");
  const itemCount = document.getElementById("itemCount");
  const form = document.getElementById("itemForm");
  const itemTitle = document.getElementById("itemTitle");
  const itemDesc = document.getElementById("itemDesc");
  const formError = document.getElementById("itemFormError");
  const btnReload = document.getElementById("btnItemsReload");
  const dlg = document.getElementById("editDialog");
  const editForm = document.getElementById("editDialogForm");
  const editId = document.getElementById("editItemId");
  const editTitle = document.getElementById("editTitle");
  const editDesc = document.getElementById("editDesc");
  const editCancel = document.getElementById("editCancel");

  function showToast(msg) {
    if (!toast) {
      return;
    }
    toast.textContent = msg;
    toast.hidden = false;
    toast.setAttribute("aria-hidden", "false");
    clearTimeout(showToast._ct);
    showToast._ct = setTimeout(function () {
      toast.hidden = true;
      toast.setAttribute("aria-hidden", "true");
    }, 2200);
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function fmtTime(iso) {
    if (!iso) {
      return "—";
    }
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return String(iso);
    }
  }

  function setFormError(m) {
    if (formError) {
      formError.textContent = m || "";
    }
  }

  async function loadItems() {
    if (!tbody) {
      return;
    }
    tbody.innerHTML = '<tr class="data-table__loading"><td colspan="4">Loading…</td></tr>';
    try {
      const res = await fetch(API, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data && data.error) || "Failed to list");
      }
      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr class="data-table__empty"><td colspan="4">No items yet. Add one above.</td></tr>';
        if (itemCount) {
          itemCount.textContent = "0 items";
        }
        return;
      }
      if (itemCount) {
        itemCount.textContent = data.length + (data.length === 1 ? " item" : " items");
      }
      tbody.innerHTML = data
        .map(function (it) {
          return (
            "<tr data-id=\"" +
            esc(it.id) +
            "\">" +
            "<th scope=\"row\" class=\"data-table__title\">" +
            esc(it.title) +
            "</th>" +
            "<td class=\"data-table__desc\">" +
            esc(it.description) +
            "</td>" +
            "<td class=\"data-table__time\"><time datetime=\"" +
            esc(it.updatedAt) +
            "\">" +
            esc(fmtTime(it.updatedAt)) +
            "</time></td>" +
            "<td class=\"data-table__actions\">" +
            "<button type=\"button\" class=\"btn-ghost btn-ghost--sm crud-btn-edit\" data-id=\"" +
            esc(it.id) +
            "\">Edit</button> " +
            "<button type=\"button\" class=\"btn-ghost btn-ghost--sm btn-ghost--danger crud-btn-del\" data-id=\"" +
            esc(it.id) +
            "\">Delete</button>" +
            "</td></tr>"
          );
        })
        .join("");

      tbody.querySelectorAll(".crud-btn-edit").forEach(function (b) {
        b.addEventListener("click", function () {
          const id = b.getAttribute("data-id");
          const row = b.closest("tr");
          const titleE = row && row.querySelector(".data-table__title");
          const dE = row && row.querySelector(".data-table__desc");
          openEdit(
            id,
            titleE ? titleE.textContent : "",
            dE ? dE.textContent : ""
          );
        });
      });
      tbody.querySelectorAll(".crud-btn-del").forEach(function (b) {
        b.addEventListener("click", function () {
          const id = b.getAttribute("data-id");
          if (id && window.confirm("Delete this item?")) {
            delItem(id);
          }
        });
      });
    } catch (e) {
      tbody.innerHTML = '<tr class="data-table__empty"><td colspan="4">Error: ' + esc((e && e.message) || e) + "</td></tr>";
      if (itemCount) {
        itemCount.textContent = "—";
      }
    }
  }

  function openEdit(id, title, desc) {
    if (!dlg || !editId || !editTitle || !editDesc) {
      return;
    }
    editId.value = id;
    editTitle.value = title || "";
    editDesc.value = desc || "";
    if (typeof dlg.showModal === "function") {
      dlg.showModal();
    }
    editTitle.focus();
  }

  function closeEdit() {
    if (dlg && typeof dlg.close === "function") {
      dlg.close();
    }
  }

  async function delItem(id) {
    try {
      const res = await fetch(API + "/" + encodeURIComponent(id), { method: "DELETE" });
      if (res.status === 204) {
        showToast("Item deleted");
        loadItems();
      } else {
        const err = await res.json().catch(function () {
          return {};
        });
        showToast((err && err.error) || "Delete failed");
      }
    } catch (e) {
      showToast(String((e && e.message) || e));
    }
  }

  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      setFormError("");
      const title = (itemTitle && itemTitle.value) || "";
      const desc = (itemDesc && itemDesc.value) || "";
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title, description: desc }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) {
              throw { status: res.status, body: data };
            }
            return data;
          });
        })
        .then(function () {
          showToast("Item created");
          form.reset();
          loadItems();
        })
        .catch(function (e) {
          if (e && e.body && e.body.fields) {
            setFormError(JSON.stringify(e.body.fields));
          } else {
            setFormError((e && e.body && e.body.error) || (e && e.message) || "Create failed");
          }
        });
    });
  }

  if (editForm) {
    editForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      const id = editId && editId.value;
      if (!id) {
        return;
      }
      const title = (editTitle && editTitle.value) || "";
      const desc = (editDesc && editDesc.value) || "";
      fetch(API + "/" + encodeURIComponent(id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title, description: desc }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) {
              throw { body: data };
            }
            return data;
          });
        })
        .then(function () {
          showToast("Item updated");
          closeEdit();
          loadItems();
        })
        .catch(function (e) {
          showToast((e && e.body && e.body.error) || "Update failed");
        });
    });
  }
  if (editCancel) {
    editCancel.addEventListener("click", closeEdit);
  }

  if (btnReload) {
    btnReload.addEventListener("click", loadItems);
  }
  document.addEventListener("app-reload-items", loadItems);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && tbody) {
      loadItems();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadItems);
  } else {
    loadItems();
  }
})();

