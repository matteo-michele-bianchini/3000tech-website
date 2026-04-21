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

    // Animated stat counters
    var counters = document.querySelectorAll('.stat-counter');
    if (counters.length && 'IntersectionObserver' in window) {
        var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var animateCounter = function(el) {
            var match = el.textContent.match(/^(\d+)(.*)$/);
            if (!match) return;
            var target = parseInt(match[1], 10);
            var suffix = match[2];
            if (prefersReduced) { el.textContent = target + suffix; return; }
            var duration = 1600;
            var startTime = performance.now();
            el.textContent = '0' + suffix;
            var step = function(now) {
                var t = Math.min((now - startTime) / duration, 1);
                var eased = 1 - Math.pow(1 - t, 4);
                el.textContent = Math.round(target * eased) + suffix;
                if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };
        var counterObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
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
