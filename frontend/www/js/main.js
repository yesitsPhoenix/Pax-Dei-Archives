import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ---------------------------------------------------------------

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
  // Ensures the date is treated in UTC to avoid local time zone shifts during display
  return new Date(dateString).toLocaleString(undefined, options);
}

// Helper function to format ONLY the date for news updates
function formatNewsDate(dateString) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  if (!dateString) return '';
  // Create a Date object from the date string, then format it to just the date part.
  // Using 'en-US' or a specific locale can give you consistent month names (e.g., 'May 27, 2025')
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', options); 
  // Adding 'T00:00:00' ensures the date string is parsed correctly without timezone issues,
  // then toLocaleDateString formats it without the time.
}


// Function to fetch and render Developer Comments
async function fetchAndRenderDeveloperComments(containerId, limit = null, searchTerm = null) {
    const container = document.getElementById(containerId);
    if (!container && !searchTerm) return; 

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

        // This correctly sorts by most recent first.
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

                const commentHtml = `
                    <div class="${containerId === 'recent-comments-home' ? 'col-lg-6 col-md-6' : 'col-lg-12'}">
                        <div class="${containerId === 'recent-comments-home' ? 'comment-item' : 'comment-full-item'}">
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

// Function to fetch and render News Updates (now accepts searchTerm)
async function fetchAndRenderNewsUpdates(containerId, limit = null, searchTerm = null) {
    const container = document.getElementById(containerId);
    if (!container && !searchTerm) return;

    if (!searchTerm && container) {
        container.innerHTML = '<div class="loading-indicator">Loading news...</div>';
    }

    try {
        let query = supabase
            .from('news_updates')
            .select('*');

        if (searchTerm) {
            // Case-insensitive search across title, summary, and full_article_link
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


// This function combines and renders search results from both tables
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

        // Add comments to results
        comments.forEach(comment => {
            allResults.push({
                type: 'Developer Comment',
                title: comment.title,
                content: comment.content,
                date: comment.comment_date, // Keep full date for sorting
                author: comment.author,
                source: comment.source,
                link: null
            });
        });

        // Add news updates to results
        newsUpdates.forEach(newsItem => {
            allResults.push({
                type: 'News Update',
                title: newsItem.title,
                content: newsItem.summary,
                date: newsItem.news_date, // Keep full date for sorting
                author: null,
                source: newsItem.full_article_link,
                link: newsItem.full_article_link
            });
        });

        // Sort results by date (most recent first)
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

                // Determine which formatting function to use based on item type
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


$(document).ready(function() {
    $('.menu-trigger').on('click', function() {
        $(this).toggleClass('active');
        $('.header-area .nav').toggleClass('active');
    });

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

    // Roadmap Modal Logic
    const roadmapLink = $('#roadmapLink');
    const roadmapModalOverlay = $('#roadmapModalOverlay');
    const closeRoadmapModalButton = $('#closeRoadmapModal');

    if (roadmapLink.length && roadmapModalOverlay.length && closeRoadmapModalButton.length) {
        roadmapLink.on('click', function(event) {
            event.preventDefault();
            roadmapModalOverlay.addClass('active');
            $('body').addClass('modal-open');
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

    // Search form submission handler
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

    // Hide search results dropdown when clicking outside
    $(document).on('click', function(event) {
        if (!$(event.target).closest('.header-area .search-input').length &&
            !$(event.target).closest('#searchResultsDropdown').length) {
            searchResultsDropdown.removeClass('active');
        }
    });

    // Handle pressing Escape key to hide dropdown
    $(document).on('keydown', function(event) {
        if (event.key === 'Escape' && searchResultsDropdown.hasClass('active')) {
            searchResultsDropdown.removeClass('active');
        }
    });


    // --- Dynamic Content Loading based on current page ---
    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === 'index.html' || currentPage === '') {
        fetchAndRenderDeveloperComments('recent-comments-home', 6);
        fetchAndRenderNewsUpdates('news-updates-home', 3);
    } else if (currentPage === 'developer-comments.html') {
        fetchAndRenderDeveloperComments('dev-comments-container');
    } else if (currentPage === 'news-updates.html') {
        fetchAndRenderNewsUpdates('news-updates-container');
    }
});