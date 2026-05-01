// ─── AWAY BANNER TOGGLE ────────────────────────────────────────────────────
// Set to true to show the banner, false to disable it entirely.
const AWAY_BANNER_ENABLED = true;
// ────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    const url = 'frontend/www/templates/header_template.html?v=20260427-publications-archive';

    fetch(url)
        .then(response => {
            if (!response.ok) {
                console.error(`HEADER ERROR: Failed to fetch template. HTTP status: ${response.status}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            const headerElement = document.createElement('header');
            headerElement.className = 'header-area';
            headerElement.innerHTML = html;

            headerPlaceholder.replaceWith(headerElement);

            const path = new URL(window.location.href).pathname;
            const pathSegments = path.split('/');
            const currentPage = pathSegments.pop() || 'index.html';

            const navLinks = headerElement.querySelectorAll('.main-nav a');
            navLinks.forEach(link => {
                const linkHref = link.getAttribute('href');
                const cleanedLinkHref = linkHref ? linkHref.split('/').pop().toLowerCase() : '';

                if (cleanedLinkHref === currentPage.toLowerCase()) {
                    link.classList.add('active');
                    const parentLi = link.closest('li');
                    if (parentLi) {
                        parentLi.classList.add('active');
                    }

                    const parentDropdown = link.closest('.dropdown');
                    if (parentDropdown) {
                        const dropdownAnchor = parentDropdown.querySelector('a:not(.dropdown-content a)');
                        if (dropdownAnchor) {
                            dropdownAnchor.classList.add('active');
                        }
                    }
                }
            });

            // ── Away banner init ─────────────────────────────────────────────────────
            if (AWAY_BANNER_ENABLED) {
                const STORAGE_KEY = 'away_banner_dismissed_v1';
                const banner = headerElement.querySelector('#away-banner');
                if (banner && localStorage.getItem(STORAGE_KEY) !== 'true') {
                    banner.style.display = 'flex';
                    const closeBtn = banner.querySelector('#away-banner-close');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', function () {
                            banner.style.display = 'none';
                            localStorage.setItem(STORAGE_KEY, 'true');
                        });
                    }
                }
            }
            // ────────────────────────────────────────────────────────────────────────
        })
        .catch(e => {
            console.error('Error in header loading or activation:', e);
            headerPlaceholder.innerHTML = '<p style="color:red;">Error loading navigation header.</p>';
        });
});
