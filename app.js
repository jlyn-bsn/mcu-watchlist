(() => {
  const KEY = "mcu-watchlist-v1";
  const defaults = { watched: [], archived: [], order: [], sort: "release" };
  let state = load();
  if (state.sort !== "mine") state.sort = "release";
  let typeFilter = "all";
  let query = "";
  let firstRender = true;

  const $ = (id) => document.getElementById(id);
  const listEl = $("list"), archEl = $("archiveList");

  function load() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch { return { ...defaults }; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }

  const byId = new Map(ITEMS.map((i) => [i.id, i]));
  const has = (arr, id) => arr.includes(id);
  const isWatched = (id) => has(state.watched, id);

  const TIER_LABEL = { ess: "Essential to the MCU", rec: "Recommended for the MCU", opt: "Optional to the MCU" };
  const TILE = { movie: "Film", tv: "TV", special: "Special", milestone: "Film" };


  // custom order: stored ids still valid, then any new items in release order
  function fullOrder() {
    const seen = new Set();
    const out = [];
    for (const id of state.order) if (byId.has(id) && !seen.has(id)) { seen.add(id); out.push(id); }
    for (const it of ITEMS) if (!seen.has(it.id)) out.push(it.id);
    return out;
  }
  function sortedIds() {
    if (state.sort === "mine") return fullOrder();
    return ITEMS.map((i) => i.id);
  }
  function groupOf(it) {
    if (state.sort === "mine") return "My order";
    return "Release order";
  }

  function matches(it) {
    if (typeFilter === "film" && it.kind !== "film") return false;
    if (typeFilter === "tv" && it.kind !== "tv") return false;
    if (typeFilter === "unwatched" && isWatched(it.id)) return false;
    if (query && !it.title.toLowerCase().includes(query)) return false;
    return true;
  }

  function fmtDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function actBtn(label, cls, fn) {
    const b = el("button", "act-btn " + cls);
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", fn);
    return b;
  }

  function row(it, archived) {
    const li = el("li", `item ${it.cat}` + (isWatched(it.id) ? " watched" : ""));
    li.dataset.id = it.id;

    const grip = el(archived ? "span" : "button", "grip", "⋮⋮");
    if (!archived) {
      grip.type = "button";
      grip.title = "Drag to reorder, or focus and use the arrow keys";
      grip.setAttribute("aria-label", "Reorder " + it.title + ". Use the up and down arrow keys.");
      grip.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        nudge(it.id, e.key === "ArrowUp" ? -1 : 1);
      });
      li.draggable = true;
    } else { grip.setAttribute("aria-hidden", "true"); grip.style.visibility = "hidden"; }

    const tile = el("span", "tile", TILE[it.cat]);

    const main = el("div", "main");
    const tr = el("div", "title-row");
    tr.append(el("span", "title", it.title), el("span", "chip " + it.tier, TIER_LABEL[it.tier]));
    if (it.studio) tr.append(el("span", "chip studio", it.studio));
    main.append(tr, el("p", "meta", fmtDate(it.date)));

    const act = el("div", "actions");
    if (!archived) {
      const w = actBtn("Watched", "watch", () => toggleWatched(it.id, li));
      w.setAttribute("aria-pressed", String(isWatched(it.id)));
      act.append(w, actBtn("Archive", "do-archive", () => setArchived(it.id, true, li)));
    } else {
      const r = el("button", "pill-btn", "Restore");
      r.type = "button";
      r.addEventListener("click", () => setArchived(it.id, false));
      act.append(r);
    }

    li.append(grip, tile, main, act);
    if (!archived) wireDrag(li, it.id);
    return li;
  }

  function render() {
    $("sort").value = state.sort;
    $("resetOrder").hidden = state.sort !== "mine";

    const active = sortedIds().map((id) => byId.get(id)).filter((it) => !has(state.archived, it.id));
    const shown = active.filter(matches);

    const frag = document.createDocumentFragment();
    let rows = null, label = null;
    const sections = [];
    shown.forEach((it, i) => {
      const g = groupOf(it);
      if (g !== label) {
        label = g;
        const section = el("section", "section");
        const head = el("div", "section-head");
        const count = el("span", "count");
        head.append(el("h2", null, g), count);
        rows = el("ol", "rows");
        section.append(head, rows);
        frag.append(section);
        sections.push({ count, ids: [] });
      }
      rows.append(row(it, false));
      sections[sections.length - 1].ids.push(it.id);
    });
    sections.forEach((s) => {
      s.count.textContent = `${s.ids.filter(isWatched).length} / ${s.ids.length} titles`;
    });
    listEl.replaceChildren(frag);
    if (firstRender) { firstRender = false; listEl.querySelectorAll(".item").forEach((r, i) => { if (i < 12) { r.classList.add("enter"); r.style.animationDelay = i * 40 + "ms"; } }); }
    const empty = $("empty");
    empty.hidden = shown.length > 0;
    if (!shown.length) empty.textContent = typeFilter === "unwatched" && !query ? "You have watched everything on this list." : "No titles match your filters.";

    const arch = state.archived.filter((id) => byId.has(id)).map((id) => byId.get(id));
    archEl.replaceChildren(...arch.map((it) => row(it, true)));
    $("archiveCount").textContent = arch.length;

    updateStats(active);
  }

  function updateStats(active) {
    active = active || sortedIds().map((id) => byId.get(id)).filter((it) => !has(state.archived, it.id));
    const total = active.length;
    const done = active.filter((it) => isWatched(it.id)).length;
    $("hWatched").textContent = done;
    $("hLeft").textContent = total - done;
    $("sEss").textContent = active.filter((it) => it.tier === "ess" && !isWatched(it.id)).length;
    const pct = total ? done / total : 0;
    $("barFill").style.transform = `scaleX(${pct})`;
    $("bar").setAttribute("aria-valuenow", String(Math.round(pct * 100)));
  }

  function toggleWatched(id, li) {
    state.watched = isWatched(id) ? state.watched.filter((x) => x !== id) : [...state.watched, id];
    save();
    if (typeFilter === "unwatched") return render();
    // update in place so the colour change can transition
    li.classList.toggle("watched", isWatched(id));
    li.querySelector(".watch").setAttribute("aria-pressed", String(isWatched(id)));
    const sec = li.closest(".section");
    if (sec) {
      const ids = [...sec.querySelectorAll(".item")].map((r) => r.dataset.id);
      sec.querySelector(".count").textContent = `${ids.filter(isWatched).length} / ${ids.length} titles`;
    }
    updateStats();
  }
  function setArchived(id, on, li) {
    const commit = () => {
      state.archived = on ? [...state.archived, id] : state.archived.filter((x) => x !== id);
      save(); render();
    };
    if (li && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      li.classList.add("leaving");
      setTimeout(commit, 170);
    } else commit();
  }

  // ---- reordering ----
  function commitOrder(order) {
    state.order = order;
    state.sort = "mine";
    save(); render();
  }
  function nudge(id, dir) {
    const visible = [...listEl.querySelectorAll(".item")].map((r) => r.dataset.id);
    const neighbour = visible[visible.indexOf(id) + dir];
    if (!neighbour) return;
    const order = fullOrder().filter((x) => x !== id);
    const at = order.indexOf(neighbour);
    order.splice(dir < 0 ? at : at + 1, 0, id);
    commitOrder(order);
    const g = listEl.querySelector(`.item[data-id="${id}"] .grip`);
    if (g) g.focus();
    const pos = [...listEl.querySelectorAll(".item")].findIndex((r) => r.dataset.id === id) + 1;
    $("live").textContent = byId.get(id).title + ", position " + pos + " of " + visible.length;
  }
  let dragId = null;
  function wireDrag(li, id) {
    li.addEventListener("dragstart", (e) => {
      dragId = id;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    });
    li.addEventListener("dragend", () => { dragId = null; clearOver(); li.classList.remove("dragging"); });
    li.addEventListener("dragover", (e) => {
      if (!dragId || dragId === id) return;
      e.preventDefault();
      const r = li.getBoundingClientRect();
      const top = e.clientY < r.top + r.height / 2;
      clearOver();
      li.classList.add(top ? "over-top" : "over-bottom");
    });
    li.addEventListener("dragleave", () => li.classList.remove("over-top", "over-bottom"));
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragId || dragId === id) return;
      const r = li.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      const order = fullOrder().filter((x) => x !== dragId);
      const at = order.indexOf(id);
      order.splice(before ? at : at + 1, 0, dragId);
      dragId = null;
      commitOrder(order);
    });
  }
  function clearOver() {
    listEl.querySelectorAll(".over-top,.over-bottom").forEach((n) => n.classList.remove("over-top", "over-bottom"));
  }

  // ---- controls ----
  document.querySelectorAll(".pill").forEach((p) =>
    p.addEventListener("click", () => {
      typeFilter = p.dataset.type;
      document.querySelectorAll(".pill").forEach((x) => { x.classList.toggle("active", x === p); x.setAttribute("aria-pressed", String(x === p)); });
      render();
    })
  );
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; save(); render(); });
  $("search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); render(); });
  $("archiveToggle").addEventListener("click", (e) => {
    archEl.hidden = !archEl.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!archEl.hidden));
  });

  // reset my order (confirmed via dialog)
  const dlg = $("confirm");
  $("resetOrder").addEventListener("click", () => dlg.showModal());
  dlg.addEventListener("close", () => {
    if (dlg.returnValue === "ok") { state.order = []; save(); render(); }
    dlg.returnValue = "";
  });
  // click on the backdrop cancels
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close("cancel"); });

  render();

})();
