document.addEventListener('DOMContentLoaded', () => {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;

    const url = 'frontend/www/templates/footer_template.html';

    fetch(url)
        .then(response => {
            if (!response.ok) {
                console.error(`FOOTER ERROR: Failed to fetch template. HTTP status: ${response.status}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            const footerElement = document.createElement('footer');
            footerElement.innerHTML = html;
            
            footerPlaceholder.replaceWith(footerElement);

            const clockDisplay = document.getElementById('utc-clock-display');
            if (clockDisplay) {
                const updateClock = () => {
                    const now = new Date();
                    const utcString = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
                    clockDisplay.textContent = utcString;
                };
                updateClock();
                setInterval(updateClock, 1000);
            }
        })
        .catch(e => {
            console.error('Error in footer loading:', e);
            footerPlaceholder.innerHTML = '<p style="color:red;">Error loading footer.</p>';
        });
});