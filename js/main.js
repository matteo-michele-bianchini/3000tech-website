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

    function hideOverlay() {
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

    // Mobile tap
    document.querySelectorAll('.client-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
            e.stopPropagation();
            if (activeCard === card) {
                hideOverlay();
            } else {
                hideOverlay();
                showOverlay(card);
            }
        });
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
        var states = tracks.map(function(track) {
            var period = parseFloat(track.dataset.period) || 40;
            var dir    = parseFloat(track.dataset.dir)    || 1;
            var phase  = parseFloat(track.dataset.phase)  || 0;
            var initial = reduced ? 0 : dir * ((-phase) / period) * 360;
            return {
                track: track,
                period: period,
                dir: dir,
                angle: initial,
                baseAngle: initial,
                baseTime: performance.now(),
                dragging: false,
                lastPointer: 0
            };
        });

        function tick(now) {
            for (var i = 0; i < states.length; i++) {
                var s = states[i];
                if (!s.dragging && !reduced) {
                    var elapsed = (now - s.baseTime) / 1000;
                    s.angle = s.baseAngle + s.dir * (elapsed / s.period) * 360;
                }
                s.track.style.transform = 'rotate(' + s.angle + 'deg)';
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        function pointerAngle(ev) {
            var r = wrap.getBoundingClientRect();
            return Math.atan2(ev.clientY - (r.top + r.height / 2),
                              ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
        }

        states.forEach(function(s) {
            var chip = s.track.querySelector('.orbit-chip');
            if (!chip) return;

            chip.addEventListener('pointerdown', function(ev) {
                if (typeof chip.setPointerCapture === 'function') {
                    try { chip.setPointerCapture(ev.pointerId); } catch (_) {}
                }
                s.dragging = true;
                s.lastPointer = pointerAngle(ev);
                chip.classList.add('dragging');
                ev.preventDefault();
            });

            chip.addEventListener('pointermove', function(ev) {
                if (!s.dragging) return;
                var a = pointerAngle(ev);
                var step = a - s.lastPointer;
                // unwrap to nearest small step (handles -180/180 boundary)
                step = ((step + 540) % 360) - 180;
                s.angle += step;
                s.lastPointer = a;
            });

            function release(ev) {
                if (!s.dragging) return;
                s.dragging = false;
                chip.classList.remove('dragging');
                s.baseAngle = s.angle;
                s.baseTime = performance.now();
                if (typeof chip.releasePointerCapture === 'function') {
                    try { chip.releasePointerCapture(ev.pointerId); } catch (_) {}
                }
            }
            chip.addEventListener('pointerup', release);
            chip.addEventListener('pointercancel', release);
        });
    }
});
