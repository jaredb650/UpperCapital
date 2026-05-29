/* ============================================================
   VAULT — script.js
   - Live system clock
   - Type scramble on hero word
   - Custom crosshair cursor
   ============================================================ */

(function () {

  /* ----- LIVE CLOCK (UTC, looks system-y) ------------------ */
  function pad(n) { return String(n).padStart(2, "0"); }
  function tick() {
    const d = new Date();
    const s = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
    const b = document.getElementById("footer-time");
    if (b) b.textContent = s;
  }
  tick();
  setInterval(tick, 1000);


  /* ----- TYPE SCRAMBLE ------------------------------------- */
  /* Cycles random chars then resolves to target. Used on hero. */
  const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
  function scramble(el, finalText, duration = 900) {
    const length = finalText.length;
    const start = performance.now();

    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      // each char locks in at its own progress threshold
      let out = "";
      for (let i = 0; i < length; i++) {
        const lockAt = (i + 1) / length * 0.7; // first 70% does the scramble
        if (t > lockAt) {
          out += finalText[i];
        } else {
          out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = finalText;
    }
    requestAnimationFrame(frame);
  }

  // Run scramble after fonts load so width settles
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.querySelectorAll("[data-scramble]").forEach((el) => {
        const target = el.getAttribute("data-scramble");
        // small delay so it harmonizes with the line-lift animation
        setTimeout(() => scramble(el, target, 850), 600);
      });
    });
  }


  /* ----- CROSSHAIR CURSOR --------------------------------- */
  const isCoarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (!isCoarse) {
    const crosshair = document.getElementById("crosshair");
    if (crosshair) {
      const v = crosshair.querySelector(".crosshair__v");
      const h = crosshair.querySelector(".crosshair__h");
      const dot = crosshair.querySelector(".crosshair__dot");

      let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
      let cx = tx, cy = ty;

      window.addEventListener("mousemove", (e) => {
        tx = e.clientX;
        ty = e.clientY;
      });

      function loop() {
        // light ease for smoothness
        cx += (tx - cx) * 0.35;
        cy += (ty - cy) * 0.35;
        v.style.transform = `translateX(${cx}px)`;
        h.style.transform = `translateY(${cy}px)`;
        dot.style.left = cx + "px";
        dot.style.top = cy + "px";
        requestAnimationFrame(loop);
      }
      loop();

      // Hover state when over interactive elements
      const interactive = "a, button, [data-hover]";
      document.querySelectorAll(interactive).forEach((el) => {
        el.addEventListener("mouseenter", () => crosshair.classList.add("is-hover"));
        el.addEventListener("mouseleave", () => crosshair.classList.remove("is-hover"));
      });
    }
  }


  /* ----- SCROLL-IN REVEAL --------------------------------- */
  const reveals = document.querySelectorAll(
    ".stats__grid .stat, .focus-table tbody tr, .team__grid .member, .manifesto__caption, .ascii-box"
  );
  reveals.forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(12px)";
    el.style.transition = `opacity 0.6s ease ${i * 0.04}s, transform 0.6s ease ${i * 0.04}s`;
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
