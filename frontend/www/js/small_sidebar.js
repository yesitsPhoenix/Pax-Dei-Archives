
export async function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.add('collapsed');

        sidebar.addEventListener('mouseenter', () => {
            sidebar.classList.remove('collapsed');
        });

        sidebar.addEventListener('mouseleave', () => {
            sidebar.classList.add('collapsed');
        });
    }
}
document.addEventListener('DOMContentLoaded', () => {

    initSidebar();
});