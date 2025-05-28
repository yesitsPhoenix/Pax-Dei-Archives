
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);



$(document).ready(function() {
    const devCommentsContainer = $('#dev-comments-container');
    const filterAuthorSelect = $('#filterAuthor');
    const filterTagSelect = $('#filterTag');
    const filterDateInput = $('#filterDate');
    const applyFiltersButton = $('#applyFilters');
    const clearFiltersButton = $('#clearFilters');

    // Function to populate tags from Supabase
    async function populateTagsFromSupabase() {
        filterTagSelect.find('option:not(:first)').remove();

        try {
            const { data, error } = await supabase
                .from('tag_list')
                .select('tag_name');

            if (error) {
                console.error('Error fetching tags from Supabase:', error.message);
                return;
            }

            data.forEach(tag => {
                filterTagSelect.append(`<option value="${tag.tag_name}">${tag.tag_name}</option>`);
            });

        } catch (e) {
            console.error('Unexpected error during Supabase tag fetch:', e);
        }
    }

    function populateAuthorsFromComments() {
        filterAuthorSelect.find('option:not(:first)').remove();
        const authors = new Set();

        devCommentsContainer.children('.dev-comment-item').each(function() {
            const author = $(this).data('author');
            if (author) authors.add(author);
        });

        Array.from(authors).sort().forEach(author => {
            filterAuthorSelect.append(`<option value="${author}">${author}</option>`);
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

    // When comments are rendered (e.g., loaded from DB), populate authors from them
    devCommentsContainer.on('commentsRendered', function() {
        populateAuthorsFromComments();
        applyFilters();
    });

    // Initial load: Fetch tags from Supabase directly
    populateTagsFromSupabase();

    // Populate authors if comments are already in DOM on initial load (less common for dynamic content)
    if (devCommentsContainer.children('.dev-comment-item').length > 0) {
        populateAuthorsFromComments();
    }

    applyFiltersButton.on('click', applyFilters);
    clearFiltersButton.on('click', clearFilters);
});