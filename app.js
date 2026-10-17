(() => {
  const KEY = "mcu-watchlist-v1";
  const defaults = { watched: [], archived: [], order: [], sort: "release", expanded: false };
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

  const TIER_LABEL = { ess: "Essential", rec: "Recommended", opt: "Optional" };
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
  // titles in play: not archived, and non-Marvel-Studios ones only when "Expanded Marvel" is ticked
  function activeItems() {
    return sortedIds().map((id) => byId.get(id)).filter((it) => !has(state.archived, it.id) && (state.expanded || !it.ext));
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

  function fmtDate(d) {
    const [y, m, day] = d.split("-").map(Number);
    if (!m) return String(y);
    if (!day) return new Date(y, m - 1, 1).toLocaleDateString("en-US", { year: "numeric", month: "short" });
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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
      grip.title = "Drag, or use the arrow keys";
      grip.setAttribute("aria-label", "Reorder " + it.title + " with the arrow keys");
      grip.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        nudge(it.id, e.key === "ArrowUp" ? -1 : 1);
      });
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
    $("expanded").checked = state.expanded;
    $("resetOrder").hidden = state.sort !== "mine";

    const active = activeItems();
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
    if (!shown.length) empty.textContent = typeFilter === "unwatched" && !query ? "Everything watched." : "No matches.";

    const arch = state.archived.filter((id) => byId.has(id)).map((id) => byId.get(id));
    archEl.replaceChildren(...arch.map((it) => row(it, true)));
    $("archiveCount").textContent = arch.length;

    updateStats(active);
  }

  function updateStats(active) {
    active = active || activeItems();
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
  // Pointer-driven drag: the row follows the pointer, neighbours slide out of the way live,
  // and the order is committed once on release.
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function wireDrag(li, id) {
    const grip = li.querySelector(".grip");
    grip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      startDrag(li, id, e, grip);
    });
  }
  function startDrag(li, id, e, grip) {
    const ol = li.parentElement;
    const grab = e.clientY - li.getBoundingClientRect().top;
    let y = e.clientY, raf = 0, moved = false;
    grip.setPointerCapture(e.pointerId);
    li.classList.add("dragging");
    document.body.classList.add("drag-active");
    li.style.transition = "none";
    const startNext = li.nextElementSibling;

    function place() {
      li.style.transform = "";
      const natural = li.getBoundingClientRect().top;
      let top = y - grab;
      li.style.transform = `translateY(${top - natural}px) scale(1.01)`;
      // swap past a neighbour once the dragged row's centre crosses its midpoint
      const centre = top + li.offsetHeight / 2;
      for (;;) {
        const next = li.nextElementSibling, prev = li.previousElementSibling;
        const nr = next && next.getBoundingClientRect(), pr = prev && prev.getBoundingClientRect();
        if (next && centre > nr.top + nr.height / 2) swap(next, true);
        else if (prev && centre < pr.top + pr.height / 2) swap(prev, false);
        else break;
        li.style.transform = "";
        const n2 = li.getBoundingClientRect().top;
        li.style.transform = `translateY(${top - n2}px) scale(1.01)`;
      }
    }
    function swap(sib, after) {
      const before = sib.getBoundingClientRect().top;
      ol.insertBefore(li, after ? sib.nextSibling : sib);
      moved = true;
      if (reduceMotion()) return;
      const d = before - sib.getBoundingClientRect().top;
      if (d) sib.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    }
    function tick() {
      const edge = 70, vh = innerHeight;
      let v = 0;
      if (y < edge) v = -Math.ceil((edge - y) / 5);
      else if (y > vh - edge) v = Math.ceil((y - (vh - edge)) / 5);
      if (v) { scrollBy({ top: v, behavior: "instant" }); place(); }
      raf = requestAnimationFrame(tick);
    }
    function onMove(ev) {
      if (ev.pointerType === "mouse" && ev.buttons === 0) return finish(true); // release was missed
      y = ev.clientY; place();
    }
    let over = false;
    function finish(commit) {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      grip.removeEventListener("pointermove", onMove);
      grip.removeEventListener("pointerup", onUp);
      grip.removeEventListener("pointercancel", onCancel);
      grip.removeEventListener("lostpointercapture", onUp);
      document.body.classList.remove("drag-active");
      const done = () => {
        li.classList.remove("dragging");
        li.style.transform = li.style.transition = "";
        if (commit && moved) {
          const next = li.nextElementSibling, prev = li.previousElementSibling;
          const order = fullOrder().filter((x) => x !== id);
          if (next) order.splice(order.indexOf(next.dataset.id), 0, id);
          else if (prev) order.splice(order.indexOf(prev.dataset.id) + 1, 0, id);
          commitOrder(order);
        } else if (!commit && moved) {
          ol.insertBefore(li, startNext);
        }
      };
      // settle into the slot, then commit
      if (reduceMotion()) return done();
      li.style.transition = "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)";
      li.style.transform = "none";
      setTimeout(done, 170);
    }
    function onUp() { finish(true); }
    function onCancel() { finish(false); }
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", onUp);
    grip.addEventListener("pointercancel", onCancel);
    grip.addEventListener("lostpointercapture", onUp);
    raf = requestAnimationFrame(tick);
    place();
  }

  // ---- jump to next unwatched ----
  let jumpId = null;
  function jumpNext() {
    const rows = [...listEl.querySelectorAll(".item:not(.watched)")];
    if (!rows.length) return;
    // step forward only while the last target is still on screen; otherwise restart at the first
    let start = 0;
    const cur = jumpId && listEl.querySelector(`.item[data-id="${jumpId}"]`);
    if (cur) {
      const r = cur.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        const after = rows.findIndex((x) => cur.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
        start = after === -1 ? 0 : after;
      }
    }
    const target = rows[start];
    jumpId = target.dataset.id;
    target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    target.classList.remove("flash"); void target.offsetWidth; target.classList.add("flash");
    target.addEventListener("animationend", () => target.classList.remove("flash"), { once: true });
    $("live").textContent = byId.get(jumpId).title;
  }
  $("jump").addEventListener("click", jumpNext);

  // ---- controls ----
  document.querySelectorAll(".pill").forEach((p) =>
    p.addEventListener("click", () => {
      typeFilter = p.dataset.type;
      document.querySelectorAll(".pill").forEach((x) => { x.classList.toggle("active", x === p); x.setAttribute("aria-pressed", String(x === p)); });
      render();
    })
  );
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; save(); render(); });
  $("expanded").addEventListener("change", (e) => { state.expanded = e.target.checked; save(); render(); });
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
  // reset watch progress (separate, confirmed)
  const pdlg = $("confirmProgress");
  $("resetProgress").addEventListener("click", () => pdlg.showModal());
  pdlg.addEventListener("close", () => {
    if (pdlg.returnValue === "ok") { state.watched = []; save(); render(); }
    pdlg.returnValue = "";
  });
  // click on a backdrop cancels
  [dlg, pdlg].forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close("cancel"); }));

  // progress lives in this browser (no account). Ask the browser not to evict it,
  // and keep other open tabs of the site in sync.
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* optional */ }
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = load();
    if (state.sort !== "mine") state.sort = "release";
    render();
  });

  render();
})();
