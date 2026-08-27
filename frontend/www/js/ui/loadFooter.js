document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('script[data-suite-messaging]')) {
        const messaging = document.createElement('script');
        messaging.src = 'https://admin.yesitsphoenix.dev/shared/suite-messaging.js?v=suite-messaging-v1';
        messaging.dataset.suiteMessaging = 'true';
        document.head.append(messaging);
    }
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

        })
        .catch(e => {
            console.error('Error in footer loading:', e);
            footerPlaceholder.innerHTML = '<p style="color:red;">Error loading footer.</p>';
        });
});
