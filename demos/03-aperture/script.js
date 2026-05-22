/* ============================================================
   APERTURE — script.js
   Scroll reveals + subtle micro-interactions.
   The WebGL scene is wired up inline in index.html (module).
   ============================================================ */

(function () {
  /* ----- SCROLL REVEAL ------------------------------------ */
  const reveals = document.querySelectorAll(
    ".thesis__head, .thesis__body, .metric, .orbit, .partner, .signal__head, .signal__row, .signal__addr"
  );
  reveals.forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(16px)";
    el.style.transition = `opacity 0.9s cubic-bezier(0.16, 0.7, 0.18, 1) ${i * 0.05}s, transform 0.9s cubic-bezier(0.16, 0.7, 0.18, 1) ${i * 0.05}s`;
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  reveals.forEach((el) => io.observe(el));
})();
