/* ============================================================
   LEDGER — script.js
   Minimal, considered motion.
   - Scroll-reveal via IntersectionObserver
   - That's it. The serif does the rest.
   ============================================================ */

(function () {
  // Pieces we want to gently reveal as they enter view.
  const selectors = [
    ".manifesto__body > *",
    ".margin-note",
    ".ledger__grid .figure",
    ".focus__intro h2",
    ".focus__list li",
    ".team__grid .partner",
    ".contact__inner > *",
    ".colophon__inner > *",
  ];

  const targets = document.querySelectorAll(selectors.join(","));
  targets.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min(i * 0.04, 0.3)}s`;
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );

  targets.forEach((el) => io.observe(el));
})();
