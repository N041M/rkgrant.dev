// Language and theme switching, the copy button, and when text scrambles.
(function () {
  "use strict";

  const root = document.documentElement;
  const Scramble = window.Scramble;
  const darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

  const META = {
    en: {
      title: "Ronald Karel Grant · Developer and Data Science student",
      description: "Portfolio of Ronald Karel Grant, a developer and Data Science student from Jablonec nad Nisou who works on NLP research, AI agent systems, full-stack apps and developer tools.",
    },
    cs: {
      title: "Ronald Karel Grant · Vývojář a student Data Science",
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
      el.setAttribute("aria-label", el.getAttribute("data-label-" + lang));
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

  function currentTheme() {
    const set = root.getAttribute("data-theme");
    if (set === "light" || set === "dark") return set;
    return darkMQ.matches ? "dark" : "light";
  }

  function syncThemeColor() {
    const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      if (root.hasAttribute("data-theme")) m.setAttribute("content", bg);
    });
  }

  const themeButton = document.querySelector("[data-theme-toggle]");
  if (themeButton) {
    themeButton.addEventListener("click", function () {
      const next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      store("theme", next);
      syncThemeColor();
      pulseFrom(themeButton);
    });
  }
  syncThemeColor();

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
