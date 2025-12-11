document.addEventListener('DOMContentLoaded', () => {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    const url = 'frontend/www/templates/header_template.html';

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
        })
        .catch(e => {
            console.error('Error in header loading or activation:', e);
            headerPlaceholder.innerHTML = '<p style="color:red;">Error loading navigation header.</p>';
        });
});