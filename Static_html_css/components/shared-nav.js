(function () {
    'use strict';

    var mount = document.getElementById('rshop-shared-nav');
    if (!mount) {
        return;
    }

    function ensureNavStylesheet() {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for (var i = 0; i < links.length; i += 1) {
            var href = links[i].getAttribute('href') || '';
            if (href.indexOf('top-nav.css') !== -1) {
                return;
            }
        }

        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '../css/top-nav.css';
        document.head.appendChild(link);
    }

    function markActiveNavLink() {
        var currentPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();
        var navLinks = mount.querySelectorAll('.rshop-nav-link');

        for (var i = 0; i < navLinks.length; i += 1) {
            var link = navLinks[i];
            var href = link.getAttribute('href');
            if (!href) {
                continue;
            }

            var url = new URL(href, window.location.href);
            var linkPath = url.pathname.replace(/\\/g, '/').toLowerCase();
            if (currentPath.endsWith(linkPath)) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
                break;
            }
        }
    }

    ensureNavStylesheet();
    document.body.classList.add('with-rshop-nav');

    fetch('../components/top-nav.html')
        .then(function (response) {
            if (!response.ok) {
                throw new Error('Failed to load shared navigation.');
            }
            return response.text();
        })
        .then(function (html) {
            mount.innerHTML = html;
            markActiveNavLink();
        })
        .catch(function (error) {
            console.error(error);
        });
})();
