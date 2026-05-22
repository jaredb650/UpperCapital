/* ============================================================
   FORUM — script.js
   - Big magnetic cursor follower
   - Numeral reveal on scroll
   ============================================================ */

(function () {

  /* ----- BIG CURSOR ---------------------------------------- */
  const isCoarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (!isCoarse) {
    const cursor = document.getElementById("cursor");
    if (cursor) {
      let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
      let cx = tx, cy = ty;

      window.addEventListener("mousemove", (e) => {
        tx = e.clientX;
        ty = e.clientY;
      });

      function loop() {
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
        cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
        requestAnimationFrame(loop);
      }
      loop();

      document.querySelectorAll("a, button, [data-hover]").forEach((el) => {
        el.addEventListener("mouseenter", () => cursor.classList.add("is-active"));
        el.addEventListener("mouseleave", () => cursor.classList.remove("is-active"));
      });
    }
  }

  /* ----- HUGE NUMERAL REVEAL ------------------------------- */
  const numerals = document.querySelectorAll("[data-numeral]");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });
  numerals.forEach((el) => io.observe(el));

  /* ----- GENERIC REVEAL ------------------------------------ */
  const reveals = document.querySelectorAll(
    ".focus__list li, .partner, .manifesto__quote, .manifesto__col, .contact__row, .contact__addr"
  );
  reveals.forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    el.style.transition = `opacity 0.9s ease ${i * 0.05}s, transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) ${i * 0.05}s`;
  });
  const io2 = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        io2.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  reveals.forEach((el) => io2.observe(el));

})();
