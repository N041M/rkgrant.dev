// Language and theme switching, section shortcuts, the local-time clock, the
// copy button, and when text scrambles.
(function () {
  "use strict";

  const root = document.documentElement;
  const Scramble = window.Scramble;
  const reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

  const META = {
    en: {
      title: "R. K. Grant · Developer and Data Science student",
      description: "Portfolio of Ronald Karel Grant, a developer and Data Science student from Jablonec nad Nisou who works on NLP research, AI agent systems, full-stack apps and developer tools.",
    },
    cs: {
      title: "R. K. Grant · Vývojář a student Data Science",
      description: "Portfolio Ronalda Karla Granta, vývojáře a studenta Data Science z Jablonce nad Nisou, který se věnuje výzkumu s NLP, agentním systémům s AI, full-stack aplikacím a vývojářským nástrojům.",
    },
  };

  function store(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* storage can be off */ }
  }

  function centreOf(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  function pulseFrom(el) {
    if (window.Field) window.Field.pulse.apply(null, centreOf(el));
  }

  // ------------------------------------------------------------- language ---

  function applyLang(lang, animate) {
    root.lang = lang;
    document.title = META[lang].title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", META[lang].description);
    document.querySelectorAll("[data-set-lang]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-set-lang") === lang));
    });
    document.querySelectorAll("[data-label-" + lang + "]").forEach(function (el) {
      const label = el.getAttribute("data-label-" + lang);
      el.setAttribute("aria-label", label);
      if (el.tagName === "BUTTON") el.title = label;
    });
    const url = new URL(window.location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", lang);
      history.replaceState(null, "", url);
    }
    if (animate && Scramble) Scramble.all("[data-scramble]", { onlyInViewport: true });
    document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }

  document.querySelectorAll("[data-set-lang]").forEach(function (button) {
    button.addEventListener("click", function () {
      const lang = button.getAttribute("data-set-lang");
      if (lang === root.lang) return;
      store("lang", lang);
      applyLang(lang, true);
      pulseFrom(button);
    });
  });

  // ---------------------------------------------------------------- theme ---

  // "light" and "dark" pin the theme, "system" follows the operating system.
  const themeMetas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  const themeMetaDefaults = themeMetas.map(function (m) { return m.getAttribute("content"); });

  function applyTheme(choice) {
    if (choice === "light" || choice === "dark") root.setAttribute("data-theme", choice);
    else root.removeAttribute("data-theme");
    document.querySelectorAll("[data-set-theme]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-set-theme") === choice));
    });
    const bar = getComputedStyle(root).getPropertyValue("--bar").trim();
    themeMetas.forEach(function (m, i) {
      m.setAttribute("content", root.hasAttribute("data-theme") ? bar : themeMetaDefaults[i]);
    });
  }

  document.querySelectorAll("[data-set-theme]").forEach(function (button) {
    button.addEventListener("click", function () {
      const choice = button.getAttribute("data-set-theme");
      store("theme", choice);
      applyTheme(choice);
      pulseFrom(button);
    });
  });
  applyTheme(root.getAttribute("data-theme") || "system");

  // ------------------------------------------------------------ navigation ---

  // Each section link has a one-letter shortcut in each language, shown next
  // to it. The link of the section in the middle of the screen is marked.
  const navLinks = Array.from(document.querySelectorAll(".nav a[href^='#']"));

  function goTo(link) {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    target.scrollIntoView({ behavior: reducedMQ.matches ? "auto" : "smooth" });
    if (Scramble) Scramble.leaves(link).forEach(function (el) { if (el.getClientRects().length) Scramble.element(el); });
  }

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const key = e.key.toLowerCase();
    const link = navLinks.find(function (a) { return a.getAttribute("data-key-" + root.lang) === key; });
    if (!link) return;
    e.preventDefault();
    goTo(link);
  });

  // The current section is the last one whose top has passed 40% of the
  // screen, or the last section once the page is scrolled to the end.
  const sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute("href")); });
  function spy() {
    const line = window.innerHeight * 0.4;
    let current = -1;
    sections.forEach(function (sec, i) {
      if (sec && sec.getBoundingClientRect().top <= line) current = i;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections.length - 1;
    navLinks.forEach(function (a, i) { a.setAttribute("aria-current", String(i === current)); });
  }
  let spyQueued = false;
  window.addEventListener("scroll", function () {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(function () {
      spyQueued = false;
      spy();
    });
  }, { passive: true });
  spy();

  // ----------------------------------------------------------------- clock ---

  function tick() {
    const locale = root.lang === "cs" ? "cs-CZ" : "en-GB";
    const now = new Date();
    const time = new Intl.DateTimeFormat(locale, { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" }).format(now);
    const zone = new Intl.DateTimeFormat(locale, { timeZone: "Europe/Prague", timeZoneName: "short" })
      .formatToParts(now)
      .find(function (part) { return part.type === "timeZoneName"; });
    document.querySelectorAll("[data-clock]").forEach(function (el) {
      el.textContent = time + (zone ? " " + zone.value : "");
    });
  }
  tick();
  setInterval(tick, 20000);
  document.addEventListener("langchange", tick);

  // ----------------------------------------------------------------- copy ---

  document.querySelectorAll("[data-copy]").forEach(function (button) {
    let timer = 0;
    button.addEventListener("click", function () {
      const text = button.getAttribute("data-copy");
      const done = function () {
        button.classList.add("done");
        if (Scramble) Scramble.leaves(button.querySelector(".copy-done")).forEach(function (el) { Scramble.element(el); });
        clearTimeout(timer);
        timer = setTimeout(function () { button.classList.remove("done"); }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  // -------------------------------------------------------------- scramble ---

  applyLang(root.lang === "cs" ? "cs" : "en", false);

  if (Scramble) {
    Scramble.installClickHandler();
    Scramble.all(".top [data-scramble], .hero [data-scramble]");

    // Headings and labels resolve the first time they scroll into view.
    const seen = new WeakSet();
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || seen.has(e.target)) return;
        seen.add(e.target);
        io.unobserve(e.target);
        Scramble.leaves(e.target).forEach(function (el, i) {
          if (el.getClientRects().length) Scramble.element(el, (i % 5) * 40);
        });
      });
    }, { threshold: 0.6 });
    document.querySelectorAll("main section:not(.hero) [data-scramble]").forEach(function (el) { io.observe(el); });
  }
})();
