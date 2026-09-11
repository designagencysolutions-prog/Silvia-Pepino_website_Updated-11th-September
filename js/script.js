// Mobile nav toggle
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

navToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

// Shrink header on scroll, and flatten the horizon as the hero scrolls away
const nav = document.querySelector(".nav");
const heroSection = document.querySelector(".hero");
let navTicking = false;

// How far the circle grows. Scaling about the apex flattens the curve:
// sag at the screen edge falls off as 1/scale, so 5x is near-straight.
const FLAT_MAX = 5;
let lastFlat = -1;

const updateHorizon = () => {
  if (!heroSection) return;
  const travel = heroSection.offsetHeight * 0.75;
  const p = Math.min(1, Math.max(0, window.scrollY / travel));
  // Ease out, so most of the flattening happens early in the scroll
  const eased = 1 - Math.pow(1 - p, 2);
  // Quantise to avoid restyling on every pixel of scroll
  const step = Math.round(eased * 60) / 60;
  if (step === lastFlat) return;
  lastFlat = step;
  heroSection.style.setProperty(
    "--horizon-flat",
    (1 + step * (FLAT_MAX - 1)).toFixed(3)
  );
  heroSection.style.setProperty("--horizon-glow", (1 - step * 0.6).toFixed(3));
};

const updateNav = () => {
  nav.classList.toggle("scrolled", window.scrollY > 24);
  updateHorizon();
  navTicking = false;
};

window.addEventListener(
  "scroll",
  () => {
    if (!navTicking) {
      navTicking = true;
      requestAnimationFrame(updateNav);
    }
  },
  { passive: true }
);

updateNav();

// Glass orb trailing the cursor in the hero
(() => {
  const orb = document.querySelector(".hero__deco");
  const heroEl = orb && orb.closest(".hero");
  if (!orb || !heroEl) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let scale = 0.6;
  let active = false;
  let raf = 0;

  const render = () => {
    x += (targetX - x) * 0.14;
    y += (targetY - y) * 0.14;
    scale += ((active ? 1 : 0.6) - scale) * 0.12;
    orb.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    raf = requestAnimationFrame(render);
  };

  heroEl.addEventListener(
    "pointermove",
    (e) => {
      const rect = heroEl.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
      if (!active) {
        active = true;
        x = targetX;
        y = targetY;
        orb.classList.add("is-visible");
      }
      if (!raf) raf = requestAnimationFrame(render);
    },
    { passive: true }
  );

  heroEl.addEventListener("pointerleave", () => {
    active = false;
    orb.classList.remove("is-visible");
  });
})();

// Star fields — twinkle + pointer parallax. Any .star-field canvas gets
// one, scaled by its own data-density.
document.querySelectorAll(".star-field").forEach((canvas, fieldIndex) => {
  const hero = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const STAR_COUNT = Math.round(220 * (Number(canvas.dataset.density) || 1));
  const PARALLAX_RADIUS = 0.22;
  const PARALLAX_STRENGTH = 4;

  // Deterministic placement so the sky is stable across reloads
  const mulberry32 = (seed) => {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Different seed per field, so the two skies aren't identical
  const rand = mulberry32(42 + fieldIndex * 977);
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: 0.04 + rand() * 0.92,
    y: 0.04 + rand() * 0.92,
    size: 0.7 + rand() * 1.4,
    baseOpacity: 0.15 + rand() * 0.45,
    twinkleSpeed: 0.35 + rand() * 1.1,
    twinklePhase: rand() * Math.PI * 2,
  }));

  const pointer = { x: -1, y: -1, inside: false };
  let w = 0;
  let h = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = hero.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (now) => {
    ctx.clearRect(0, 0, w, h);
    const time = now / 1000;
    const px = pointer.inside ? pointer.x / w : -1;
    const py = pointer.inside ? pointer.y / h : -1;

    for (const s of stars) {
      let opacity = s.baseOpacity;
      if (!reduceMotion) {
        opacity *=
          0.55 +
          0.45 *
            Math.sin(time * s.twinkleSpeed * Math.PI * 2 + s.twinklePhase);
      }

      let tx = 0;
      let ty = 0;
      let scale = 1;

      if (pointer.inside) {
        const dx = s.x - px;
        const dy = s.y - py;
        const dist = Math.hypot(dx, dy);
        const influence = Math.max(0, Math.min(1, 1 - dist / PARALLAX_RADIUS));
        if (dist > 0.001) {
          tx = (dx / dist) * influence * PARALLAX_STRENGTH;
          ty = (dy / dist) * influence * PARALLAX_STRENGTH;
        }
        opacity *= 1 + influence * 0.55;
        scale = 1 + influence * 0.12;
      }

      const r = (s.size * scale) / 2;
      ctx.globalAlpha = Math.max(0.04, Math.min(1, opacity));
      ctx.fillStyle = "#fff";
      if (s.size > 1.6) {
        ctx.shadowBlur = s.size * 1.5;
        ctx.shadowColor = "rgba(255,255,255,0.25)";
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(s.x * w + tx, s.y * h + ty, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  };

  let raf = 0;
  const loop = (now) => {
    draw(now);
    raf = requestAnimationFrame(loop);
  };

  resize();

  if (reduceMotion) {
    draw(0);
  } else {
    hero.addEventListener(
      "pointermove",
      (e) => {
        const rect = hero.getBoundingClientRect();
        pointer.x = e.clientX - rect.left;
        pointer.y = e.clientY - rect.top;
        pointer.inside = true;
      },
      { passive: true }
    );
    hero.addEventListener("pointerleave", () => {
      pointer.inside = false;
    });

    // Pause when the hero is off screen
    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !raf) {
          raf = requestAnimationFrame(loop);
        } else if (!entry.isIntersecting && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    ).observe(hero);
  }

  new ResizeObserver(() => {
    resize();
    if (reduceMotion) draw(0);
  }).observe(hero);
});

// Domain graph — routes SVG wires between the cards and animates pulses
(() => {
  const canvas = document.getElementById("graphCanvas");
  const svg = document.getElementById("graphWires");
  const label = document.getElementById("graphLabel");
  const domainsRow = document.getElementById("graphDomains");
  const activitiesRow = document.getElementById("graphActivities");
  if (!canvas || !svg || !label || !domainsRow || !activitiesRow) return;

  const NS = "http://www.w3.org/2000/svg";
  const CORNER = 14;
  const DASH = 46;
  // Breathing room between a card edge and its endpoint dot
  const CARD_GAP = 24;
  // Vertical run between the dot and the bus, so the dot reads as sitting
  // under the card rather than sitting on the bus line
  const STUB = 46;

  // One relay, in three legs. Every pulse shares the same cycle length and
  // is parked out of sight outside its own window, so the handoffs stay
  // locked together no matter how long each path happens to be.
  const CYCLE = 4;
  const LEG_IN = [0, 1.15]; // domains  -> junction, in each card's colour
  const LEG_TRUNK = [1.15, 1.85]; // through the junction, merged colour
  const LEG_OUT = [1.85, 3.1]; // junction -> activities, split again
  const MERGED = "#c3c0ff";

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const accentOf = (el) =>
    getComputedStyle(el).getPropertyValue("--accent").trim() || "#7547ff";

  const roundedPath = (pts, r) => {
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const prev = pts[i - 1];
      const next = pts[i + 1];
      const d1 = Math.hypot(prev.x - p.x, prev.y - p.y);
      const d2 = Math.hypot(next.x - p.x, next.y - p.y);
      if (d1 < 0.5 || d2 < 0.5) continue;
      const rr = Math.min(r, d1 / 2, d2 / 2);
      const a = {
        x: p.x + ((prev.x - p.x) / d1) * rr,
        y: p.y + ((prev.y - p.y) / d1) * rr,
      };
      const b = {
        x: p.x + ((next.x - p.x) / d2) * rr,
        y: p.y + ((next.y - p.y) / d2) * rr,
      };
      d += ` L ${a.x.toFixed(1)} ${a.y.toFixed(1)}`;
      d += ` Q ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${b.x.toFixed(
        1
      )} ${b.y.toFixed(1)}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
    return d;
  };

  const animations = [];

  const addWire = (pts, color, [t0, t1]) => {
    const d = roundedPath(pts, CORNER);

    const base = document.createElementNS(NS, "path");
    base.setAttribute("class", "wire");
    base.setAttribute("d", d);
    base.style.setProperty("--wire-color", color);
    svg.appendChild(base);

    if (reduceMotion) return;

    const pulse = document.createElementNS(NS, "path");
    pulse.setAttribute("class", "wire-pulse");
    pulse.setAttribute("d", d);
    pulse.style.setProperty("--wire-color", color);
    svg.appendChild(pulse);

    const len = base.getTotalLength();
    pulse.style.strokeDasharray = `${DASH} ${len.toFixed(1)}`;

    // Held at the start until t0, travels to the far end by t1, then held
    // past the end for the rest of the cycle — invisible at both extremes.
    animations.push(
      pulse.animate(
        [
          { strokeDashoffset: DASH, offset: 0 },
          { strokeDashoffset: DASH, offset: t0 / CYCLE },
          { strokeDashoffset: -len, offset: t1 / CYCLE },
          { strokeDashoffset: -len, offset: 1 },
        ],
        { duration: CYCLE * 1000, iterations: Infinity, easing: "linear" }
      )
    );
  };

  const addDot = (x, y, color, r = 4) => {
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("class", "wire-dot");
    dot.setAttribute("cx", x.toFixed(1));
    dot.setAttribute("cy", y.toFixed(1));
    dot.setAttribute("r", String(r));
    dot.style.setProperty("--wire-color", color);
    svg.appendChild(dot);
    return dot;
  };

  const draw = () => {
    const box = canvas.getBoundingClientRect();
    if (box.width < 10) return;

    animations.forEach((a) => a.cancel());
    animations.length = 0;
    svg.innerHTML = "";

    // Below 1100px the cards wrap to several rows and the routing no longer
    // makes sense; CSS hides the layer, so skip the work entirely.
    if (getComputedStyle(svg).display === "none") return;
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);

    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - box.left,
        right: r.right - box.left,
        top: r.top - box.top,
        bottom: r.bottom - box.top,
        cx: r.left - box.left + r.width / 2,
      };
    };

    const domainCards = [...domainsRow.querySelectorAll(".node-card")];
    const activityCards = [...activitiesRow.querySelectorAll(".activity-card")];
    if (!domainCards.length || !activityCards.length) return;

    const domainsBox = rel(domainsRow);
    const gapBox = rel(label);
    const activitiesBox = rel(activitiesRow);

    // Dots sit CARD_GAP from the card edge, on the card side of the bus.
    const wireTop = domainsBox.bottom + CARD_GAP;
    const wireBottom = activitiesBox.top - CARD_GAP;

    // A shared bus under the domains, a single trunk through the middle,
    // then a second bus that fans out to the activity cards.
    const trunkX = domainsBox.cx;
    const busY = wireTop + STUB;
    const branchY = wireBottom - STUB;
    const midY = (busY + branchY) / 2;

    // Leg 1 — each domain runs down and inward in its own colour, all
    // arriving at the top of the trunk together.
    domainCards.forEach((card) => {
      const c = rel(card);
      const color = accentOf(card);
      addWire(
        [
          { x: c.cx, y: wireTop },
          { x: c.cx, y: busY },
          { x: trunkX, y: busY },
        ],
        color,
        LEG_IN
      );
      addDot(c.cx, wireTop, color, 3.5);
    });

    // Leg 2 — the merged signal, one pulse in a single blended colour.
    addWire(
      [
        { x: trunkX, y: busY },
        { x: trunkX, y: branchY },
      ],
      MERGED,
      LEG_TRUNK
    );

    // Leg 3 — back out to each activity, colours separate again.
    activityCards.forEach((card) => {
      const c = rel(card);
      const color = accentOf(card);
      addWire(
        [
          { x: trunkX, y: branchY },
          { x: c.cx, y: branchY },
          { x: c.cx, y: wireBottom },
        ],
        color,
        LEG_OUT
      );
      addDot(c.cx, wireBottom, color, 3.5);
    });

    // The junction itself, flaring as the merged pulse passes through
    const junction = addDot(trunkX, midY, MERGED, 5);
    if (!reduceMotion) {
      const flare = LEG_TRUNK[0] + (LEG_TRUNK[1] - LEG_TRUNK[0]) * 0.5;
      animations.push(
        junction.animate(
          [
            { transform: "scale(1)", opacity: 0.75, offset: 0 },
            {
              transform: "scale(1)",
              opacity: 0.75,
              offset: Math.max(0, (flare - 0.35) / CYCLE),
            },
            { transform: "scale(1.9)", opacity: 1, offset: flare / CYCLE },
            {
              transform: "scale(1)",
              opacity: 0.75,
              offset: Math.min(1, (flare + 0.45) / CYCLE),
            },
            { transform: "scale(1)", opacity: 0.75, offset: 1 },
          ],
          {
            duration: CYCLE * 1000,
            iterations: Infinity,
            easing: "ease-in-out",
          }
        )
      );
    }
  };

  let pending = 0;
  const schedule = () => {
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      pending = 0;
      draw();
    });
  };

  draw();
  new ResizeObserver(schedule).observe(canvas);
  window.addEventListener("resize", schedule);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(schedule);
  }
  window.addEventListener("load", schedule);
})();

// Jigsaw board — clip-path: path() has no percentage form, so the piece
// silhouettes have to be regenerated whenever the board's width changes.
(() => {
  const grid = document.querySelector(".ideas__grid");
  if (!grid) return;

  const cards = [...grid.querySelectorAll(".idea-card")];
  if (cards.length !== 4) return;

  const PAD = 48; // surround that gives a protruding tab room
  const CH = 380; // cell height
  const C = 46; // chord across the base of a knob
  const R = 28; // knob radius
  const CR = 26; // rounded outer corner of the board

  const bump = (p0, p1, kind, axis) => {
    const [x0, y0] = p0;
    const [x1, y1] = p1;
    if (!kind) return `L ${x1} ${y1} `;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    let a;
    let b;
    let s;
    if (axis === "h") {
      a = [mx - C / 2, y0];
      b = [mx + C / 2, y0];
      s = kind > 0 ? 0 : 1;
      if (x1 < x0) {
        a = [mx + C / 2, y0];
        b = [mx - C / 2, y0];
        s = 1 - s;
      }
    } else {
      a = [x0, my - C / 2];
      b = [x0, my + C / 2];
      s = kind > 0 ? 1 : 0;
      if (y1 < y0) {
        a = [x0, my + C / 2];
        b = [x0, my - C / 2];
        s = 1 - s;
      }
    }
    const f = (n) => Math.round(n * 10) / 10;
    return (
      `L ${f(a[0])} ${f(a[1])} A ${R} ${R} 0 1 ${s} ${f(b[0])} ${f(b[1])} ` +
      `L ${f(x1)} ${f(y1)} `
    );
  };

  const piece = (w, h, [t, r, b, l], corner) => {
    const x0 = PAD;
    const y0 = PAD;
    const x1 = PAD + w;
    const y1 = PAD + h;
    const rTL = corner === "TL" ? CR : 0;
    const rTR = corner === "TR" ? CR : 0;
    const rBR = corner === "BR" ? CR : 0;
    const rBL = corner === "BL" ? CR : 0;

    let d = `M ${x0 + rTL} ${y0} `;
    d += bump([x0 + rTL, y0], [x1 - rTR, y0], t, "h");
    if (rTR) d += `A ${rTR} ${rTR} 0 0 1 ${x1} ${y0 + rTR} `;
    d += bump([x1, y0 + rTR], [x1, y1 - rBR], r, "v");
    if (rBR) d += `A ${rBR} ${rBR} 0 0 1 ${x1 - rBR} ${y1} `;
    d += bump([x1 - rBR, y1], [x0 + rBL, y1], b, "h");
    if (rBL) d += `A ${rBL} ${rBL} 0 0 1 ${x0} ${y1 - rBL} `;
    d += bump([x0, y1 - rBL], [x0, y0 + rTL], l, "v");
    if (rTL) d += `A ${rTL} ${rTL} 0 0 1 ${x0 + rTL} ${y0} `;
    return d + "Z";
  };

  // top, right, bottom, left: +1 tab, -1 blank, 0 flat
  const spec = [
    [[0, 1, 1, 0], "TL"],
    [[0, 0, 1, -1], "TR"],
    [[-1, 1, 0, 0], "BL"],
    [[-1, 0, 0, -1], "BR"],
  ];

  let lastW = 0;

  const layout = () => {
    // Only applies above the breakpoint where the board is a puzzle
    if (getComputedStyle(grid).getPropertyValue("--puzzle").trim() !== "on") {
      cards.forEach((c) => (c.style.clipPath = ""));
      lastW = 0;
      return;
    }
    const cellW = Math.round(grid.getBoundingClientRect().width / 2);
    if (!cellW || cellW === lastW) return;
    lastW = cellW;

    grid.style.setProperty("--cell-h", `${CH}px`);
    grid.style.setProperty("--pad", `${PAD}px`);
    cards.forEach((card, i) => {
      const [edges, corner] = spec[i];
      card.style.clipPath = `path("${piece(cellW, CH, edges, corner)}")`;
    });
  };

  layout();
  new ResizeObserver(layout).observe(grid);
  window.addEventListener("resize", layout);
})();

// Research-areas mesh — links neighbouring cards and runs pulses along
// the links. Only the gutter segments are visible; the cards are opaque,
// so each line reads as a short connector rather than crossing the grid.
(() => {
  const svg = document.getElementById("areaWires");
  const grid = document.querySelector(".pubs-areas__grid");
  if (!svg || !grid) return;

  const NS = "http://www.w3.org/2000/svg";
  const DASH = 26;
  const CYCLE = 3.6;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const cards = [...grid.querySelectorAll(".area-card")];
  if (cards.length < 2) return;

  const animations = [];

  const draw = () => {
    animations.forEach((a) => a.cancel());
    animations.length = 0;
    svg.innerHTML = "";

    const box = grid.getBoundingClientRect();
    if (box.width < 10) return;
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);

    const centres = cards.map((c) => {
      const r = c.getBoundingClientRect();
      return {
        x: r.left - box.left + r.width / 2,
        y: r.top - box.top + r.height / 2,
        top: r.top - box.top,
      };
    });

    // Work out the column count from how many cards share the first row
    const firstTop = centres[0].top;
    const cols = centres.filter((c) => Math.abs(c.top - firstTop) < 4).length;
    if (cols < 2) return;

    const links = [];
    centres.forEach((c, i) => {
      const sameRow = Math.floor(i / cols) === Math.floor((i + 1) / cols);
      if (i + 1 < centres.length && sameRow) links.push([c, centres[i + 1]]);
      if (i + cols < centres.length) links.push([c, centres[i + cols]]);
    });

    links.forEach(([a, b], i) => {
      const d = `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(
        1
      )} ${b.y.toFixed(1)}`;

      const base = document.createElementNS(NS, "path");
      base.setAttribute("class", "area-wire");
      base.setAttribute("d", d);
      svg.appendChild(base);

      if (reduceMotion) return;

      const pulse = document.createElementNS(NS, "path");
      pulse.setAttribute("class", "area-wire-pulse");
      pulse.setAttribute("d", d);
      svg.appendChild(pulse);

      const len = base.getTotalLength();
      pulse.style.strokeDasharray = `${DASH} ${len.toFixed(1)}`;

      const t0 = (i % 5) * 0.42;
      animations.push(
        pulse.animate(
          [
            { strokeDashoffset: DASH, offset: 0 },
            { strokeDashoffset: DASH, offset: t0 / CYCLE },
            { strokeDashoffset: -len, offset: (t0 + 1.5) / CYCLE },
            { strokeDashoffset: -len, offset: 1 },
          ],
          { duration: CYCLE * 1000, iterations: Infinity, easing: "linear" }
        )
      );
    });
  };

  let pending = 0;
  const schedule = () => {
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      pending = 0;
      draw();
    });
  };

  draw();
  new ResizeObserver(schedule).observe(grid);
  window.addEventListener("resize", schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
})();

// Awards marquee — clone the set so the loop has no seam, and pace the
// animation by width so the cards always travel at the same speed
(() => {
  const track = document.getElementById("awardsTrack");
  if (!track) return;

  const originals = [...track.children];
  if (!originals.length) return;

  originals.forEach((card, i) => {
    // Staggered starts make the highlight travel along the row rather than
    // every card flashing at once...
    card.style.setProperty("--shimmer-delay", `${(i * 0.55).toFixed(2)}s`);
    // ...and alternating the direction keeps neighbouring cards from
    // looking like one continuous sweep.
    card.style.setProperty("--shimmer-dir", i % 2 ? "reverse" : "normal");
    // Slightly uneven periods so the row never resolves into lockstep
    card.style.setProperty("--shimmer-dur", `${(4.4 + (i % 3) * 0.8).toFixed(1)}s`);
  });

  originals.forEach((card) => {
    const copy = card.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    copy.querySelectorAll("a, button").forEach((el) => {
      el.setAttribute("tabindex", "-1");
    });
    track.appendChild(copy);
  });

  const PX_PER_SECOND = 85; // awards row
  const setPace = () => {
    // Half the track is one full set; that's the distance per cycle
    const distance = track.scrollWidth / 2;
    if (!distance) return;
    track.style.setProperty(
      "--marquee-dur",
      `${(distance / PX_PER_SECOND).toFixed(1)}s`
    );
  };

  setPace();
  new ResizeObserver(setPace).observe(track);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setPace);
})();

// Contact form. There's no backend, so this composes a pre-filled email
// and hands it to the visitor's mail client. Swap the handler for a POST
// to a form service when one is set up.
(() => {
  const form = document.getElementById("contactForm");
  const status = document.getElementById("contactStatus");
  if (!form) return;

  // Delivery goes through FormSubmit's AJAX endpoint: free, no account and
  // no dashboard to maintain. The first message sent from the live domain
  // triggers a one-time confirmation email to the address below; once that
  // link is clicked, everything afterwards is delivered silently.
  //
  // FormSubmit also issues a hashed endpoint after activation. Swapping ENDPOINT
  // for `https://formsubmit.co/ajax/<hash>` keeps the address out of the page
  // source, which is worth doing — the parts below only slow a scraper down.
  const INBOX = ["spglobh", "gmail.com"].join("@");
  const ENDPOINT = "https://formsubmit.co/ajax/" + INBOX;

  // Flag a required field only once it's been left empty, not while typing
  form.querySelectorAll("input[required], textarea[required]").forEach((el) => {
    el.addEventListener("blur", () => {
      el.classList.toggle("is-invalid", !el.value.trim());
    });
    el.addEventListener("input", () => el.classList.remove("is-invalid"));
  });

  const setBusy = (on) => {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = on;
    btn.classList.toggle("is-busy", on);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const get = (k) => (data.get(k) || "").toString().trim();

    const missing = [...form.querySelectorAll("[required]")].filter(
      (el) => !el.value.trim()
    );
    if (missing.length) {
      missing.forEach((el) => el.classList.add("is-invalid"));
      missing[0].focus();
      status.textContent = "Please complete the required fields.";
      status.className = "contact__status is-error";
      return;
    }

    // Bots fill every field they find; a real visitor never sees this one
    if (get("_honey")) return;

    setBusy(true);
    status.textContent = "Sending…";
    status.className = "contact__status";

    const payload = {
      name: get("name"),
      email: get("email"),
      organisation: get("organisation") || "—",
      enquiry: get("enquiry"),
      message: get("message"),
      _subject: `Website enquiry — ${get("enquiry")}`,
      _template: "table",
      _captcha: "false",
    };

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));

      if (!res.ok || out.success === "false" || out.success === false) {
        throw new Error(out.message || `HTTP ${res.status}`);
      }

      form.reset();
      status.textContent =
        "Thank you — your message has been sent. I'll be in touch shortly.";
      status.className = "contact__status is-success";
    } catch (err) {
      // Never leave someone with an unsent message: fall back to their mail
      // client with everything they typed already filled in.
      const body = [
        `Name: ${get("name")}`,
        `Organisation: ${get("organisation") || "—"}`,
        `Email: ${get("email")}`,
        `Nature of enquiry: ${get("enquiry")}`,
        "",
        get("message"),
      ].join("\n");

      status.innerHTML =
        "Something went wrong sending your message. " +
        `<a href="mailto:${INBOX}?subject=${encodeURIComponent(
          `Website enquiry — ${get("enquiry")}`
        )}&body=${encodeURIComponent(body)}">Send it by email instead</a>.`;
      status.className = "contact__status is-error";
    } finally {
      setBusy(false);
    }
  });
})();

// Generic marquee — any [data-marquee] track scrolls continuously. The set
// is cloned so the loop has no seam, and the duration is derived from the
// measured width so speed stays constant regardless of how many items.
(() => {
  const tracks = document.querySelectorAll("[data-marquee]");
  if (!tracks.length) return;

  tracks.forEach((track) => {
    const originals = [...track.children];
    if (!originals.length) return;

    originals.forEach((el) => {
      const copy = el.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      copy.querySelectorAll("a, button").forEach((n) =>
        n.setAttribute("tabindex", "-1")
      );
      track.appendChild(copy);
    });

    const speed = Number(track.dataset.speed) || 40;
    const setPace = () => {
      const distance = track.scrollWidth / 2;
      if (!distance) return;
      track.style.setProperty(
        "--marquee-dur",
        `${(distance / speed).toFixed(1)}s`
      );
    };

    setPace();
    new ResizeObserver(setPace).observe(track);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(setPace);
    }
  });
})();

// Scroll reveal — any .reveal block fades up once, then stops observing
(() => {
  const blocks = document.querySelectorAll(".reveal");
  if (!blocks.length) return;

  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    blocks.forEach((b) => b.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
  );

  blocks.forEach((b) => io.observe(b));
})();

// Work & Engagements accordion — the panel's artwork and accent follow
// whichever item is open
(() => {
  const items = [...document.querySelectorAll(".work__item")];
  const panel = document.querySelector(".work__panel");
  const visual = document.querySelector(".work__visual");
  if (!items.length || !panel || !visual) return;

  const img = visual.querySelector("img");

  const sync = (item) => {
    const accent = getComputedStyle(item).getPropertyValue("--accent").trim();
    if (accent) panel.style.setProperty("--accent", accent);

    const src = item.dataset.visual;
    if (!src || !img || img.getAttribute("src") === src) return;
    // Fade out, swap, fade back in — a straight src change flickers
    visual.classList.add("is-swapping");
    setTimeout(() => {
      img.setAttribute("src", src);
      visual.classList.remove("is-swapping");
    }, 220);
  };

  items.forEach((item) => {
    item.querySelector(".work__item-head").addEventListener("click", () => {
      if (item.classList.contains("active")) return; // one always open
      items.forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
      sync(item);
    });
  });

  // Strategic Advisory is marked active in the markup; adopt its accent
  const initial = items.find((i) => i.classList.contains("active")) || items[0];
  initial.classList.add("active");
  sync(initial);
})();

// Career timeline — a progress indicator that tracks the scroll position,
// lighting each node as it passes. The reference line sits at 58% of the
// viewport, a little below centre, so a node lights just before you read it.
(() => {
  const wrap = document.querySelector(".timeline-wrap");
  const fill = wrap && wrap.querySelector(".timeline__progress");
  if (!wrap || !fill) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const items = [...wrap.querySelectorAll(".tl")];
  let queued = false;

  const update = () => {
    queued = false;
    const rail = wrap.querySelector(".timeline__rail");
    const box = rail.getBoundingClientRect();
    const line = window.innerHeight * 0.58;

    // Clamped, so the bar sits empty above the section and full below it
    const p = Math.max(0, Math.min(1, (line - box.top) / (box.height || 1)));
    fill.style.transform = `scaleY(${p})`;

    items.forEach((item) => {
      const marker = item.querySelector(".tl__marker");
      const ref = marker || item;
      const r = ref.getBoundingClientRect();
      const passed = r.top + r.height / 2 <= line;
      item.classList.toggle("is-reached", passed);
      if (marker) marker.classList.toggle("is-reached", passed);
    });
  };

  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();

// Press & Media rail — arrow buttons scroll by one card, and go dim at
// whichever end the rail has reached.
(() => {
  const rail = document.querySelector(".press__rail");
  const track = document.getElementById("pressTrack");
  const arrows = [...document.querySelectorAll(".press__arrow")];
  if (!rail || !track || !arrows.length) return;

  // Measured rather than hard-coded, so the CSS stays the single source of
  // truth for card width and gap.
  const step = () => {
    const card = track.querySelector(".press-card");
    if (!card) return rail.clientWidth * 0.8;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  };

  const sync = () => {
    const max = rail.scrollWidth - rail.clientWidth - 2;
    arrows.forEach((a) => {
      const dir = Number(a.dataset.pressDir);
      a.disabled = dir < 0 ? rail.scrollLeft <= 2 : rail.scrollLeft >= max;
    });
  };

  arrows.forEach((a) => {
    a.addEventListener("click", () => {
      rail.scrollBy({ left: Number(a.dataset.pressDir) * step() });
    });
  });

  rail.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  sync();
})();

// Experience credentials accordion. Exclusive, and one is always open —
// the first is marked is-open in the markup, so the block never collapses
// to three bare headings.
(() => {
  const items = [...document.querySelectorAll(".creds .cred")];
  if (!items.length) return;

  const open = (item) => {
    items.forEach((i) => {
      const on = i === item;
      i.classList.toggle("is-open", on);
      const btn = i.querySelector(".cred__toggle");
      if (btn) btn.setAttribute("aria-expanded", String(on));
    });
  };

  items.forEach((item) => {
    const btn = item.querySelector(".cred__toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (item.classList.contains("is-open")) return;
      open(item);
    });
  });

  open(items.find((i) => i.classList.contains("is-open")) || items[0]);
})();
