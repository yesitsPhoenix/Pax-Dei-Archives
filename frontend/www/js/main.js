// main.js

import { supabase } from './supabaseClient.js';

function formatCommentDateTime(dateString) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString(undefined, options);
  } catch (e) {
    console.error('Error formatting comment date time:', dateString, e);
    return '';
  }
}


function formatNewsDate(dateString) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  if (!dateString) return '';
  try {
    // Append 'T00:00:00' to ensure it's parsed as a local date for consistent behavior
    // especially if the input dateString is just 'YYYY-MM-DD'.
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', options);
  } catch (e) {
    console.error('Error formatting news date:', dateString, e);
    return '';
  }
}


async function fetchAndRenderDeveloperComments(containerId, limit = null, searchTerm = null) {
    const container = document.getElementById(containerId);
    if (!container && !searchTerm) return [];

    if (!searchTerm && container) {
        container.innerHTML = '<div class="loading-indicator">Loading comments...</div>';
    }

    try {
        let query = supabase
            .from('developer_comments')
            .select('*');

        if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
        }

        query = query.order('comment_date', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching developer comments:', error.message);
            if (!searchTerm && container) {
                container.innerHTML = '<div class="error-message">Failed to load comments. Please try again later.</div>';
            }
            return [];
        }

        if (data.length === 0 && !searchTerm && container) {
            container.innerHTML = '<div class="no-content-message">No developer comments found.</div>';
            return [];
        }

        if (!searchTerm && container) {
            container.innerHTML = '';
            data.forEach(comment => {
                let sourceDisplay = '';
                const urlPattern = /^(https?:\/\/[^\s]+)$/i;

                if (comment.source && urlPattern.test(comment.source)) {
                    sourceDisplay = `
                        <a href="${comment.source}" target="_blank" rel="noopener noreferrer" class="source-link-button">
                            <i class="fas fa-external-link-alt"></i> Source
                        </a>
                    `;
                } else if (comment.source) {
                    sourceDisplay = comment.source;
                }

                let formattedDateForData = '';
                if (comment.comment_date) {
                    try {
                        const dateObj = new Date(comment.comment_date);
                        const year = dateObj.getFullYear();
                        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const day = String(dateObj.getDate()).padStart(2, '0');
                        formattedDateForData = `${year}-${month}-${day}`;
                    } catch (e) {
                        console.warn('Could not parse comment_date for data attribute:', comment.comment_date, e);
                    }
                }

                const commentHtml = `
                    <div class="${containerId === 'recent-comments-home' ? 'col-lg-6 col-md-6' : 'col-lg-12'} mb-4 dev-comment-item"
                         data-author="${comment.author || ''}"
                         data-tag="${comment.tag ? (Array.isArray(comment.tag) ? comment.tag.join(',') : comment.tag) : ''}"
                         data-date="${formattedDateForData}">
                        <div class="${containerId === 'recent-comments-home'}">
                            <div class="down-content">
                                <h6>${comment.author} <span class="date">${formatCommentDateTime(comment.comment_date)}</span></h6>
                                <h4>${comment.title}</h4>
                                <p>${comment.content}</p>
                                ${sourceDisplay ? `<span class="comment-source">${sourceDisplay}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', commentHtml);
            });
        }
        return data;
    } catch (error) {
        console.error('Unexpected error in fetchAndRenderDeveloperComments:', error);
        if (!searchTerm && container) {
            container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
        }
        return [];
    }
}

async function fetchAndRenderNewsUpdates(containerId, limit = null, searchTerm = null) {
    const container = document.getElementById(containerId);
    if (!container && !searchTerm) return [];

    if (!searchTerm && container) {
        container.innerHTML = '<div class="loading-indicator">Loading news...</div>';
    }

    try {
        let query = supabase
            .from('news_updates')
            .select('*');

        if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%,full_article_link.ilike.%${searchTerm}%`);
        }

        query = query.order('news_date', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching news updates:', error.message);
            if (!searchTerm && container) {
                container.innerHTML = '<div class="error-message">Failed to load news. Please try again later.</div>';
            }
            return [];
        }

        if (data.length === 0 && !searchTerm && container) {
            container.innerHTML = '<div class="no-content-message">No news updates found.</div>';
            return [];
        }

        if (!searchTerm && container) {
            container.innerHTML = '';
            data.forEach(newsItem => {
                const newsHtml = `
                    <div class="${containerId === 'news-updates-home' ? 'col-lg-4 col-md-6' : 'col-lg-12'}">
                        <div class="news-item">
                            <h6>${newsItem.title}</h6>
                            <span>${formatNewsDate(newsItem.news_date)}</span>
                            <p>${newsItem.summary}</p>
                            ${newsItem.full_article_link ? `<div class="main-button"><a href="${newsItem.full_article_link}" target="_blank">Read More</a></div>` : ''}
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', newsHtml);
            });
        }
        return data;
    } catch (error) {
        console.error('Unexpected error in fetchAndRenderNewsUpdates:', error);
        if (!searchTerm && container) {
            container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
        }
        return [];
    }
}

async function performSearch(searchTerm) {
    const searchResultsDropdown = $('#searchResultsDropdown');
    searchResultsDropdown.html('<div class="search-loading-indicator">Searching...</div>');
    searchResultsDropdown.addClass('active');

    try {
        const [comments, newsUpdates] = await Promise.all([
            fetchAndRenderDeveloperComments(null, null, searchTerm),
            fetchAndRenderNewsUpdates(null, null, searchTerm)
        ]);

        const allResults = [];

        comments.forEach(comment => {
            allResults.push({
                type: 'Developer Comment',
                title: comment.title,
                content: comment.content,
                date: comment.comment_date,
                author: comment.author,
                source: comment.source,
                link: null
            });
        });

        newsUpdates.forEach(newsItem => {
            allResults.push({
                type: 'News Update',
                title: newsItem.title,
                content: newsItem.summary,
                date: newsItem.news_date,
                author: null,
                source: newsItem.full_article_link,
                link: newsItem.full_article_link
            });
        });

        allResults.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allResults.length === 0) {
            searchResultsDropdown.html('<div class="no-results-message">No results found for your search.</div>');
        } else {
            searchResultsDropdown.empty();
            allResults.forEach(item => {
                let sourceDisplay = '';
                if (item.source) {
                    const urlPattern = /^(https?:\/\/[^\s]+)$/i;
                    if (urlPattern.test(item.source)) {
                        sourceDisplay = `
                            <a href="${item.source}" target="_blank" rel="noopener noreferrer" class="source-link-button">
                                <i class="fas fa-external-link-alt"></i> Source
                            </a>
                        `;
                    } else {
                        sourceDisplay = `<span class="comment-source">Source: ${item.source}</span>`;
                    }
                }

                const formattedDateForDisplay = item.type === 'Developer Comment'
                                            ? formatCommentDateTime(item.date)
                                            : formatNewsDate(item.date);

                const resultHtml = `
                    <div class="search-result-item ${item.type === 'Developer Comment' ? 'comment-item' : 'news-item'}">
                        <div class="down-content">
                            <h6>${item.type === 'Developer Comment' ? item.author + ' - ' : ''}${item.title} <span class="date">${formattedDateForDisplay}</span></h6>
                            <p>${item.content}</p>
                            ${sourceDisplay ? sourceDisplay : ''}
                            ${item.link && item.type === 'News Update' ? `<div class="main-button"><a href="${item.link}" target="_blank">Read More</a></div>` : ''}
                        </div>
                    </div>
                `;
                searchResultsDropdown.append(resultHtml);
            });
        }

    } catch (error) {
        console.error('Error during search:', error);
        searchResultsDropdown.html('<div class="search-error-message">An error occurred during search. Please try again.</div>');
    }
}


$(document).ready(async function() {
    // --- UI Navigation and Modals ---
    $('.menu-trigger').on('click', function() {
        $(this).toggleClass('active');
        $('.header-area .nav').toggleClass('active');
    });

    // Smooth scroll for anchor links
    $('a[href*="#"]:not([href="#"])').on('click', function() {
        if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
            var target = $(this.hash);
            target = target.length ? target : $('[name=' + this.hash.slice(1) +']');
            if (target.length) {
                $('html, body').animate({
                    scrollTop: target.offset().top - 80
                }, 1000);
                return false;
            }
        }
    });

    // Roadmap Modal functionality
    const roadmapLink = $('#roadmapLink');
    const roadmapModalOverlay = $('#roadmapModalOverlay');
    const closeRoadmapModalButton = $('#closeRoadmapModal');

    if (roadmapLink.length && roadmapModalOverlay.length && closeRoadmapModalButton.length) {
        roadmapLink.on('click', function(event) {
            event.preventDefault();
            roadmapModalOverlay.addClass('active');
            $('body').addClass('modal-open'); // Prevent body scroll
        });

        closeRoadmapModalButton.on('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            roadmapModalOverlay.removeClass('active');
            $('body').removeClass('modal-open');
        });

        roadmapModalOverlay.on('click', function(event) {
            if ($(event.target).is(roadmapModalOverlay)) {
                event.stopPropagation();
                roadmapModalOverlay.removeClass('active');
                $('body').removeClass('modal-open');
            }
        });

        $(document).on('keydown', function(event) {
            if (event.key === 'Escape' && roadmapModalOverlay.hasClass('active')) {
                roadmapModalOverlay.removeClass('active');
                $('body').removeClass('modal-open');
            }
        });
    }

    // --- Search Functionality ---
    const searchInput = $('#searchText');
    const searchResultsDropdown = $('#searchResultsDropdown');

    $('#search').on('submit', function(event) {
        event.preventDefault();
        const searchText = searchInput.val().trim();
        if (searchText) {
            performSearch(searchText);
        } else {
            searchResultsDropdown.removeClass('active');
            searchResultsDropdown.empty();
        }
    });

    // Close search results dropdown when clicking outside
    $(document).on('click', function(event) {
        if (!$(event.target).closest('.header-area .search-input').length &&
            !$(event.target).closest('#searchResultsDropdown').length) {
            searchResultsDropdown.removeClass('active');
        }
    });

    // Close search results dropdown on Escape key
    $(document).on('keydown', function(event) {
        if (event.key === 'Escape' && searchResultsDropdown.hasClass('active')) {
            searchResultsDropdown.removeClass('active');
        }
    });

    // --- Page-specific Content Loading ---
    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === 'index.html' || currentPage === '') {
        fetchAndRenderDeveloperComments('recent-comments-home', 6);
        fetchAndRenderNewsUpdates('news-updates-home', 3);
    } else if (currentPage === 'developer-comments.html') {
        const devCommentsContainer = $('#dev-comments-container');
        const filterAuthorSelect = $('#filterAuthor');
        const filterTagSelect = $('#filterTag');
        const filterDateInput = $('#filterDate');
        const applyFiltersButton = $('#applyFilters');
        const clearFiltersButton = $('#clearFilters');

        async function populateTagsFromSupabase() {
            filterTagSelect.find('option:not(:first)').remove();

            try {
                const { data, error } = await supabase
                    .from('dev_filter_list')
                    .select('tag_name');

                if (error) {
                    console.error('Error fetching tags from Supabase for filters:', error.message);
                    return;
                }

                data.forEach(tag => {
                    filterTagSelect.append(`<option value="${tag.tag_name}">${tag.tag_name}</option>`);
                });

            } catch (e) {
                console.error('Unexpected error during Supabase tag fetch for filters:', e);
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
                const commentTags = $(this).data('tag') ? $(this).data('tag').split(',') : [];
                const commentDate = $(this).data('date');

                const matchesAuthor = selectedAuthor === "" || commentAuthor === selectedAuthor;
                const matchesTag = selectedTag === "" || commentTags.includes(selectedTag);
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

        await fetchAndRenderDeveloperComments('dev-comments-container');

        devCommentsContainer.on('commentsRendered', function() {
            populateAuthorsFromComments();
            applyFilters();
        });

        populateTagsFromSupabase();

        if (devCommentsContainer.children('.dev-comment-item').length > 0) {
            populateAuthorsFromComments();
        }

        applyFiltersButton.on('click', applyFilters);
        clearFiltersButton.on('click', clearFilters);

    } else if (currentPage === 'news-updates.html') {
        fetchAndRenderNewsUpdates('news-updates-container');
    }
});
