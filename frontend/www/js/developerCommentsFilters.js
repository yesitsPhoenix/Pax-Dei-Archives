// frontend/www/js/developerCommentsFilters.js

$(document).ready(function() {
    const devCommentsContainer = $('#dev-comments-container');
    const filterAuthorSelect = $('#filterAuthor');
    const filterTagSelect = $('#filterTag');
    const filterDateInput = $('#filterDate');
    const applyFiltersButton = $('#applyFilters');
    const clearFiltersButton = $('#clearFilters');

    function populateFilters() {
        filterAuthorSelect.find('option:not(:first)').remove();
        filterTagSelect.find('option:not(:first)').remove();

        const authors = new Set();
        const tags = new Set();

        devCommentsContainer.children('.dev-comment-item').each(function() {
            const author = $(this).data('author');
            const tag = $(this).data('tag');
            if (author) authors.add(author);
            if (tag) tags.add(tag);
        });

        Array.from(authors).sort().forEach(author => {
            filterAuthorSelect.append(`<option value="${author}">${author}</option>`);
        });

        Array.from(tags).sort().forEach(tag => {
            filterTagSelect.append(`<option value="${tag}">${tag}</option>`);
        });
    }

    function applyFilters() {
        const selectedAuthor = filterAuthorSelect.val();
        const selectedTag = filterTagSelect.val();
        const selectedDate = filterDateInput.val();

        let commentsFound = false;

        devCommentsContainer.children('.dev-comment-item').each(function() {
            const commentAuthor = $(this).data('author');
            const commentTag = $(this).data('tag');
            const commentDate = $(this).data('date');

            const matchesAuthor = selectedAuthor === "" || commentAuthor === selectedAuthor;
            const matchesTag = selectedTag === "" || commentTag === selectedTag;
            const matchesDate = selectedDate === "" || commentDate === selectedDate;

            if (matchesAuthor && matchesTag && matchesDate) {
                $(this).show();
                commentsFound = true;
            } else {
                $(this).hide();
            }
        });

        const noCommentsMessage = devCommentsContainer.find('.no-comments-found');
        if (!commentsFound) {
            if (noCommentsMessage.length === 0) {
                devCommentsContainer.append('<div class="col-lg-12 no-comments-found"><p class="text-center text-white-50">No comments found matching your filters.</p></div>');
            } else {
                noCommentsMessage.show();
            }
        } else {
            noCommentsMessage.hide();
        }
    }

    function clearFilters() {
        filterAuthorSelect.val('');
        filterTagSelect.val('');
        filterDateInput.val('');

        devCommentsContainer.children('.dev-comment-item').show();

        devCommentsContainer.find('.no-comments-found').hide();
    }

    devCommentsContainer.on('commentsRendered', function() {
        populateFilters();
        applyFilters();
    });

    if (devCommentsContainer.children('.dev-comment-item').length > 0) {
        populateFilters();
        applyFilters();
    }

    applyFiltersButton.on('click', applyFilters);
    clearFiltersButton.on('click', clearFilters);
});