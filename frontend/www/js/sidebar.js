document.addEventListener("DOMContentLoaded", function() {
    const gridContainer = document.getElementById('grid-container');
    const sidebar = document.getElementById('rt_sidebar');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    let sidebarOpen = false;

    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOpen = true;
        gridContainer.style.paddingRight = '450px';
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOpen = false;
        gridContainer.style.paddingRight = '0';
    }

    gridContainer.addEventListener('click', function(event) {
        const clickedRecord = event.target.closest('.ag-row');
        if (clickedRecord) {
            openSidebar();
        } else if (!sidebar.contains(event.target) && sidebarOpen) {
            closeSidebar();
        }
    });

    closeSidebarBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        closeSidebar(); 
    });
});
