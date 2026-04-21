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

    // Animated stat counters — sequential finish (first ends first, last ends last)
    var counters = document.querySelectorAll('.stat-counter');
    if (counters.length && 'IntersectionObserver' in window) {
        var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var duration = 1200;
        var stagger = 400;
        var animateCounter = function(el, delay) {
            var match = el.textContent.match(/^(\d+)(.*)$/);
            if (!match) return;
            var target = parseInt(match[1], 10);
            var suffix = match[2];
            if (prefersReduced) { el.textContent = target + suffix; return; }
            var start = 1;
            el.textContent = start + suffix;
            var startTime = null;
            var step = function(now) {
                if (startTime === null) startTime = now + delay;
                var t = Math.min(Math.max((now - startTime) / duration, 0), 1);
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
            counters.forEach(function(el, i) {
                animateCounter(el, i * stagger);
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
});
