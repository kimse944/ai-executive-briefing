// Renders the briefing from editions/index.json (the list) and editions/<date>.json (each edition).
// All text goes in via textContent and links are restricted to http(s), so edition content can never inject markup.
(function () {
  "use strict";
  const TAGS = ["frontier", "enterprise", "security", "policy", "analytics", "economics"];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const listEl = document.getElementById("ed-list");
  const pickerEl = document.getElementById("ed-picker");
  const sheetEl = document.getElementById("sheet");
  const cache = new Map();
  let manifest = [];
  let currentId = null;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function safeUrl(u) {
    try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:" ? p.href : null; } catch (e) { return null; }
  }
  function fmt(iso, long) {
    const d = new Date(iso + "T12:00:00Z");
    const opts = long
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
      : { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
    return d.toLocaleDateString("en-GB", opts);
  }

  function renderIndex() {
    listEl.replaceChildren();
    pickerEl.replaceChildren();
    manifest.forEach((ed, i) => {
      const li = el("li");
      const a = el("a");
      a.href = "#ed-" + ed.date;
      a.setAttribute("aria-current", ed.date === currentId ? "true" : "false");
      const dl = el("span", "ed-date");
      dl.append(el("span", null, fmt(ed.date)));
      if (i === 0) dl.append(el("span", "latest", "Latest"));
      a.append(dl, el("span", "ed-title", ed.title || "Untitled edition"));
      a.addEventListener("click", (e) => { e.preventDefault(); select(ed.date, true); });
      li.append(a);
      listEl.append(li);

      const opt = el("option", null, fmt(ed.date) + " · " + (ed.title || ""));
      opt.value = ed.date;
      if (ed.date === currentId) opt.selected = true;
      pickerEl.append(opt);
    });
  }

  function renderEdition(ed) {
    const art = el("article");
    const head = el("header", "ed-head");
    const dateline = el("div", "dateline");
    if (ed.number) dateline.append(el("span", "no", "No. " + ed.number));
    dateline.append(el("span", null, fmt(ed.date, true)));
    head.append(dateline, el("h1", null, ed.title || ""));
    if (ed.subtitle) head.append(el("p", "dek", ed.subtitle));
    art.append(head);
    if (ed.intro) art.append(el("p", "intro", ed.intro));

    const items = el("section", "items");
    (ed.items || []).forEach((it, i) => {
      const row = el("div", "item");
      row.append(el("div", "item-no", String(i + 1).padStart(2, "0")));
      const body = el("div", "item-body");
      const tagType = TAGS.includes(it.tagType) ? it.tagType : "economics";
      if (it.tag) body.append(el("span", "tag " + tagType, it.tag));
      body.append(el("h2", null, it.title || ""));
      if (it.news) { const p = el("p"); p.append(el("span", "lbl", "The news"), document.createTextNode(it.news)); body.append(p); }
      if (it.why) { const p = el("p"); p.append(el("span", "lbl", "Why it matters"), document.createTextNode(it.why)); body.append(p); }
      if (it.caveat) body.append(el("p", "caveat", it.caveat));
      const srcs = (it.sources || []).filter((s) => safeUrl(s.url));
      if (srcs.length) {
        const sw = el("div", "sources");
        sw.append(el("span", null, "Sources"));
        srcs.forEach((s) => {
          const a = el("a", null, s.label || "Source");
          a.href = safeUrl(s.url); a.target = "_blank"; a.rel = "noopener noreferrer";
          sw.append(a);
        });
        body.append(sw);
      }
      row.append(body);
      items.append(row);
    });
    art.append(items);

    if (ed.reflection) {
      const r = el("section", "reflection");
      r.append(el("span", "eyebrow", "Reflection"), el("h2", null, ed.reflection.title || ""));
      (ed.reflection.paragraphs || []).forEach((t) => r.append(el("p", null, t)));
      if ((ed.reflection.takeaways || []).length) {
        const ul = el("ul", "takeaways");
        ed.reflection.takeaways.forEach((t) => {
          const li = el("li");
          if (t.label) li.append(el("strong", null, t.label + ". "));
          li.append(document.createTextNode(t.text || ""));
          ul.append(li);
        });
        r.append(ul);
      }
      art.append(r);
    }

    if ((ed.questions || []).length) {
      const q = el("section", "questions");
      q.append(el("h3", null, "Questions to take to the team"));
      ed.questions.forEach((x, i) => {
        const row = el("div", "q");
        row.append(el("b", null, "Q" + (i + 1)));
        const p = el("p");
        if (x.label) p.append(el("strong", null, x.label + ": "));
        p.append(document.createTextNode(x.text || ""));
        row.append(p);
        q.append(row);
      });
      art.append(q);
    }

    if (ed.colophon) art.append(el("p", "colophon", ed.colophon));
    sheetEl.replaceChildren(art);
    document.title = (ed.title ? ed.title + " · " : "") + "AI Executive Briefing";
  }

  function showMessage(title, text) {
    const box = el("div", "empty");
    box.append(el("span", "eyebrow", "Briefing"), el("h1", null, title), el("p", null, text));
    sheetEl.replaceChildren(box);
  }

  async function loadEdition(date) {
    if (cache.has(date)) return cache.get(date);
    if (!DATE_RE.test(date)) throw new Error("bad date");
    const res = await fetch("editions/" + date + ".json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const ed = await res.json();
    cache.set(date, ed);
    return ed;
  }

  async function select(date, userAction) {
    const entry = manifest.find((e) => e.date === date) || manifest[0];
    if (!entry) return;
    currentId = entry.date;
    renderIndex();
    try {
      renderEdition(await loadEdition(entry.date));
    } catch (e) {
      showMessage("This edition could not load", "Reload the page, or pick another edition from the list.");
      return;
    }
    if (userAction) {
      try { history.replaceState(null, "", "#ed-" + entry.date); } catch (e) { /* ignore */ }
      sheetEl.scrollIntoView({ block: "start" });
    }
  }

  pickerEl.addEventListener("change", () => select(pickerEl.value, true));

  (async function boot() {
    try {
      const res = await fetch("editions/index.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      manifest = (await res.json()).filter((e) => e && DATE_RE.test(e.date));
    } catch (e) {
      showMessage("The briefing could not load", "Reload the page in a moment.");
      return;
    }
    if (!manifest.length) { showMessage("The first edition is on its way", "New briefings arrive every Monday and Thursday."); return; }
    const want = (location.hash || "").replace(/^#ed-/, "");
    select(manifest.some((e) => e.date === want) ? want : manifest[0].date, false);
  })();
})();
