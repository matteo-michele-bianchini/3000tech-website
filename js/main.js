// Initialize after DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        // Close mobile menu when clicking a link
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }

    // Theme toggle (light / dark) — pre-paint script in <head> already set
    // the initial class. Here we just sync icons + react to clicks + watch
    // the OS preference for users who never explicitly chose a theme.
    (function () {
        var html = document.documentElement;

        function syncIcons() {
            var dark = html.classList.contains('dark');
            document.querySelectorAll('.theme-icon-dark').forEach(function (el) {
                el.classList.toggle('hidden', dark);
            });
            document.querySelectorAll('.theme-icon-light').forEach(function (el) {
                el.classList.toggle('hidden', !dark);
            });
            document.querySelectorAll('.theme-label-dark').forEach(function (el) {
                el.classList.toggle('hidden', dark);
            });
            document.querySelectorAll('.theme-label-light').forEach(function (el) {
                el.classList.toggle('hidden', !dark);
            });
        }
        syncIcons();

        function toggle() {
            // Enable color transitions only during the flip itself
            html.classList.add('theme-fade');
            var dark = !html.classList.contains('dark');
            html.classList.toggle('dark', dark);
            try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
            syncIcons();
            setTimeout(function () { html.classList.remove('theme-fade'); }, 300);
        }

        var btnDesktop = document.getElementById('theme-toggle');
        var btnMobile  = document.getElementById('theme-toggle-mobile');
        if (btnDesktop) btnDesktop.addEventListener('click', toggle);
        if (btnMobile)  btnMobile.addEventListener('click', function () {
            toggle();
            if (mobileMenu) mobileMenu.classList.add('hidden');
        });

        // If the user never set a manual preference, follow OS changes live
        var media = window.matchMedia('(prefers-color-scheme: dark)');
        var onMediaChange = function (e) {
            var stored = null;
            try { stored = localStorage.getItem('theme'); } catch (_) {}
            if (stored !== null) return; // user has overridden, don't auto-flip
            html.classList.toggle('dark', e.matches);
            syncIcons();
        };
        if (media.addEventListener) media.addEventListener('change', onMediaChange);
        else if (media.addListener) media.addListener(onMediaChange);
    })();

    // Motion toggle (play / pause) — freezes orbit autospin, chip-spin,
    // eyebrow pulse. The portfolio carousel is intentionally always running.
    // Each rAF tick checks window.SITE_PAUSED; CSS-driven animations follow
    // body.paused via the stylesheet.
    window.SITE_PAUSED = false;
    (function () {
        var body = document.body;

        function syncIcons() {
            var paused = body.classList.contains('paused');
            document.querySelectorAll('.motion-icon-pause').forEach(function (el) { el.classList.toggle('hidden', paused); });
            document.querySelectorAll('.motion-icon-play').forEach(function (el) { el.classList.toggle('hidden', !paused); });
            document.querySelectorAll('.motion-label-pause').forEach(function (el) { el.classList.toggle('hidden', paused); });
            document.querySelectorAll('.motion-label-play').forEach(function (el) { el.classList.toggle('hidden', !paused); });
        }

        // Always start in "play" — pause is per-session, not persisted.
        syncIcons();

        function toggle() {
            var paused = !body.classList.contains('paused');
            body.classList.toggle('paused', paused);
            window.SITE_PAUSED = paused;
            // Notify rAF ticks: rebase their time/angle origins on resume
            if (!paused) window.dispatchEvent(new Event('site-resume'));
            syncIcons();
        }

        var btn = document.getElementById('motion-toggle');
        if (btn) btn.addEventListener('click', toggle);
    })();

    // Animated stat counters — first three finish together, last one runs slower
    var counters = document.querySelectorAll('.stat-counter');
    if (counters.length && 'IntersectionObserver' in window) {
        var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var baseDuration = 1400;
        var lastDuration = 3000;
        var animateCounter = function(el, duration) {
            var match = el.textContent.match(/^(\d+)(.*)$/);
            if (!match) return;
            var target = parseInt(match[1], 10);
            var suffix = match[2];
            if (prefersReduced) { el.textContent = target + suffix; return; }
            var start = 1;
            el.textContent = start + suffix;
            var startTime = null;
            var step = function(now) {
                if (startTime === null) startTime = now;
                var t = Math.min((now - startTime) / duration, 1);
                var eased = 1 - Math.pow(1 - t, 4);
                el.textContent = Math.round(start + (target - start) * eased) + suffix;
                if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };
        var startedGroup = false;
        var counterObserver = new IntersectionObserver(function(entries) {
            if (startedGroup) return;
            var anyVisible = entries.some(function(e) { return e.isIntersecting; });
            if (!anyVisible) return;
            startedGroup = true;
            var lastIdx = counters.length - 1;
            counters.forEach(function(el, i) {
                animateCounter(el, i === lastIdx ? lastDuration : baseDuration);
                counterObserver.unobserve(el);
            });
        }, { threshold: 0.5 });
        counters.forEach(function(c) { counterObserver.observe(c); });
    }

    // Client card overlay
    var overlay = document.getElementById('client-overlay');
    if (!overlay) return;
    var overlayCard = document.getElementById('overlay-card');
    var overlayName = document.getElementById('overlay-name');
    var overlayDesc = document.getElementById('overlay-desc');
    var activeCard = null;
    var hoverTimeout = null;

    function showOverlay(card) {
        var name = card.getAttribute('data-name');
        var desc = card.getAttribute('data-desc');
        if (!name) return;
        document.querySelectorAll('.client-card .card-inner').forEach(function(el) { el.style.boxShadow = ''; });
        overlayName.textContent = name;
        overlayDesc.textContent = desc;
        overlay.style.opacity = '1';
        overlayCard.style.transform = 'scale(1) translateY(0)';
        card.querySelector('.card-inner').style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';
        activeCard = card;
    }

    var isCarouselDragging = false;

    function hideOverlay() {
        // Keep overlay visible while user is dragging a carousel row
        if (isCarouselDragging) return;
        overlay.style.opacity = '0';
        overlayCard.style.transform = 'scale(0.92) translateY(8px)';
        document.querySelectorAll('.client-card .card-inner').forEach(function(el) { el.style.boxShadow = ''; });
        activeCard = null;
    }

    // Desktop hover
    if (window.matchMedia('(hover: hover)').matches) {
        document.querySelectorAll('.client-card').forEach(function(card) {
            card.addEventListener('mouseenter', function() {
                clearTimeout(hoverTimeout);
                showOverlay(card);
            });
            card.addEventListener('mouseleave', function() {
                hoverTimeout = setTimeout(hideOverlay, 100);
            });
        });
    }

    // Block click bubbling from cards so document-click doesn't close the overlay
    // we just opened on pointerdown
    document.querySelectorAll('.client-card').forEach(function(card) {
        card.addEventListener('click', function(e) { e.stopPropagation(); });
    });

    document.addEventListener('click', function() {
        hideOverlay();
    });

    // Orbit: JS-driven autospin + pointer drag along the ring
    var orbitWrap = document.querySelector('.orbit-wrap');
    if (orbitWrap) initOrbit(orbitWrap);

    function initOrbit(wrap) {
        var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var tracks = Array.prototype.slice.call(wrap.querySelectorAll('.orbit-track'));

        // Initial chip radius derived from the legacy .mid / .inner class.
        // Radius is a fraction of the wrap's half-width (range typically 0.2…1.4).
        function initialRadius(track) {
            if (track.classList.contains('inner')) return 0.46;
            if (track.classList.contains('mid'))   return 0.74;
            return 1.0;
        }

        var MIN_R = 0.22;
        var MAX_R = 1.4;

        // Per-chip motion. Period comes from the track's data-period (jittered
        // in HTML so no two chips share exactly the same period — that's what
        // keeps them from drifting back into formation after a chance
        // alignment). Direction and starting angle are computed from the
        // track index for a clean even distribution. Chip-spin is JS-driven
        // (see below) so it shares a single GPU layer with the orbital
        // position.
        var n = tracks.length;
        var now0 = performance.now();
        var states = tracks.map(function(track, i) {
            var period  = parseFloat(track.dataset.period) || (38 + ((i * 13) % 31));
            var dir     = (i % 2 === 0) ? 1 : -1;                // alternating cw / ccw
            var initial = reduced ? 0 : (i * 360 / n + 17) % 360; // evenly-spread starts

            // Own-axis chip-spin parameters (formerly a CSS animation, now
            // baked into the same JS transform so position + rotation share
            // a single GPU layer and don't jitter against each other).
            var spinPeriod = 6 + ((i * 7) % 10) * 0.5;           // 6..10.5 s per turn
            var spinDir    = ((i * 2 + 1) % 5 < 3) ? 1 : -1;     // mix of cw / ccw
            var spinStart  = ((i * 73) % 360);                   // staggered phase

            return {
                track: track,
                chip: track.querySelector('.orbit-chip'),
                period: period,
                dir: dir,
                angle: initial,
                baseAngle: initial,
                baseTime: now0,
                radius: initialRadius(track),
                spinPeriod: spinPeriod,
                spinDir: spinDir,
                spin: spinStart,
                spinBase: spinStart,
                spinBaseTime: now0,
                dragging: false,
                pointerId: null
            };
        });

        // Each chip carries its own white orbit ring — dragging a chip out
        // visibly widens *its* ring, leaving the others alone. The original
        // r1/r2/r3 static rings become redundant and are hidden (r4 stays
        // as the inner decoration).
        Array.prototype.slice.call(wrap.querySelectorAll('.orbit-ring')).forEach(function (r) {
            if (!r.classList.contains('r4')) r.style.display = 'none';
        });
        var firstTrack = wrap.querySelector('.orbit-track');
        states.forEach(function (s) {
            var ring = document.createElement('div');
            ring.className = 'orbit-ring chip-ring';
            // Insert before the first track so rings sit behind the chips
            // visually, and preserve state iteration order in the DOM.
            wrap.insertBefore(ring, firstTrack);
            s.ring = ring;
        });
        function syncChipRing(s) {
            if (!s.ring) return;
            s.ring.style.inset = ((1 - s.radius) * 50).toFixed(3) + '%';
        }
        states.forEach(syncChipRing);

        // Vinyl mode: tap the center to engage, drag to "scratch" — the
        // center, the rings and the chips all rotate together at a single
        // global angular speed. Fully JS-driven so the center can be both
        // auto-spinning AND grabbable without animation-resume glitches.
        var vinyl = false;
        var vinylDragging = false;
        var VINYL_SPEED = 30; // deg/sec
        var globalAngle = 0;
        var vinylBaseAngle = 0;     // globalAngle value at vinylBaseTime
        var vinylBaseTime = 0;
        var centerLockedAngle = 0;  // center's angle at vinyl start (==0)
        var TAP_THRESHOLD = 4;       // deg: below this a pointerup is a tap

        function lockTracks() {
            // Snapshot each track's current angle as its phase offset
            // for the upcoming vinyl rotation.
            states.forEach(function (s) { s.lockedAngle = s.angle - globalAngle; });
        }
        function activateVinyl(at) {
            vinyl = true;
            vinylBaseTime = at;
            vinylBaseAngle = globalAngle;
            wrap.classList.add('orbit-vinyl');
        }
        function rebaseMotion(s, now) {
            s.baseAngle    = s.angle;
            s.baseTime     = now;
            s.spinBase     = s.spin;
            s.spinBaseTime = now;
        }
        function deactivateVinyl() {
            if (!vinyl) return;
            vinyl = false;
            // Each track resumes its own autospin from current angle in
            // its original direction.
            var now = performance.now();
            states.forEach(function (s) { rebaseMotion(s, now); });
            wrap.classList.remove('orbit-vinyl');
        }

        var orbitCenter = wrap.querySelector('.orbit-center');

        function renderChip(s, halfW) {
            if (!s.chip) return;
            var rPx = s.radius * halfW;
            var rad = (s.angle - 90) * Math.PI / 180;
            var x = halfW + rPx * Math.cos(rad);
            var y = halfW + rPx * Math.sin(rad);
            // Chip orientation = orbital angle + own-axis spin. Adding the
            // orbital angle is what makes a dragged chip rototranslate (in
            // the pre-refactor version the chip lived inside a rotating
            // track, so its visual orientation followed the orbit "for
            // free"). All composed in one GPU-friendly transform.
            var rot = s.spin + s.angle;
            s.chip.style.transform =
                'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) ' +
                'translate(-50%, -50%) ' +
                'rotate(' + rot.toFixed(2) + 'deg)';
        }

        // Paint once synchronously so chips don't flash at wrap origin
        // between init and the first rAF tick.
        (function () {
            var halfW = wrap.clientWidth / 2;
            states.forEach(function (s) { renderChip(s, halfW); });
        })();

        function tick(now) {
            // Auto vinyl advance only when not paused, not scratching
            if (vinyl && !vinylDragging && !window.SITE_PAUSED) {
                globalAngle = vinylBaseAngle + VINYL_SPEED * (now - vinylBaseTime) / 1000;
            }

            var halfW = wrap.clientWidth / 2;
            var frozen = window.SITE_PAUSED || reduced;
            for (var i = 0; i < states.length; i++) {
                var s = states[i];
                if (s.dragging) {
                    // chip drag owns its angle + radius (works even when paused).
                    // Own-axis spin pauses while held to match the user's intent.
                } else if (vinyl || vinylDragging) {
                    // Sync with globalAngle. While paused without scratch,
                    // globalAngle stays constant so chips stay still.
                    s.angle = s.lockedAngle + globalAngle;
                } else if (frozen) {
                    // Frozen: keep current angle and spin
                } else {
                    var elapsed = (now - s.baseTime) / 1000;
                    s.angle = s.baseAngle + s.dir * (elapsed / s.period) * 360;
                    var spinElapsed = (now - s.spinBaseTime) / 1000;
                    s.spin = s.spinBase + s.spinDir * (spinElapsed / s.spinPeriod) * 360;
                }
                renderChip(s, halfW);
            }

            // Center transform: while in vinyl/drag, drive it from globalAngle
            // (works even when paused, so the user can scratch).
            if (orbitCenter && (vinyl || vinylDragging)) {
                orbitCenter.style.transform = 'translate(-50%, -50%) rotate(' + (centerLockedAngle + globalAngle) + 'deg)';
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        // Re-sync ring insets when the wrap resizes (radii are fractions
        // of half-width, so visual positions update automatically — only
        // the rings need an explicit nudge in case the browser dropped
        // the inline style on a layout pass).
        window.addEventListener('resize', function () {
            states.forEach(syncChipRing);
        });

        // On resume, rebase time origins so motion picks up smoothly
        // from the frozen position instead of jumping ahead.
        window.addEventListener('site-resume', function () {
            var now = performance.now();
            states.forEach(function (s) { rebaseMotion(s, now); });
            vinylBaseTime = now;
            vinylBaseAngle = globalAngle;
        });

        // --- Center drag (scratch) + tap (toggle) ---
        if (orbitCenter) {
            var centerDragMoved = false;
            var centerLastPointer = 0;
            var centerAccumulated = 0; // sum of unapplied micro-steps before the drag commits

            orbitCenter.addEventListener('pointerdown', function (ev) {
                if (typeof orbitCenter.setPointerCapture === 'function') {
                    try { orbitCenter.setPointerCapture(ev.pointerId); } catch (_) {}
                }
                vinylDragging = true;
                centerLastPointer = pointerAngle(ev);
                centerAccumulated = 0;
                centerDragMoved = false;
                // Snapshot tracks against current globalAngle so they ride
                // the disc smoothly if a drag actually starts.
                lockTracks();
                orbitCenter.classList.add('dragging');
                ev.preventDefault();
            });

            orbitCenter.addEventListener('pointermove', function (ev) {
                if (!vinylDragging) return;
                var a = pointerAngle(ev);
                var step = ((a - centerLastPointer + 540) % 360) - 180;
                centerLastPointer = a;
                if (centerDragMoved) {
                    // Drag committed: apply every step
                    globalAngle += step;
                } else {
                    // Below threshold: keep accumulating without moving
                    // anything yet, so the disc doesn't jitter on a click.
                    centerAccumulated += step;
                    if (Math.abs(centerAccumulated) > TAP_THRESHOLD) {
                        centerDragMoved = true;
                        globalAngle += centerAccumulated; // catch-up to the finger
                    }
                }
            });

            function endCenterDrag(ev) {
                if (!vinylDragging) return;
                vinylDragging = false;
                orbitCenter.classList.remove('dragging');
                if (typeof orbitCenter.releasePointerCapture === 'function') {
                    try { orbitCenter.releasePointerCapture(ev.pointerId); } catch (_) {}
                }
                if (!centerDragMoved) {
                    // It was a tap → toggle vinyl mode
                    if (vinyl) deactivateVinyl();
                    else activateVinyl(performance.now());
                } else {
                    // It was a real drag (scratch) → stop. The disc rests
                    // wherever the user left it; the chips resume their own
                    // autospin from there. To re-engage vinyl, tap.
                    var now = performance.now();
                    states.forEach(function (s) { rebaseMotion(s, now); });
                    if (vinyl) {
                        vinyl = false;
                        wrap.classList.remove('orbit-vinyl');
                    }
                }
            }
            orbitCenter.addEventListener('pointerup', endCenterDrag);
            orbitCenter.addEventListener('pointercancel', endCenterDrag);
        }

        function pointerAngle(ev) {
            var r = wrap.getBoundingClientRect();
            return Math.atan2(ev.clientY - (r.top + r.height / 2),
                              ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
        }

        function chipCartesian(s, halfW) {
            var rad = (s.angle - 90) * Math.PI / 180;
            return {
                x: halfW + s.radius * halfW * Math.cos(rad),
                y: halfW + s.radius * halfW * Math.sin(rad)
            };
        }

        states.forEach(function(s) {
            var chip = s.chip;
            if (!chip) return;

            chip.addEventListener('pointerdown', function(ev) {
                // Grabbing a chip exits vinyl mode — direct manipulation wins
                if (vinyl) deactivateVinyl();
                if (typeof chip.setPointerCapture === 'function') {
                    try { chip.setPointerCapture(ev.pointerId); } catch (_) {}
                }
                s.dragging = true;
                s.pointerId = ev.pointerId;
                // Remember the cartesian offset between pointer and chip
                // center so the chip doesn't snap-jump under the cursor on
                // the first move.
                var r = wrap.getBoundingClientRect();
                var halfW = r.width / 2 || 1;
                var c = chipCartesian(s, halfW);
                s.grabDx = c.x - (ev.clientX - r.left);
                s.grabDy = c.y - (ev.clientY - r.top);
                chip.classList.add('dragging');
                ev.preventDefault();
            });

            chip.addEventListener('pointermove', function(ev) {
                if (!s.dragging || ev.pointerId !== s.pointerId) return;
                var r = wrap.getBoundingClientRect();
                var halfW = r.width / 2 || 1;
                var x = (ev.clientX - r.left) + s.grabDx;
                var y = (ev.clientY - r.top) + s.grabDy;
                var dx = x - halfW;
                var dy = y - halfW;
                // Angle: 0° = up, +ve = clockwise (matches CSS rotate convention).
                var rawAngle = Math.atan2(dx, -dy) * 180 / Math.PI;
                // Unwrap to nearest signed delta so s.angle stays continuous.
                var diff = ((rawAngle - s.angle + 540) % 360) - 180;
                s.angle += diff;
                s.radius = Math.max(MIN_R, Math.min(MAX_R, Math.hypot(dx, dy) / halfW));
                syncChipRing(s);
            });

            function release(ev) {
                if (!s.dragging) return;
                s.dragging = false;
                chip.classList.remove('dragging');
                // Restart autospin from wherever the user dropped the chip.
                rebaseMotion(s, performance.now());
                syncChipRing(s);
                if (typeof chip.releasePointerCapture === 'function') {
                    try { chip.releasePointerCapture(ev.pointerId); } catch (_) {}
                }
            }
            chip.addEventListener('pointerup', release);
            chip.addEventListener('pointercancel', release);
        });
    }

    // Carousel: JS-driven scroll + pointer drag (per row, independent)
    initCarousels();

    function initCarousels() {
        var tracks = Array.prototype.slice.call(document.querySelectorAll('.carousel-track'));
        if (!tracks.length) return;
        var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var DRAG_THRESHOLD = 6; // px before considering pointer move a real drag

        function wrap(x, w) {
            if (!w || w <= 0) return 0;
            return ((x % w) + w) % w;
        }

        var states = tracks.map(function(track) {
            var period = parseFloat(track.dataset.period) || 30;
            var dir    = parseFloat(track.dataset.dir)    || 1;
            return {
                track: track,
                period: period,
                dir: dir,
                loopWidth: track.scrollWidth / 3 || 1,
                offset: 0,
                baseOffset: 0,
                baseTime: performance.now(),
                dragging: false,
                pointerId: null,
                startClientX: 0,
                startOffset: 0,
                moved: false
            };
        });

        function refreshWidths() {
            states.forEach(function(s) {
                var newW = s.track.scrollWidth / 3;
                if (newW > 0 && Math.abs(newW - s.loopWidth) > 0.5) {
                    var ratio = newW / s.loopWidth;
                    s.offset *= ratio;
                    s.baseOffset *= ratio;
                    s.loopWidth = newW;
                }
            });
        }
        window.addEventListener('resize', refreshWidths);
        // Images may load after init; recompute once shortly after
        setTimeout(refreshWidths, 600);

        function tick(now) {
            for (var i = 0; i < states.length; i++) {
                var s = states[i];
                if (!s.dragging && !reduced) {
                    var elapsed = (now - s.baseTime) / 1000;
                    s.offset = wrap(s.baseOffset + s.dir * (elapsed / s.period) * s.loopWidth, s.loopWidth);
                }
                s.track.style.transform = 'translateX(' + (-s.offset) + 'px)';
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        states.forEach(function(s) {
            var track = s.track;

            track.addEventListener('pointerdown', function(ev) {
                // Open client overlay if pointerdown landed on a card
                var card = ev.target.closest && ev.target.closest('.client-card');
                if (card && typeof showOverlay === 'function') showOverlay(card);

                s.dragging = true;
                s.pointerId = ev.pointerId;
                s.startClientX = ev.clientX;
                s.startOffset = s.offset;
                s.moved = false;
                track.classList.add('dragging');
                isCarouselDragging = true;
                if (typeof track.setPointerCapture === 'function') {
                    try { track.setPointerCapture(ev.pointerId); } catch (_) {}
                }
            });

            track.addEventListener('pointermove', function(ev) {
                if (!s.dragging || ev.pointerId !== s.pointerId) return;
                var delta = ev.clientX - s.startClientX;
                if (!s.moved && Math.abs(delta) > DRAG_THRESHOLD) s.moved = true;
                s.offset = wrap(s.startOffset - delta, s.loopWidth);
            });

            function release(ev) {
                if (!s.dragging || ev.pointerId !== s.pointerId) return;
                s.dragging = false;
                track.classList.remove('dragging');
                s.baseOffset = s.offset;
                s.baseTime = performance.now();
                if (typeof track.releasePointerCapture === 'function') {
                    try { track.releasePointerCapture(ev.pointerId); } catch (_) {}
                }
                // Defer clearing the global flag until after the click event
                // bubbles, so hideOverlay during click doesn't fire.
                setTimeout(function() {
                    isCarouselDragging = false;
                }, 0);
            }
            track.addEventListener('pointerup', release);
            track.addEventListener('pointercancel', release);
        });
    }
});
