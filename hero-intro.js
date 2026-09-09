/*
  Vantage home-page intro. A globe draws in, the wordmark arrives ON THE
  SPHERE'S OWN CENTRE, the wordmark then flies to the header's own lockup at the
  top left and is swapped for it, and the globe's points DISPERSE OUTWARD into
  the hero's own background node field while the hero rises. Purely decorative:
  no labels, no tooltips, no links, no data. Every point and every arc comes
  from the fixed numeric SEED below, so the picture is identical on every
  machine and there is nothing in it to read.

  THE TWO THINGS THIS FILE NOW DOES THAT ARE WORTH KNOWING BEFORE READING IT:

    The wordmark is centred on the GLOBE'S projected centre, computed off the
    canvas geometry (cx, cy, R), never off the viewport centre, so it is exact
    at any width. The sphere's points behind it are dimmed inside a soft
    ELLIPTICAL navy veil sized to the mark's own ink box, which is what makes
    the mark legible over a field of white dots and a gold arc that crosses
    dead centre by design. See the WORDMARK MASK block.

    The globe does not fade out. Its points push outward from that same centre
    along their radial vectors, slowing on an ease-out, and a subset of them
    LANDS on the live positions of node-field.js's own nodes, sampled off the
    running module at disperse time, at that field's own measured size, alpha
    and colour. The rest thin to nothing on the way out. The sphere becomes the
    background rather than being replaced by it. See the DISPERSE block, which
    also states the three cases and what happens below node-field's own 900px
    floor, where there is no background constellation to land on at all.

  MOUNTING CONTRACT (all the wiring pass needs to know):

    1. Load this file once, on the HOME PAGE ONLY, after node-field.js:
         <script src="hero-intro.js" defer></script>
    2. Ship hero-intro-frame.png beside it. That is the reduced-motion and
       no-canvas still, rendered by this file's own renderer.

    The script inserts its own layer, sizes it, runs it and removes it. Nothing
    in the static HTML changes, so with JS off or canvas unsupported the hero is
    simply there, with no layer and no flash of hidden content. node-field.js
    keeps running underneath and is untouched: once this layer is gone the hero
    is the ordinary hero.

    Two elements of the page itself are borrowed for the length of the run and
    handed back: the header lockup is held at visibility:hidden while the intro
    copy of the mark is flying to it, and the hero block is held at opacity 0
    with a 16px offset until it rises. Both are inline styles this file sets and
    this file clears, on the animated path only. The reduced-motion path touches
    neither, so a visitor who asked for less motion gets the header mark and the
    hero exactly as the HTML ships them.

  Behavior, so nobody has to read the implementation:
    - Plays ONCE per browser session. A second visit inside the session lands
      straight on the hero.
    - Never blocks. The layer is pointer-events none, so a click passes through
      to whatever sits under it, and that click, a tap, a key or a scroll ends
      the intro at once.
    - prefers-reduced-motion gets the still for about a second, then the hero.
    - Any failure degrades to the plain hero.
    - Manual end: window.VantageHeroIntro.skip()
    - Re-render the still after changing constants:
      window.VantageHeroIntro.renderFrame(canvasEl, timeInMs)
    - Read-only diagnostic, for the QC harness and for tuning by hand:
      window.VantageHeroIntro.state()  -- globe centre, the mark's measured ink
      box, the mask's half-extents, which DISPERSE case fired, target and lander
      counts, and whether the layer is still in the DOM. Reports, never changes.
*/
(function () {
  'use strict';

  /* ========================= TUNING =========================
     Every timing, count and colour lives in this block. Nothing below it needs
     reading to change how the intro looks or how long it lasts. */

  /* SEQUENCE, milliseconds from the moment the layer appears. The reveal, which
     is the disperse plus the hero's rise, begins at REVEAL_AT, meaning
     WORDMARK_AT + WORDMARK_FADE + HOLD, 2400ms as set. End to end the run is
     REVEAL_AT + DISPERSE_MS + TEARDOWN_TAIL_MS, 3860ms as set. The mark arrives
     at 1700, HOLDS on the sphere's centre through HOLD_MS, and leaves at 2400 on
     the same instant the field opens, landing on the header at 3300, inside the
     disperse, by design: the mark is handed over while the field is still
     moving, so the two read as one handover rather than as two sequential
     events.
     Nic is tuning these himself, so nothing below this comment changes them.
     For when he does: the adversarial reviewer's read, stated as a read and
     not a fact, is that under roughly 1.5s a viewer reads this motion as a
     transition, past roughly 2s he reads it as a wait, and cutting HOLD_MS
     and DISPERSE_MS alone lands the total near 2.4s. */
  var GLOBE_FADE_IN_MS    = 700;    /* globe eases up to full weight */
  var WORDMARK_AT_MS      = 1000;   /* wordmark starts arriving */
  var WORDMARK_FADE_MS    = 700;    /* how long it takes to arrive */
  var HOLD_MS             = 700;    /* both sit still */
  var SKIP_FADE_MS        = 200;    /* on a click, tap, key or scroll. 0 cuts */
  var REDUCED_HOLD_MS     = 1000;   /* still only, reduced-motion path */
  var TEARDOWN_TAIL_MS    = 60;     /* after the disperse lands, before removal */

  /* THE TRAVEL. The centered wordmark does not fade out any more: it flies to
     the header's own lockup at the top left, lands on it, and is swapped for
     it, so the mark reads as one object that moved rather than as two marks
     that took turns. Measured off the header element at runtime, so it lands
     at any viewport width. Delay is counted from the moment the wordmark has
     finished arriving, WORDMARK_AT_MS + WORDMARK_FADE_MS, so 0 means it leaves
     the middle as soon as it is fully there. */
  var WORDMARK_TRAVEL_MS       = 900;
  var WORDMARK_TRAVEL_DELAY_MS = null;  /* null tracks HOLD_MS, which is what
     gives the mark a real HOLD on the sphere's centre before it leaves. It was
     0 when the mark sat below the globe, where arriving and immediately leaving
     read fine; sitting AT the centre it is the shot, so it is held for exactly
     as long as the globe is held and the two cannot drift apart. Set a number
     to decouple them; 0 restores the old leaves-as-soon-as-it-arrives. */

  /* THE HERO'S OWN ENTRANCE. It rises as the globe DISPERSES rather than after
     it, so the two read as one handover. Start is counted from the layer going
     up; null means the moment the disperse begins, which is
     WORDMARK_AT_MS + WORDMARK_FADE_MS + HOLD_MS. Set a number to decouple it.
     The hero's opacity and its 16px lift are the ONLY things touched on the
     page itself, they are cleared again when the layer is removed, and the
     page's own background is never dimmed: see BG_CLEAR_MS. */
  var HERO_RISE_MS        = 900;
  var HERO_RISE_START_MS  = null;
  var HERO_RISE_PX        = 16;

  /* ============== THE DISPERSE. The globe becomes the background ==============

     The globe used to cross-fade to nothing. It now pushes its points OUTWARD
     from the sphere's projected centre along their radial vectors, slowing on an
     ease-out, thinning in size and alpha as they go, and a subset LANDS on the
     hero's own background constellation while the rest thin to nothing.

     The background is not CSS and is not guessable. It is node-field.js, which
     mounts a canvas inside [data-node-field] (the hero section), seeds 16 to 28
     nodes at RANDOM positions, and draws them gold. So the landing targets are
     read off the RUNNING MODULE at disperse time via window.VantageNodeField,
     and the target alpha, size and colour are read off that module's own
     painted canvas pixels rather than restated as constants here, because a
     constant restated in two files is the one that drifts. The two constants
     below named _FALLBACK_ are used only when the pixel read is refused.

     THREE CASES, and the code takes whichever it finds:

       1. FIELD SAMPLED. Landing targets are the live node positions, and target
          size, alpha and colour come from that field's own pixels. The intro's
          own canvas cross-fades out over the last DISPERSE_CROSSFADE_MS, by
          which point its landed points already sit on top of the real ones.
       2. FIELD PRESENT BUT PIXELS REFUSED. Positions AND sizes are still exact,
          since both come from the module's node objects rather than from a pixel
          read; only alpha and colour fall back to the _FALLBACK_ constants.
       3. NO FIELD AT ALL. Every point pushes out and thins to nothing, and no
          point lands anywhere. This is not a degraded path, it is the CORRECT
          match: node-field.js has its own MIN_VIEWPORT of 900px and draws
          NOTHING below it, and it also draws nothing under reduced motion. At
          375 wide the hero carries no constellation, so a target alpha of zero
          is what "match the background" means there.

     The arcs do not push. They hold their sphere geometry and fade out over
     DISPERSE_ARC_FADE_FRAC of the run, so the structure clears while the field
     is still travelling. */
  var DISPERSE_MS              = 1400;
  var DISPERSE_EASE_POW        = 3;    /* ease-out exponent: f = 1-(1-p)^POW.
                                          3 is a cubic ease-out, which spends
                                          most of the run decelerating, which is
                                          what makes the points read as settling
                                          rather than as being switched off */
  var DISPERSE_OVERSHOOT       = 1.05; /* peak fraction past the lerp, applied on
                                          a sine envelope that is zero at both
                                          ends, so a lander still arrives EXACTLY
                                          on its target and never near it */
  var DISPERSE_REACH_FRAC      = 0.62; /* how far a non-landing point travels
                                          outward, as a fraction of the viewport
                                          diagonal. Far enough to be off the
                                          face of the globe well before it is
                                          gone, so the field reads as opening
                                          rather than as evaporating in place */
  var DISPERSE_ARC_FADE_FRAC   = 0.45; /* share of DISPERSE_MS over which the
                                          arcs fade to nothing */
  var DISPERSE_CROSSFADE_MS    = 300;  /* the intro canvas's own last fade, over
                                          the real field already showing under
                                          it. Held to the END of the run on
                                          purpose: fade it earlier and the
                                          landing is invisible */
  var DISPERSE_FALLBACK_ALPHA  = 0.32; /* case 2 only. node-field's own NODE_ALPHA
                                          as shipped, restated ONLY as the
                                          fallback for a refused pixel read */
  var DISPERSE_FALLBACK_RGB    = '201, 168, 76';  /* case 2 only. --gold */
  /* there is deliberately no fallback SIZE. Position and radius both come off
     the module's own node objects, which are there in cases 1 and 2 alike; only
     alpha and colour need a pixel read, so only those two need a fallback. A
     third constant here would be a knob that nothing turns. */
  var DISPERSE_POINT_SHRINK    = 0.7;  /* how much of its radius a NON-landing
                                          point gives up on the way out, so it
                                          reads as receding as well as fading */

  /* ONE easing family for every transform in this file: the wordmark's arrival
     lift, its travel to the nav, and the hero's rise. */
  var TRAVEL_EASE         = 'cubic-bezier(.2,.7,.3,1)';

  /* WHERE THE INK SITS INSIDE THE HEADER LOCKUP, as fractions of that image's
     own box: left, top, width, height. The header mark is not text, it is
     vantage_lockup_dark.png, 1240x300 with a transparent margin, and its
     glyphs occupy x 134..1105 and y 82..217, measured by an alpha scan of the
     shipped file. Landing the travelling text's BOX on the image's BOX would
     therefore render the glyphs about 1.9 times too large and the swap would
     pop, so the travel matches INK to INK and these four numbers are what make
     that possible. Re-measure them if the lockup is ever re-cut. */
  var LOCKUP_INK_X        = 134 / 1240;
  var LOCKUP_INK_Y        = 82 / 300;
  var LOCKUP_INK_W        = 972 / 1240;
  var LOCKUP_INK_H        = 136 / 300;

  /* The header's own mark, and the hero block that rises. Both are read out of
     the page that is already there; nothing is created and no copy is retyped.
     If either selector misses, that half simply does not run. */
  var HEADER_MARK_SEL     = '.nav-logo img, .nav-logo a, .nav-logo';
  var HERO_BLOCK_SEL      = '.hero .hero-inner';
  var BG_CLEAR_MS         = 0;      /* how long the opaque navy ground takes to
                                       clear once the reveal begins. 0 means it
                                       is gone on the reveal's first frame, so
                                       the hero underneath reads at FULL
                                       contrast for the whole cross-fade and
                                       only the globe and the wordmark dissolve
                                       over it. This replaces a front-loaded
                                       fade curve on the ground, which was
                                       measured in real time at 0.538 opacity
                                       200ms into the reveal: a half-strength
                                       navy veil over the H1, the sub-copy, the
                                       button, the nav and the section below
                                       the fold, for most of a second.
                                       DISPERSE_MS is untouched; this governs
                                       only the ground, not the disperse */

  /* GLOBE. POINT_COUNT is the frame budget. 520 points cost six fill calls per
     frame rather than 520, because points are bucketed by depth and each bucket
     is drawn as one path; arc segments ride the same six buckets. That leaves a
     mid-range phone well inside 16ms, and the narrow count is a second margin
     on small screens, where the globe is half the size and the same count would
     read as mush rather than as a field. */
  var POINT_COUNT         = 520;
  var GLOBE_FADE_IN_FLOOR = 0.18;   /* minimum blend weight for the globe's
                                       own fade-in, so the very first painted
                                       frame already carries visible structure
                                       instead of opening on a=0, an all-alpha
                                       globe that reads as a blank navy
                                       rectangle. GLOBE_FADE_IN_MS itself is
                                       untouched; this only floors the curve */
  var POINT_COUNT_NARROW  = 240;
  var NARROW_PX           = 700;    /* viewport width that switches the count */
  var ARC_COUNT           = 8;      /* great-circle arcs across the sphere */
  var ARC_SEGMENTS        = 32;     /* straight pieces per arc */
  var ARC_LIFT            = 1.03;   /* arcs ride above the surface, not through */
  var ARC_FADE_FRAC       = 0.20;   /* share of each end that fades, so an arc
                                       dissolves instead of stopping dead */
  var DEPTH_BUCKETS       = 6;      /* depth steps, and the per-frame draw cost */
  var ROTATE_DEG_PER_SEC  = 9;
  var TILT_DEG            = 18;     /* fixed lean, so it is not a flat spin */
  var YAW_START_DEG       = 35;
  var CAMERA              = 2.6;    /* eye distance, in sphere radii */
  var GLOBE_RADIUS_FRAC   = 0.32;   /* of the shorter viewport side */
  var GLOBE_RADIUS_NARROW = 0.38;   /* the same, below NARROW_PX. A phone is
                                       tall and narrow, so the same fraction of
                                       the short side leaves the globe small */
  var GLOBE_CENTER_Y_FRAC = 0.42;   /* of viewport height */
  var GLOBE_SCALE_FROM    = 0.90;   /* it grows into place while fading in */
  var FRAME_RADIUS_FRAC   = 0.40;   /* globe radius inside the square still */
  var REF_RADIUS_PX       = 280;    /* the two sizes below are quoted at this */
  var POINT_R_FRONT       = 2.2;    /* px, nearest points */
  var POINT_R_BACK        = 0.9;    /* px, farthest points */
  var POINT_R_SCALE_EXP   = 0.5;    /* a half-size globe keeps about 70 percent
                                       of its dot size, so a phone reads points
                                       rather than a haze */
  var SEED                = 20260909;

  /* THE ONE GOLD ARC, placed rather than drawn from the random pool, so the
     accent crosses the face the viewer is looking at instead of landing
     wherever the seed put it. Latitude then longitude, in degrees; longitude
     -55 is dead centre at YAW_START_DEG. False for no gold at all. */
  var GOLD_ARC_ON         = true;
  var GOLD_ARC_FROM_DEG   = [-38, -115];
  var GOLD_ARC_TO_DEG     = [40, 5];

  /* COLOUR. A navy field, white points, gold used once. Both values are the
     shipped site tokens, --navy #0D1F3C and --gold #C9A84C. */
  var NAVY                = '#0D1F3C';
  var POINT_RGB           = '255, 255, 255';
  var GOLD_RGB            = '201, 168, 76';
  var POINT_ALPHA_FRONT   = 0.62;
  var POINT_ALPHA_BACK    = 0.07;
  var ARC_ALPHA_FRONT     = 0.22;
  var ARC_ALPHA_BACK      = 0.03;
  var GOLD_ALPHA_FRONT    = 0.72;
  var GOLD_ALPHA_BACK     = 0.07;
  var ARC_WIDTH           = 1;
  var GOLD_ARC_WIDTH      = 1.4;

  /* WORDMARK, the treatment the nav lockup already carries: Playfair Display,
     white with FP&A in gold, 0.02em tracking. Both faces are loaded by the page
     already, so nothing is fetched here. */
  var WORDMARK_SIZE_CSS   = 'clamp(26px, 5.2vw, 54px)';
  var WORDMARK_RISE_PX    = 10;     /* how far it lifts as it arrives */
  var WORDMARK_BOTTOM_CAP_PX = 640; /* hard floor for the wordmark's BOTTOM
                                       edge, in px from the viewport top, kept
                                       as a SAFETY FLOOR only. It mattered when
                                       the mark sat BELOW the globe, where the
                                       hero's gold capability tape at roughly
                                       y=650-695 was genuinely in reach. The
                                       mark is now centred ON the globe, whose
                                       own centre is GLOBE_CENTER_Y_FRAC of the
                                       viewport height, so the cap does not fire
                                       at either width this was measured at: at
                                       1440x900 the mark's bottom lands at 414
                                       and at 375x812 at 358, both far above
                                       640. It is left in because a very short
                                       viewport can still push the centre down,
                                       and because a centring that is exact at
                                       every width it was measured at is not a
                                       centring that is exact at every width */

  /* ============ WORDMARK MASK. Why the mark is readable at all ============

     The mark now sits on the sphere's own centre, over up to 520 white points
     and, by design, over the one gold arc, whose longitude was chosen to cross
     dead centre. Gold ink on a gold arc is a 1:1 contrast and white ink on a
     stack of white points is not much better, so the points behind the mark are
     dimmed inside a soft veil before the mark is painted over them.

     The veil is the page's own navy at MASK_STRENGTH, drawn as an ELLIPSE fitted
     to the mark's own ink box rather than as a circle, so it hugs a wide short
     wordmark instead of dimming the whole globe face to cover it. It is one fill
     call. It ramps up with the mark's arrival and ramps back down as the mark
     flies away, so nothing is veiled once nothing needs veiling, which also
     means the disperse never paints a navy blob over a hero that has appeared.

     MASK_STRENGTH is where the contrast lives, and it was solved rather than
     picked. Composited over the navy, the FP&A gold is the binding half at
     7.27:1 against the bare ground; a white point at effective alpha 0.16 over
     that ground already drops gold ink to 4.40:1. POINT_ALPHA_FRONT is 0.62, so
     the veil has to cut the front points to about 0.13 or below, which is
     1 - 0.13/0.62, or 0.79. 0.88 is set, and the number that matters is the
     measured one on the shipped artifact, not this derivation. */
  var MASK_STRENGTH       = 0.88;
  var MASK_PAD_X_PX       = 30;     /* added to the ink box's half-width */
  var MASK_PAD_Y_PX       = 20;     /* added to the ink box's half-height */
  var MASK_FEATHER        = 1.9;    /* outer edge as a multiple of the padded
                                       box, over which the veil falls to zero */
  var MASK_FADE_MS        = null;   /* null tracks WORDMARK_TRAVEL_MS, so the
                                       veil clears exactly as the mark leaves */
  var WORDMARK_FADE_EASE  = 'ease'; /* ONE curve for both halves of the lockup.
                                       Gold does sit lower against navy than
                                       white does (7.19:1 against 16.43:1, WCAG
                                       relative luminance), but that gap is in
                                       the endpoint, not in the ramp: composite
                                       each half over the navy at the same
                                       alpha, convert to CIE L*, and express it
                                       as a fraction of that half's own journey
                                       from ground to final colour, and the two
                                       curves never part by more than 2.00
                                       percentage points, gold trailing. The
                                       front-loaded curve this replaces put
                                       gold 47.9 points AHEAD of white at its
                                       worst, about 80ms into the arrival,
                                       which is the inversion it was meant to
                                       cure. Duration stays WORDMARK_FADE_MS */

  /* PLUMBING */
  var DPR_CAP             = 2;
  var LAYER_Z             = 400;    /* above nav (100) and the assistant (210) */
  var SESSION_KEY         = 'vfpa-hero-intro-v1';
  var FRAME_SRC           = 'hero-intro-frame.png';

  /* ======================= END TUNING ======================= */

  var DEG = Math.PI / 180;
  var geomCache = {};

  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }
  function seenThisSession() {
    /* private mode can throw on either call; then it simply plays */
    try { return window.sessionStorage.getItem(SESSION_KEY) === '1'; }
    catch (e) { return false; }
  }
  function rememberThisSession() {
    try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
  }

  /* ---------- the deterministic source of every point ---------- */
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randomDirection(rnd) {
    var y = 1 - 2 * rnd();
    var r = Math.sqrt(Math.max(0, 1 - y * y));
    var p = rnd() * 6.2831853;
    return [r * Math.cos(p), y, r * Math.sin(p)];
  }
  function latLonToVec(d) {
    var la = d[0] * DEG, lo = d[1] * DEG, r = Math.cos(la);
    return [r * Math.cos(lo), Math.sin(la), r * Math.sin(lo)];
  }
  function slerpArc(a, b) {
    var dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    var om = Math.acos(dot), so = Math.sin(om) || 1;
    var seg = new Float32Array((ARC_SEGMENTS + 1) * 3);
    for (var s = 0; s <= ARC_SEGMENTS; s++) {
      var f = s / ARC_SEGMENTS;
      var w1 = Math.sin((1 - f) * om) / so, w2 = Math.sin(f * om) / so;
      seg[s * 3] = (a[0] * w1 + b[0] * w2) * ARC_LIFT;
      seg[s * 3 + 1] = (a[1] * w1 + b[1] * w2) * ARC_LIFT;
      seg[s * 3 + 2] = (a[2] * w1 + b[2] * w2) * ARC_LIFT;
    }
    return seg;
  }

  /* Fibonacci sphere. Direction comes off the golden angle so the points spread
     evenly over every angle, and the angle is jittered because a clean lattice
     relaxes into a crystal, which reads as a pattern rather than a field.
     Radius is fixed at 1: this is a shell, not a ball. The even coordinate is
     Y, the axis the globe spins about, so the distribution sits still while the
     sphere turns instead of tumbling. */
  function buildGeometry(n) {
    if (geomCache[n]) return geomCache[n];
    var rnd = makeRng(SEED);
    var golden = Math.PI * (3 - Math.sqrt(5));
    var pts = new Float32Array(n * 3), i;
    for (i = 0; i < n; i++) {
      var u = (i + 0.5) / n;
      var ct = 1 - 2 * u;
      var st = Math.sqrt(Math.max(0, 1 - ct * ct));
      var phi = i * golden + (rnd() - 0.5) * 0.55;
      pts[i * 3] = st * Math.cos(phi);
      pts[i * 3 + 1] = ct;
      pts[i * 3 + 2] = st * Math.sin(phi);
    }
    /* arcs slerp between two seeded directions, rejecting pairs that sit too
       close or nearly antipodal, so every arc has a span worth drawing */
    var arcs = [];
    for (var k = 0; k < ARC_COUNT; k++) {
      var a = randomDirection(rnd), b, dot, tries = 0;
      do {
        b = randomDirection(rnd);
        dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        tries++;
      } while ((dot > 0.86 || dot < -0.35) && tries < 24);
      arcs.push(slerpArc(a, b));
    }
    var goldIndex = -1;
    if (GOLD_ARC_ON) {
      goldIndex = arcs.length;
      arcs.push(slerpArc(latLonToVec(GOLD_ARC_FROM_DEG), latLonToVec(GOLD_ARC_TO_DEG)));
    }
    geomCache[n] = { pts: pts, n: n, arcs: arcs, goldIndex: goldIndex };
    return geomCache[n];
  }

  /* ---------- projection and paint ----------
     Yaw about the vertical, then the fixed tilt, then a perspective divide.
     One number carries every depth cue: d is 1 at the front of the sphere and
     0 at the back, and it sets point size, point alpha and arc alpha together,
     which is what makes the far hemisphere recede instead of overlaying. */
  function drawGlobe(ctx, cx, cy, radius, tMs, appear, geom, state) {
    var yaw = (YAW_START_DEG + tMs / 1000 * ROTATE_DEG_PER_SEC) * DEG;
    var cyw = Math.cos(yaw), syw = Math.sin(yaw);
    var ctl = Math.cos(TILT_DEG * DEG), stl = Math.sin(TILT_DEG * DEG);
    var R = radius * (GLOBE_SCALE_FROM + (1 - GLOBE_SCALE_FROM) * appear);
    var rScale = Math.pow(R / REF_RADIUS_PX, POINT_R_SCALE_EXP);
    var P = geom.pts, n = geom.n, i, b;

    /* state is optional and absent on the still-frame path, which is why
       renderFrame's output, and therefore hero-intro-frame.png, is unchanged by
       everything below. mask veils the centre; disp pushes the field outward. */
    var mask = state && state.mask;
    var disp = state && state.disp;
    var f = disp ? disp.f : 0;             /* eased progress, 0 to 1 */
    var fo = disp ? disp.fo : 0;           /* the same, with the overshoot on */
    var gMul = disp ? disp.alphaMul : 1;   /* the whole layer's last cross-fade */

    var dots = [], lines = [], gold = [], landed = [];
    for (b = 0; b < DEPTH_BUCKETS; b++) { dots.push([]); lines.push([]); gold.push([]); }

    function bucketOf(z) {
      var q = ((1 - z) * 0.5 * DEPTH_BUCKETS) | 0;
      return q < 0 ? 0 : (q > DEPTH_BUCKETS - 1 ? DEPTH_BUCKETS - 1 : q);
    }

    /* PASS ONE, the projection, written once. x, y, radius and depth bucket per
       point into a reused scratch array, so the disperse below never needs a
       second copy of this arithmetic and the lander assignment can be made off
       real screen positions on the frame it is first needed. */
    var pj = scratch(n);
    for (i = 0; i < n; i++) {
      var x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      var x1 = x * cyw + z * syw, z1 = z * cyw - x * syw;
      var y1 = y * ctl - z1 * stl, z2 = y * stl + z1 * ctl;
      var k = CAMERA / (CAMERA + z2);
      var d = (1 - z2) * 0.5;
      var pr = (POINT_R_BACK + (POINT_R_FRONT - POINT_R_BACK) * d) * rScale * k;
      if (pr < 0.35) pr = 0.35;
      pj[i * 4] = cx + x1 * k * R;
      pj[i * 4 + 1] = cy - y1 * k * R;
      pj[i * 4 + 2] = pr;
      pj[i * 4 + 3] = bucketOf(z2);
    }

    /* PASS TWO. Either straight into the depth buckets, as before, or through
       the disperse. The lander assignment is built here, once, the first time a
       disperse frame runs, because this is the first point at which real screen
       positions exist. */
    if (disp && disp.targets && !disp.landMap) disp.landMap = assignLanders(pj, n, disp.targets, cx, cy);
    for (i = 0; i < n; i++) {
      var sx = pj[i * 4], sy = pj[i * 4 + 1], rr = pj[i * 4 + 2], bk = pj[i * 4 + 3] | 0;
      if (!disp) { dots[bk].push(sx, sy, rr); continue; }
      var slot = disp.landMap ? disp.landMap[i] : -1;
      if (slot >= 0) {
        /* A LANDER. It leaves the bucket and is drawn on its own, because its
           alpha, its size and its colour all diverge from the depth it started
           at. Its starting alpha is that bucket's own midpoint alpha, the exact
           value it was painting with the frame before, so the switch from
           bucketed to individual drawing is invisible at f=0. */
        var t0 = disp.targets[slot];
        var a0 = (POINT_ALPHA_BACK + (POINT_ALPHA_FRONT - POINT_ALPHA_BACK) *
                 ((bk + 0.5) / DEPTH_BUCKETS)) * appear;
        landed.push({
          x: sx + (t0.x - sx) * fo,
          y: sy + (t0.y - sy) * fo,
          r: rr + (t0.r - rr) * f,
          a: (a0 + (t0.a - a0) * f) * gMul,
          rgb: Math.round(255 + (t0.rgb[0] - 255) * f) + ',' +
               Math.round(255 + (t0.rgb[1] - 255) * f) + ',' +
               Math.round(255 + (t0.rgb[2] - 255) * f)
        });
        continue;
      }
      /* everything else pushes straight out along its own radial vector from
         the sphere's projected centre, shrinking, and its alpha is handled by
         the bucket multiplier below */
      var rx = sx - cx, ry = sy - cy;
      var rl = Math.sqrt(rx * rx + ry * ry) || 1;
      rr = rr * (1 - DISPERSE_POINT_SHRINK * f);
      if (rr < 0.35) rr = 0.35;
      dots[bk].push(sx + rx / rl * disp.reach * fo,
                    sy + ry / rl * disp.reach * fo, rr);
    }

    for (var ai = 0; ai < geom.arcs.length; ai++) {
      var seg = geom.arcs[ai], m = seg.length / 3;
      var into = (ai === geom.goldIndex) ? gold : lines;
      var lx = 0, ly = 0, lz = 0, first = true;
      for (var s = 0; s < m; s++) {
        var ax = seg[s * 3], ay = seg[s * 3 + 1], az = seg[s * 3 + 2];
        var bx1 = ax * cyw + az * syw, bz1 = az * cyw - ax * syw;
        var by1 = ay * ctl - bz1 * stl, bz2 = ay * stl + bz1 * ctl;
        var kk = CAMERA / (CAMERA + bz2);
        var sx = cx + bx1 * kk * R, sy = cy - by1 * kk * R;
        if (!first) {
          /* the end taper rides the same depth buckets: a tapered segment is
             treated as though it simply sat further back */
          var mid = (s - 0.5) / (m - 1);
          var e = (mid < 0.5 ? mid : 1 - mid) / ARC_FADE_FRAC;
          if (e > 1) e = 1;
          e = e * e * (3 - 2 * e);
          into[bucketOf(1 - (1 - (bz2 + lz) * 0.5) * e)].push(lx, ly, sx, sy);
        }
        lx = sx; ly = sy; lz = bz2; first = false;
      }
    }

    /* painted back bucket to front bucket, arcs then points inside each. The
       arcs hold their sphere geometry and simply fade; the points have already
       been moved above, and here they only lose their alpha. */
    var arcMul = (disp ? (1 - disp.arcFade) : 1) * gMul;
    var ptMul  = (disp ? (1 - f) : 1) * gMul;
    for (b = 0; b < DEPTH_BUCKETS; b++) {
      var bf = (b + 0.5) / DEPTH_BUCKETS;
      ctx.lineWidth = ARC_WIDTH;
      strokeBucket(ctx, lines[b], POINT_RGB,
        (ARC_ALPHA_BACK + (ARC_ALPHA_FRONT - ARC_ALPHA_BACK) * bf) * appear * arcMul);
      ctx.lineWidth = GOLD_ARC_WIDTH;
      strokeBucket(ctx, gold[b], GOLD_RGB,
        (GOLD_ALPHA_BACK + (GOLD_ALPHA_FRONT - GOLD_ALPHA_BACK) * bf) * appear * arcMul);
      fillBucket(ctx, dots[b], POINT_RGB,
        (POINT_ALPHA_BACK + (POINT_ALPHA_FRONT - POINT_ALPHA_BACK) * bf) * appear * ptMul);
    }
    /* the landers last, over the top, one fill each. There are at most as many
       of these as the background field has nodes, which node-field caps at 28. */
    for (i = 0; i < landed.length; i++) {
      var L = landed[i];
      if (L.a < 0.004 || L.r <= 0) continue;
      ctx.fillStyle = 'rgba(' + L.rgb + ',' + L.a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(L.x, L.y, L.r, 0, 6.2832);
      ctx.fill();
    }
    if (mask && mask.strength > 0.004) paintMask(ctx, cx, cy, mask);
  }

  /* THE VEIL. The page's own navy, at mask.strength in the middle and zero at
     the feathered edge, drawn as an ellipse fitted to the mark's ink box. The
     scale trick is what makes it elliptical: one radial gradient in a space
     stretched horizontally by halfW/halfH, so a wide short wordmark gets a wide
     short veil instead of a circle big enough to contain it. */
  function paintMask(ctx, cx, cy, mask) {
    var hw = mask.halfW, hh = mask.halfH;
    if (!(hw > 0 && hh > 0)) return;
    var sx = hw / hh;
    var outer = hh * MASK_FEATHER;
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, outer);
    var a = MASK_STRENGTH * mask.strength;
    g.addColorStop(0, navyRgba(a));
    g.addColorStop(1 / MASK_FEATHER, navyRgba(a));
    g.addColorStop(1, navyRgba(0));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, 1);
    ctx.fillStyle = g;
    ctx.fillRect(-outer, -outer, outer * 2, outer * 2);
    ctx.restore();
  }

  /* NAVY is the shipped token as a hex string, and the veil needs it with an
     alpha, so it is parsed once rather than restated as a second constant. */
  var NAVY_RGB = (function () {
    var h = NAVY.replace('#', '');
    return parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) +
      ',' + parseInt(h.substr(4, 2), 16);
  })();
  function navyRgba(a) { return 'rgba(' + NAVY_RGB + ',' + a.toFixed(4) + ')'; }

  /* one scratch buffer per point count, reused every frame, so the projection
     pass allocates nothing after the first frame */
  var scratchCache = {};
  function scratch(n) {
    if (!scratchCache[n]) scratchCache[n] = new Float32Array(n * 4);
    return scratchCache[n];
  }

  function parseRgb(s) {
    var p = String(s).split(',');
    return [parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0, parseInt(p[2], 10) || 0];
  }

  /* WHICH POINTS LAND, AND ON WHAT. There are 520 points and at most 28
     targets, so the great majority of the field is always leaving; this only
     decides who stays. Both lists are sorted by angle about the sphere's centre
     and matched in that order, which is what keeps the flight paths from
     crossing each other and reading as a shuffle. Within that, the candidate
     pool is the points nearest the sphere's rim, because a point already on its
     way outward is the natural one to keep going.
     Returns an Int16Array of length n: the target slot, or -1. */
  function assignLanders(pj, n, targets, cx, cy) {
    var map = new Int16Array(n), i;
    for (i = 0; i < n; i++) map[i] = -1;
    var m = targets.length;
    if (!m) return map;
    var order = [];
    for (i = 0; i < n; i++) {
      var dx = pj[i * 4] - cx, dy = pj[i * 4 + 1] - cy;
      order.push({ i: i, d: dx * dx + dy * dy, ang: Math.atan2(dy, dx) });
    }
    order.sort(function (a, b) { return b.d - a.d; });
    var pool = order.slice(0, Math.min(n, m * 3));
    pool.sort(function (a, b) { return a.ang - b.ang; });
    var slots = [];
    for (i = 0; i < m; i++) {
      slots.push({ s: i, ang: Math.atan2(targets[i].y - cy, targets[i].x - cx) });
    }
    slots.sort(function (a, b) { return a.ang - b.ang; });
    /* the pool is three times the slot count, so step through it evenly rather
       than taking the first m, which would bunch every lander on one side */
    var step = pool.length / m;
    for (i = 0; i < m; i++) map[pool[Math.floor(i * step)].i] = slots[i].s;
    return map;
  }

  /* THE BACKGROUND, READ RATHER THAN ASSUMED. node-field.js exposes its live
     fields on window.VantageNodeField, so the landing positions come off the
     running module and are exact. Size, alpha and colour come off that module's
     OWN PAINTED PIXELS, which is a measurement of the shipped background rather
     than a second copy of its constants sitting in this file.

     Returns null when there is nothing to land on, which is the honest answer
     below node-field's 900px MIN_VIEWPORT and under reduced motion, where it
     draws no constellation at all. Never throws: this is decorative. */
  function sampleBackgroundField() {
    try {
      var nf = window.VantageNodeField;
      if (!nf || !nf.fields || !nf.fields.length) return null;
      var fld = null;
      for (var q = 0; q < nf.fields.length; q++) {
        var c = nf.fields[q];
        if (c && c.seeded && c.nodes && c.nodes.length && c.canvas &&
            c.canvas.width > 0 && c.w > 0 && c.h > 0) { fld = c; break; }
      }
      if (!fld) return null;
      var hr = fld.canvas.getBoundingClientRect();
      if (!(hr.width > 1 && hr.height > 1)) return null;
      var kx = hr.width / fld.w, ky = hr.height / fld.h;
      var dpr = fld.canvas.width / fld.w;
      var px = null;
      try { px = fld.canvas.getContext('2d'); } catch (e) { px = null; }
      var fb = parseRgb(DISPERSE_FALLBACK_RGB);
      var out = [], measured = 0;
      for (var i = 0; i < fld.nodes.length; i++) {
        var nd = fld.nodes[i];
        var t = {
          node: nd,          /* kept, so the target can TRACK it. See below. */
          x: hr.left + nd.x * kx,
          y: hr.top + nd.y * ky,
          r: nd.r,
          a: DISPERSE_FALLBACK_ALPHA,
          rgb: [fb[0], fb[1], fb[2]]
        };
        if (px) {
          try {
            var d = px.getImageData(Math.round(nd.x * dpr), Math.round(nd.y * dpr), 1, 1).data;
            /* getImageData is unpremultiplied, so d[0..2] is the node's own
               colour and d[3] its own alpha over the hero's navy */
            if (d[3] > 0) { t.a = d[3] / 255; t.rgb = [d[0], d[1], d[2]]; measured++; }
          } catch (e) { px = null; }
        }
        out.push(t);
      }
      if (!out.length) return null;
      /* the frame of reference is kept alongside the targets so they can be
         refreshed every frame. See refreshTargets. */
      return { targets: out, measured: measured,
               ref: { left: hr.left, top: hr.top, kx: kx, ky: ky } };
    } catch (e) { return null; }
  }

  /* THE TARGETS MOVE, AND THIS IS NOT A DETAIL. node-field's nodes drift at 4 to
     9 px per second and the disperse runs for 1400ms, so a target sampled once at
     the top of the run is 6 to 13px away from the dot it was sampled from by the
     time a point arrives on it. That lands our copy NEXT TO the real dot instead
     of on it, which is two dots rather than one continuous field, and it is
     exactly the failure Nic described wanting gone. So the positions are
     refreshed off the live node objects every frame; only the size, alpha and
     colour stay as measured, since those do not drift. */
  function refreshTargets(disp) {
    var t = disp.targets, ref = disp.ref, i, nd;
    if (!t || !ref) return;
    for (i = 0; i < t.length; i++) {
      nd = t[i].node;
      if (!nd) continue;
      t[i].x = ref.left + nd.x * ref.kx;
      t[i].y = ref.top + nd.y * ref.ky;
    }
  }

  function strokeBucket(ctx, flat, rgb, alpha) {
    if (!flat.length || alpha < 0.004) return;
    ctx.strokeStyle = 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')';
    ctx.beginPath();
    for (var i = 0; i < flat.length; i += 4) {
      ctx.moveTo(flat[i], flat[i + 1]);
      ctx.lineTo(flat[i + 2], flat[i + 3]);
    }
    ctx.stroke();
  }

  function fillBucket(ctx, flat, rgb, alpha) {
    if (!flat.length || alpha < 0.004) return;
    ctx.fillStyle = 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')';
    ctx.beginPath();
    for (var i = 0; i < flat.length; i += 3) {
      ctx.moveTo(flat[i] + flat[i + 2], flat[i + 1]);
      ctx.arc(flat[i], flat[i + 1], flat[i + 2], 0, 6.2832);
    }
    ctx.fill();
  }

  /* ---------- the layer ---------- */
  var api = { skip: function () {}, renderFrame: renderFrame, state: function () { return null; } };

  function renderFrame(canvas, tMs) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var side = Math.min(canvas.width, canvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGlobe(ctx, canvas.width / 2, canvas.height / 2, side * FRAME_RADIUS_FRAC,
      tMs || 0, 1, buildGeometry(POINT_COUNT));
    return canvas;
  }

  function start() {
    /* pointer-events none is the whole point: the layer never blocks anything */
    var layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    var ls = layer.style;
    ls.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;overflow:hidden;' +
      'pointer-events:none;z-index:' + LAYER_Z;

    /* the opaque navy ground is its own element, behind everything else in
       the layer, so its alpha can fade on its own curve at fade-out (see
       finish() below) instead of being flattened together with the globe
       and wordmark under one shrinking parent opacity, which is what let the
       page underneath read as dimmed through the transition's midpoint. */
    var bg = document.createElement('div');
    bg.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;' +
      'background:' + NAVY + ';opacity:1';

    var mark = document.createElement('div');
    var ms = mark.style;
    ms.cssText = "position:absolute;left:0;right:0;text-align:center;" +
      "font-family:'Playfair Display',Georgia,serif;font-weight:400;line-height:1.15;" +
      'letter-spacing:0.02em;font-size:' + WORDMARK_SIZE_CSS +
      ';color:rgb(' + POINT_RGB + ')';
    /* One inline-block holds both halves, and it is the thing that travels.
       Its own box is the text's advance box rather than the full-width centered
       line, so a getBoundingClientRect on it is the mark's own geometry, which
       is what the flight to the header has to be computed against. Centering is
       still the parent's text-align, so the arrival looks exactly as before. */
    var inner = document.createElement('span');
    inner.style.cssText = 'display:inline-block;white-space:nowrap';

    /* "Vantage" and "FP&A" fade in on their own spans, each with its own
       opacity, because the mark's own opacity is what the cross-fade uses at
       the end. Both spans ride the same WORDMARK_FADE_EASE, so the two halves
       arrive as one lockup; see that constant for the measurement. */
    var vSpan = document.createElement('span');
    vSpan.style.opacity = '0';
    vSpan.appendChild(document.createTextNode('Vantage '));
    inner.appendChild(vSpan);
    var fp = document.createElement('span');
    fp.style.color = 'rgb(' + GOLD_RGB + ')';
    fp.style.opacity = '0';
    fp.appendChild(document.createTextNode('FP&A'));
    inner.appendChild(fp);
    mark.appendChild(inner);

    /* how far the mark is currently translated down by its arrival lift. The
       centring correction measures the mark's real ink box off
       getBoundingClientRect, which includes that transform, so the amount has
       to be known rather than assumed. 0 on the still path, where the transform
       is never set at all. */
    var markLift = 0;
    /* the horizontal correction, in px, and the one place the mark's transform is
       written. text-align centres the mark's ADVANCE box, but the face's left and
       right side bearings are not equal, so the ink inside that box sits about
       1.9 percent of its own width to the left of the box's centre: 6.5px at 1440
       and 3.3px at 375, both measured. Centring on the sphere means centring the
       INK, so the difference is taken out here. */
    var markDx = 0;
    function setMarkTransform() {
      ms.transform = 'translate(' + markDx.toFixed(2) + 'px,' + markLift + 'px)';
    }

    var still = reduced();
    var canvas = null, ctx = null, img = null;
    if (!still) {
      canvas = document.createElement('canvas');
      try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
      if (!ctx) { canvas = null; still = true; }
    }
    if (still) {
      img = document.createElement('img');
      img.src = FRAME_SRC;
      img.alt = '';
      img.style.cssText = 'position:absolute;display:block';
      vSpan.style.opacity = '1';
      fp.style.opacity = '1';
    } else {
      canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block';
      markLift = WORDMARK_RISE_PX;
      setMarkTransform();
      /* the transform is written by setMarkTransform below, and the TRANSITION is
         armed inside the arrival timer rather than here. Arming it here made
         every centring correction, including the one that re-runs when the face
         finishes loading, a 700ms slide; the mark is invisible at that point so
         nothing showed, but a transition that fires when a value is corrected
         rather than when it is animated is a trap left for the next change. */
    }

    /* THE STILL PATH'S VEIL. On the animated path the veil is one gradient fill
       inside the canvas, but the still path shows a PNG, so it gets the same
       ellipse as a DOM element between the image and the mark. Without it the
       reduced-motion visitor reads white and gold type straight over the still's
       own points, which is the one case where the mark is not moving and so is
       looked at for longest. Same MASK_STRENGTH, same feather, same geometry. */
    var veil = null;
    if (still) {
      veil = document.createElement('div');
      veil.setAttribute('aria-hidden', 'true');
      veil.style.cssText = 'position:absolute;pointer-events:none';
    }

    /* the page's own two pieces, read once. Either may be missing, in which
       case that half of the choreography does not run and nothing else changes.
       On the still path both are left exactly as the HTML ships them. */
    var headerMark = still ? null : document.querySelector(HEADER_MARK_SEL);
    var heroBlock  = still ? null : document.querySelector(HERO_BLOCK_SEL);
    var heroPrimed = false, heroRisen = false;
    if (heroBlock) {
      heroBlock.style.opacity = '0';
      heroBlock.style.transform = 'translateY(' + HERO_RISE_PX + 'px)';
      heroBlock.style.willChange = 'opacity, transform';
      heroPrimed = true;
    }

    layer.appendChild(bg);
    layer.appendChild(still ? img : canvas);
    if (veil) layer.appendChild(veil);
    layer.appendChild(mark);
    document.body.appendChild(layer);

    var cx = 0, cy = 0, R = 0, vw = 0, vh = 0;
    var travelStarted = false, travelLanded = false, travelEndAt = 0, travelStartedAt = 0;
    /* the mask's own geometry, half-extents of the mark's padded ink box, and
       the reveal's own state. markMask stays null until the mark has been
       measured, and a null mask simply means nothing is veiled. */
    var markMask = null;
    var revealAt = 0, disp = null, dispCase = 0, dispMeasured = 0;
    var maskState = { halfW: 0, halfH: 0, strength: 0 };
    var drawState = { mask: null, disp: null };
    function layout() {
      vw = layer.clientWidth || window.innerWidth;
      vh = layer.clientHeight || window.innerHeight;
      R = Math.min(vw, vh) *
        (vw < NARROW_PX ? GLOBE_RADIUS_NARROW : GLOBE_RADIUS_FRAC);
      cx = vw / 2;
      cy = vh * GLOBE_CENTER_Y_FRAC;
      /* THE MARK SITS ON THE SPHERE'S OWN CENTRE. cx and cy are the globe's
         projected centre, computed six lines above off the canvas geometry, and
         cy is GLOBE_CENTER_Y_FRAC of the height rather than half of it, so this
         is emphatically NOT the viewport centre. Horizontally there is nothing
         to do: the mark is centred by its parent's text-align and cx is vw/2 by
         construction, so the two agree without a second calculation and stay
         agreed at every width.
         This first placement is off the type's em box, which is taller than the
         ink by the face's internal leading; centerMarkOnGlobe() then corrects it
         against the real ink box, which is what makes the centring exact rather
         than close. The bottom cap survives as a safety floor only and does not
         fire at either width this was measured at. */
      var inkH = vSpan.getBoundingClientRect().height || mark.offsetHeight;
      var markTop = cy - inkH / 2;
      var maxTop = WORDMARK_BOTTOM_CAP_PX - inkH - WORDMARK_RISE_PX;
      if (markTop > maxTop) markTop = maxTop;
      /* once the mark has left the middle its position is the flight's, not
         this function's. A viewport resized mid-flight lands the mark off its
         target; the header's own mark takes over a few hundred ms later either
         way, so the flight is not recomputed for a resize that will have
         finished before it matters. */
      if (!travelStarted) ms.top = markTop.toFixed(2) + 'px';
      if (img) {
        /* the still holds its globe at FRAME_RADIUS_FRAC of a square, so this
           is the square size that lands the same radius in the same place */
        var sd = Math.round(R / FRAME_RADIUS_FRAC);
        img.style.width = img.style.height = sd + 'px';
        img.style.left = Math.round(cx - sd / 2) + 'px';
        img.style.top = Math.round(cy - sd / 2) + 'px';
      }
      if (ctx) {
        var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        canvas.width = Math.round(vw * dpr);
        canvas.height = Math.round(vh * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (!travelStarted) centerMarkOnGlobe();
    }

    /* THE EXACT CORRECTION, and the mask's geometry, in one place because both
       come off the same measurement. markInk() returns the mark's real ink box,
       ascent to descent from canvas text metrics plus a baseline strut, which is
       the box a reader actually sees; the em box layout() used is taller than it
       by the face's internal leading, and centring the taller box leaves the ink
       sitting high. The lift is subtracted because the mark is translated down
       by WORDMARK_RISE_PX for the whole of its arrival and the rect reflects
       that. A silent no-op when the metrics are unavailable, and then the em-box
       placement stands, which is close rather than exact. */
    function centerMarkOnGlobe() {
      var ink = markInk();
      var halfW, halfH;
      if (ink && ink.height > 1) {
        var cur = parseFloat(ms.top) || 0;
        var next = cur + (cy - (ink.top - markLift + ink.height / 2));
        var cap = WORDMARK_BOTTOM_CAP_PX - ink.height - WORDMARK_RISE_PX;
        if (next > cap) next = cap;
        ms.top = next.toFixed(2) + 'px';
        /* and the same correction horizontally, off the INK width rather than
           the advance width. markDx is cumulative for the same reason ms.top is:
           the measurement is taken with the current offset already applied. */
        if (ink.inkWidth > 1) {
          markDx = markDx + (cx - (ink.left + ink.inkWidth / 2));
          setMarkTransform();
        }
        halfW = ink.box.width / 2 + MASK_PAD_X_PX;
        halfH = ink.height / 2 + MASK_PAD_Y_PX;
      } else {
        /* no text metrics: the veil still has to exist, so it is sized off the
           inline box, which is wider and taller than the ink and therefore
           errs toward covering more rather than less */
        var r = inner.getBoundingClientRect();
        if (!(r.width > 1)) return;
        halfW = r.width / 2 + MASK_PAD_X_PX;
        halfH = (r.height || 24) / 2 + MASK_PAD_Y_PX;
      }
      markMask = { halfW: halfW, halfH: halfH };
      if (veil) {
        var ow = halfW * MASK_FEATHER, oh = halfH * MASK_FEATHER;
        veil.style.left = (cx - ow).toFixed(1) + 'px';
        veil.style.top = (cy - oh).toFixed(1) + 'px';
        veil.style.width = (ow * 2).toFixed(1) + 'px';
        veil.style.height = (oh * 2).toFixed(1) + 'px';
        veil.style.background = 'radial-gradient(closest-side ellipse,' +
          navyRgba(MASK_STRENGTH) + ' 0%,' + navyRgba(MASK_STRENGTH) + ' ' +
          (100 / MASK_FEATHER).toFixed(1) + '%,' + navyRgba(0) + ' 100%)';
      }
    }
    layout();
    /* the bottom cap is measured off the loaded face's em box, and the layer
       goes up in the parser's own task, which can be before Playfair has
       arrived. Re-run once the faces settle so the cap is computed on the
       metrics that actually render. */
    try {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { if (!done) layout(); });
      }
    } catch (e) {}

    var geom = buildGeometry(
      window.innerWidth < NARROW_PX ? POINT_COUNT_NARROW : POINT_COUNT);
    /* the clock starts when the layer goes up, not on the first frame, so a
       first frame delayed by a slow load lands where the wordmark and fade-out
       timers already are instead of restarting the globe underneath them */
    var t0 = performance.now(), rafId = 0, done = false, timers = [];

    function frame() {
      if (done) return;
      rafId = window.requestAnimationFrame(frame);
      var now = performance.now();
      var e = now - t0;
      var a = e / GLOBE_FADE_IN_MS;
      if (a > 1) a = 1;
      a = a * a * (3 - 2 * a);
      /* every alpha in drawGlobe scales by "appear", so the true first frame
         (a=0) painted nothing but the navy ground, indistinguishable from a
         page that failed to load. Floor it so frame one already carries
         visible structure; GLOBE_FADE_IN_MS itself is untouched. */
      if (a < GLOBE_FADE_IN_FLOOR) a = GLOBE_FADE_IN_FLOOR;

      /* THE VEIL'S OWN CURVE. Up with the mark's arrival, down as it flies away,
         so nothing is dimmed once nothing needs dimming. That second half also
         guarantees the disperse never paints a navy ellipse over a hero that
         has already appeared, since the mark has left by then. */
      var mk = (e - WORDMARK_AT_MS) / WORDMARK_FADE_MS;
      if (mk < 0) mk = 0; else if (mk > 1) mk = 1;
      if (travelStarted) {
        var fadeMs = (MASK_FADE_MS === null ? WORDMARK_TRAVEL_MS : MASK_FADE_MS) || 1;
        var out = (now - travelStartedAt) / fadeMs;
        if (out < 0) out = 0; else if (out > 1) out = 1;
        mk = mk * (1 - out);
      }
      if (markMask && mk > 0) {
        maskState.halfW = markMask.halfW;
        maskState.halfH = markMask.halfH;
        maskState.strength = mk * mk * (3 - 2 * mk);
        drawState.mask = maskState;
      } else {
        drawState.mask = null;
      }

      /* THE DISPERSE'S OWN CURVE. p is linear time, f is the ease-out the points
         travel on, fo carries the overshoot on an envelope that is zero at both
         ends so a lander still arrives exactly on its target. alphaMul is the
         layer's last cross-fade and is held back to the final
         DISPERSE_CROSSFADE_MS, because a canvas that starts fading at the top of
         the run hides the landing it exists to show. */
      if (disp) {
        /* the targets are re-read off the live nodes first, so a lander is aimed
           at where its dot IS rather than where it was at the top of the run */
        if (disp.ref) refreshTargets(disp);
        var el = now - revealAt;
        var p = el / DISPERSE_MS;
        if (p < 0) p = 0; else if (p > 1) p = 1;
        disp.f = 1 - Math.pow(1 - p, DISPERSE_EASE_POW);
        disp.fo = disp.f * (1 + (DISPERSE_OVERSHOOT - 1) * Math.sin(Math.PI * p));
        var af = p / (DISPERSE_ARC_FADE_FRAC || 1);
        disp.arcFade = af > 1 ? 1 : af;
        var cf = (DISPERSE_MS - el) / DISPERSE_CROSSFADE_MS;
        disp.alphaMul = cf >= 1 ? 1 : (cf <= 0 ? 0 : cf);
        drawState.disp = disp;
      }

      ctx.clearRect(0, 0, vw, vh);
      drawGlobe(ctx, cx, cy, R, e, a, geom, drawState);
    }

    /* ---------- the two pieces of page choreography ----------
       Both are written so that calling them twice, or calling the restore
       without ever having called the set, is a no-op. */

    function hideHeaderMark() {
      if (!headerMark) return;
      /* visibility, never display: the nav's layout must not move under the
         mark that is flying toward where it currently is */
      headerMark.style.visibility = 'hidden';
    }
    function showHeaderMark() {
      if (!headerMark) return;
      headerMark.style.visibility = '';
    }
    function releaseHero() {
      if (!heroPrimed) return;
      heroPrimed = false;
      heroBlock.style.transition = '';
      heroBlock.style.opacity = '';
      heroBlock.style.transform = '';
      heroBlock.style.willChange = '';
    }
    function heroRise() {
      if (!heroPrimed || heroRisen) return;
      heroRisen = true;
      heroBlock.style.transition = 'opacity ' + HERO_RISE_MS + 'ms ease, ' +
        'transform ' + HERO_RISE_MS + 'ms ' + TRAVEL_EASE;
      heroBlock.style.opacity = '1';
      heroBlock.style.transform = 'translateY(0)';
    }

    /* ---------- the flight to the header lockup ----------
       INK to INK, not box to box. The header mark is a padded PNG, so its box
       is roughly twice the height of the glyphs inside it; see LOCKUP_INK_*.
       The mark's own ink comes from canvas text metrics, which give the ink
       box relative to the text origin, plus a zero-size inline-block strut
       whose bottom edge sits exactly on the baseline. Returns false when
       anything it needs is missing, and the caller then falls back to the
       cross-fade this used to do. */
    function markInk() {
      var cs, probe, m, strut, baseline, r;
      try {
        cs = window.getComputedStyle(mark);
        probe = document.createElement('canvas').getContext('2d');
        if (!probe) return null;
        probe.font = (cs.fontWeight || '400') + ' ' + cs.fontSize + ' ' +
          (cs.fontFamily || "'Playfair Display',Georgia,serif");
        m = probe.measureText('Vantage FP&A');
        if (!m || typeof m.actualBoundingBoxAscent !== 'number') return null;
        if (!(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent > 0)) return null;
        strut = document.createElement('span');
        strut.style.cssText = 'display:inline-block;width:0;height:0;overflow:hidden';
        inner.appendChild(strut);
        baseline = strut.getBoundingClientRect().bottom;
        inner.removeChild(strut);
        r = inner.getBoundingClientRect();
        if (!(r.width > 1 && r.height > 1)) return null;
        return {
          box: r,
          left: r.left - m.actualBoundingBoxLeft,
          top: baseline - m.actualBoundingBoxAscent,
          height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
          /* the INK width, which is not r.width: r is the advance box, and the
             face's left and right side bearings differ, so mixing the two makes
             a centred mark look about a pixel off when it is not. The travel
             math below uses left, top and height only; this is here so a
             measurement of the centring compares ink to ink. */
          inkWidth: m.actualBoundingBoxLeft + m.actualBoundingBoxRight
        };
      } catch (e) { return null; }
    }

    function headerInk() {
      if (!headerMark) return null;
      /* an <img> has no box until it has decoded, and a zero box would send the
         mark to the top left corner of the window */
      if (headerMark.tagName === 'IMG' &&
          !(headerMark.complete && headerMark.naturalWidth > 0)) return null;
      var r = headerMark.getBoundingClientRect();
      if (!(r.width > 8 && r.height > 8)) return null;
      return {
        left: r.left + LOCKUP_INK_X * r.width,
        top: r.top + LOCKUP_INK_Y * r.height,
        width: LOCKUP_INK_W * r.width,
        height: LOCKUP_INK_H * r.height
      };
    }

    function travel() {
      if (done || travelStarted) return false;
      var src = markInk(), dst = headerInk();
      if (!src || !dst) return false;
      var s = dst.height / src.height;
      if (!(s > 0.02 && s < 4)) return false;
      var ox = src.box.left, oy = src.box.top;
      var dx = dst.left - (ox + s * (src.left - ox));
      var dy = dst.top - (oy + s * (src.top - oy));
      travelStarted = true;
      travelStartedAt = performance.now();
      travelEndAt = travelStartedAt + WORDMARK_TRAVEL_MS;
      hideHeaderMark();
      inner.style.transformOrigin = '0 0';
      inner.style.willChange = 'transform';
      inner.style.transition = 'transform ' + WORDMARK_TRAVEL_MS + 'ms ' + TRAVEL_EASE;
      /* translate then scale, read right to left: a point p maps to
         origin + (dx,dy) + s * (p - origin), which is the arithmetic dx and dy
         were solved against */
      inner.style.transform = 'translate(' + dx.toFixed(3) + 'px,' +
        dy.toFixed(3) + 'px) scale(' + s.toFixed(6) + ')';
      timers.push(window.setTimeout(land, WORDMARK_TRAVEL_MS));
      return true;
    }

    /* the swap. The header's own mark comes back first and the intro copy goes
       in the same task, so no frame paints with two marks or with none. */
    function land() {
      if (travelLanded) return;
      travelLanded = true;
      showHeaderMark();
      ms.transition = '';
      ms.opacity = '0';
    }

    function remove() {
      showHeaderMark();
      releaseHero();
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }

    /* ---------- THE REVEAL: the field opens, the hero rises ----------
       This is what used to be finish(FADE_OUT_MS, true), and the difference is
       the whole point of the change. The globe is not cross-faded away. The navy
       ground clears at once, the hero rises under it, and the field pushes
       outward for DISPERSE_MS while a subset of its points lands on the hero's
       own constellation. The raf loop keeps running throughout, which is why the
       teardown is a separate timer rather than this function's last act. */
    function beginReveal() {
      if (done || revealAt) return;
      revealAt = performance.now();
      try {
        /* the opaque navy ground goes first and, at BG_CLEAR_MS of 0, goes at
           once, so from here the hero, the nav and everything below the fold are
           at FULL contrast for the whole disperse and only the field is still
           moving over them. The layer itself is never given an opacity. */
        if (BG_CLEAR_MS > 0) bg.style.transition = 'opacity ' + BG_CLEAR_MS + 'ms linear';
        bg.style.opacity = '0';
      } catch (e) {}
      if (HERO_RISE_START_MS === null) heroRise();
      /* Read the hero's own constellation NOW rather than at load. node-field
         seeds at random and its nodes drift every frame, so where they are is
         only knowable at this instant. A null is case 3 in the DISPERSE block:
         no field to land on, every point thins to nothing, which is the correct
         match below node-field's own 900px floor. */
      var bgField = sampleBackgroundField();
      dispCase = bgField ? (bgField.measured ? 1 : 2) : 3;
      dispMeasured = bgField ? bgField.measured : 0;
      disp = {
        f: 0, fo: 0, arcFade: 0, alphaMul: 1,
        reach: Math.sqrt(vw * vw + vh * vh) * DISPERSE_REACH_FRAC,
        targets: bgField ? bgField.targets : null,
        ref: bgField ? bgField.ref : null,
        landMap: null
      };
      /* the teardown is set here, off the same clock the disperse runs on, and
         it is the only thing that ends the natural path */
      timers.push(window.setTimeout(function () { finish(0, true); },
        DISPERSE_MS + TEARDOWN_TAIL_MS));
    }

    function finish(fadeMs, natural) {
      if (done) return;
      done = true;
      for (var i = 0; i < timers.length; i++) window.clearTimeout(timers[i]);
      if (rafId) window.cancelAnimationFrame(rafId);
      unbind();
      /* the hero's entrance is the first thing decided, because it is the thing
         the visitor is being handed. On the natural path beginReveal() has
         already risen it, and heroRise is idempotent; a skip has it simply
         there. */
      if (natural && HERO_RISE_START_MS === null) heroRise();
      /* the disperse begins BEFORE the mark has finished flying, by design, and
         the loop above has just cleared the timer that was going to swap it.
         Re-arm it off the wall clock, outside timers, so the swap still happens
         at the instant the flight ends. */
      if (natural && travelStarted && !travelLanded) {
        window.setTimeout(land, Math.max(0, travelEndAt - performance.now()));
      }
      if (!natural) {
        /* straight to the end state: the header's own mark back, the intro copy
           gone, the hero visible, and then the layer */
        travelLanded = true;
        showHeaderMark();
        ms.transition = '';
        ms.opacity = '0';
        releaseHero();
      }
      if (fadeMs > 0) {
        /* THE REMOVAL TIMER IS SET BEFORE ANY STYLE IS WRITTEN, and every style
           write below sits inside a catch. A bad style write here once threw
           before the timer had been set, which left the wordmark at full
           opacity and the whole layer in the DOM for the rest of the session.
           Ordering it this way means the teardown no longer depends on the
           paint code above it succeeding. */
        window.setTimeout(remove, fadeMs + TEARDOWN_TAIL_MS);
        try {
          /* the opaque navy ground goes first and, at BG_CLEAR_MS of 0, goes at
             once, so nothing is left veiling the page: from here the hero, the
             nav and everything below the fold are at full contrast and only the
             globe and the wordmark dissolve over them. ls itself is never given
             an opacity: what disappears is each piece of the overlay's own
             content, not a single flattened group blended against the page. */
          if (BG_CLEAR_MS > 0) {
            bg.style.transition = 'opacity ' + BG_CLEAR_MS + 'ms linear';
          }
          bg.style.opacity = '0';
          if (veil) {
            veil.style.transition = 'opacity ' + fadeMs + 'ms ease';
            veil.style.opacity = '0';
          }
          var content = still ? img : canvas;
          content.style.transition = 'opacity ' + fadeMs + 'ms ease';
          content.style.opacity = '0';
          /* the wordmark is only cross-faded when it never flew. Once it is in
             flight it belongs to land(), which hides it the instant the header's
             own mark comes back, so fading it here would dissolve the object
             that is meant to arrive. ms IS mark.style, so these are
             ms.transition and ms.opacity; ms.style.* is the throw described
             above. */
          if (!travelStarted) {
            ms.transition = 'opacity ' + fadeMs + 'ms ease';
            ms.opacity = '0';
          }
        } catch (e) {}
      } else {
        remove();
      }
    }

    var EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'wheel'];
    /* a click, a tap, a key or a scroll goes straight to the end state: header
       mark in place, intro copy gone, hero visible, layer removed */
    function onInterrupt() { finish(SKIP_FADE_MS, false); }
    function onResize() { if (!done) layout(); }
    function unbind() {
      for (var i = 0; i < EVENTS.length; i++) {
        window.removeEventListener(EVENTS[i], onInterrupt, { capture: true });
      }
      window.removeEventListener('resize', onResize);
    }
    for (var ei = 0; ei < EVENTS.length; ei++) {
      window.addEventListener(EVENTS[ei], onInterrupt, { capture: true, passive: true });
    }
    api.skip = function () { finish(0, false); };
    /* READ-ONLY DIAGNOSTIC, for the QC harness and for anyone tuning by hand.
       It reports rather than changes: the globe's projected centre, the mark's
       measured ink box and mask half-extents, which of the three DISPERSE cases
       fired, and how many landing targets were found. Nothing in the run reads
       it. dispCase is 0 until beginReveal() has run. */
    api.state = function () {
      var ink = null;
      try { ink = markInk(); } catch (e) {}
      return {
        /* elapsed on the layer's OWN clock, the same t0 every timer above is
           counted from. A harness that anchors on page load instead is
           measuring a different clock, off by however long the load took. */
        elapsedMs: performance.now() - t0,
        cx: cx, cy: cy, R: R, vw: vw, vh: vh,
        markTop: parseFloat(ms.top) || 0,
        markLift: markLift,
        ink: ink ? { left: ink.left, top: ink.top, height: ink.height,
                     inkWidth: ink.inkWidth, advanceWidth: ink.box.width } : null,
        mask: markMask ? { halfW: markMask.halfW, halfH: markMask.halfH } : null,
        maskStrengthNow: maskState.strength,
        dispCase: dispCase,
        targets: disp && disp.targets ? disp.targets.length : 0,
        measuredTargets: dispMeasured,
        markDx: markDx,
        landed: (function () {
          if (!disp || !disp.landMap) return 0;
          var c = 0;
          for (var i = 0; i < disp.landMap.length; i++) if (disp.landMap[i] >= 0) c++;
          return c;
        })(),
        f: disp ? disp.f : 0,
        alphaMul: disp ? disp.alphaMul : 1,
        layerInDom: !!layer.parentNode,
        still: still
      };
    };
    window.addEventListener('resize', onResize);

    if (still) {
      /* the still holds, then the page is simply the page. The header mark and
         the hero were never touched on this path, so there is nothing to hand
         back and nothing to rise. */
      timers.push(window.setTimeout(function () { finish(0, false); }, REDUCED_HOLD_MS));
      return;
    }
    rafId = window.requestAnimationFrame(frame);
    timers.push(window.setTimeout(function () {
      /* the lift is spent, and this is where it is animated away. Arming the
         transition in the same task as the new value is what makes it animate;
         ms.top already holds the corrected resting position and markDx the
         corrected horizontal one, so the only thing that moves is the lift. */
      markLift = 0;
      ms.transition = 'transform ' + WORDMARK_FADE_MS + 'ms ' + TRAVEL_EASE;
      setMarkTransform();
      vSpan.style.transition = 'opacity ' + WORDMARK_FADE_MS + 'ms ' + WORDMARK_FADE_EASE;
      vSpan.style.opacity = '1';
      fp.style.transition = 'opacity ' + WORDMARK_FADE_MS + 'ms ' + WORDMARK_FADE_EASE;
      fp.style.opacity = '1';
    }, WORDMARK_AT_MS));
    /* the mark holds on the sphere's centre, then leaves. A null delay tracks
       HOLD_MS, so it leaves at the instant the field opens. */
    timers.push(window.setTimeout(travel,
      WORDMARK_AT_MS + WORDMARK_FADE_MS +
      (WORDMARK_TRAVEL_DELAY_MS === null ? HOLD_MS : WORDMARK_TRAVEL_DELAY_MS)));
    /* an explicit hero start decouples the rise from the globe's dissolve; the
       default is null, and then the rise is triggered inside finish() at the
       instant the dissolve begins */
    if (typeof HERO_RISE_START_MS === 'number' && HERO_RISE_START_MS >= 0) {
      timers.push(window.setTimeout(heroRise, HERO_RISE_START_MS));
    }
    /* the reveal. Not a fade-out any more: the field opens outward, the hero
       rises under it, and beginReveal() sets the teardown itself. */
    timers.push(window.setTimeout(beginReveal,
      WORDMARK_AT_MS + WORDMARK_FADE_MS + HOLD_MS));
  }

  function init() {
    try {
      if (!document.body) return;
      if (seenThisSession()) return;
      rememberThisSession();
      start();
    } catch (e) { /* decorative only, fall through to the plain hero */ }
  }

  /* Deferred and sitting near the end of the document, so body already exists
     and the layer goes up in the same task the parser finished in. Waiting for
     DOMContentLoaded here would let the hero paint first. */
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);

  window.VantageHeroIntro = api;
})();
