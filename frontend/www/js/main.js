import { supabase } from './supabaseClient.js';
import { formatCommentDateTime, formatNewsDate } from './utils.js';
import { fetchAndRenderDeveloperComments } from './devComments.js';
import { fetchAndRenderNewsUpdates } from './newsUpdates.js';
import { fetchAndRenderLorePosts } from './lorePosts.js';

function showFormMessage(messageElement, message, type) {
    messageElement.textContent = message;
    messageElement.className = '';
    if (type) {
        messageElement.classList.add('form-message', type);
        messageElement.style.display = 'block';

        if (message) {
            setTimeout(() => {
                messageElement.style.display = 'none';
                messageElement.textContent = '';
            }, 5000);
        }
    } else {
        messageElement.style.display = 'none';
        messageElement.textContent = '';
    }
}

async function performSearch(searchTerm) {
    const searchResultsDropdown = $('#searchResultsDropdown');
    searchResultsDropdown.html('<div class="search-loading-indicator">Searching...</div>');
    searchResultsDropdown.addClass('active');

    try {
        const [comments, newsUpdates, lorePosts] = await Promise.all([
            fetchAndRenderDeveloperComments(null, null, searchTerm),
            fetchAndRenderNewsUpdates(null, null, searchTerm),
            fetchAndRenderLorePosts(null, null, searchTerm)
        ]);

        const allResults = [];

        comments.forEach(comment => {
            allResults.push({
                type: 'Developer Comment',
                title: null,
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

        lorePosts.forEach(post => {
            const loreItemLink = `lore.html?category=${encodeURIComponent(post.category)}&item=${encodeURIComponent(post.slug)}`;
            allResults.push({
                type: 'Lore Post',
                title: post.title,
                content: post.content,
                date: null,
                author: null,
                source: null,
                link: loreItemLink
            });
        });

        allResults.sort((a, b) => {
            const dateA = a.date ? new Date(a.date) : new Date(0);
            const dateB = b.date ? new Date(b.date) : new Date(0);
            return dateB - dateA;
        });

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

                const formattedDateForDisplay = item.date && item.type !== 'Lore Post' ?
                    (item.type === 'Developer Comment' ? formatCommentDateTime(item.date) :
                        (item.type === 'News Update' ? formatNewsDate(item.date) : '')) : '';


                const mainLink = item.link ? item.link : '#';

                let displayedContent = item.content;
                if (item.type === 'Lore Post' && typeof marked !== 'undefined') {
                    const snippetLength = 200;
                    let snippet = item.content.substring(0, snippetLength);
                    if (item.content.length > snippetLength) {
                        snippet += '...';
                    }
                    displayedContent = marked.parse(snippet);
                } else if (item.type === 'News Update') {
                    const snippetLength = 200;
                    let snippet = item.content.substring(0, snippetLength);
                    if (item.content.length > snippetLength) {
                        snippet += '...';
                    }
                    displayedContent = snippet;
                }

                const titleDisplay = item.title ? item.title : '';
                const authorPrefix = item.type === 'Developer Comment' && item.author ? item.author + ' - ' : '';
                const dateSuffix = formattedDateForDisplay ? `<span class="date">${formattedDateForDisplay}</span>` : '';

                let headingContent;
                if (item.type === 'Developer Comment') {
                    headingContent = `${authorPrefix}${dateSuffix}`;
                } else {
                    headingContent = `${titleDisplay} ${dateSuffix}`;
                }


                const resultHtml = `
                                <div class="search-result-item ${item.type.toLowerCase().replace(/\s/g, '-')}-item">
                                    <div class="down-content">
                                        ${item.link ? `<h6><a href="${mainLink}">${headingContent}</a></h6>` : `<h6>${headingContent}</h6>`}
                                        <p>${displayedContent}</p> ${sourceDisplay ? sourceDisplay : ''}
                                        ${item.link && (item.type === 'News Update' || item.type === 'Lore Post') ? `<div class="main-button"><a href="${mainLink}" ${item.type === 'News Update' ? 'target="_blank"' : ''}>Read More</a></div>` : ''}
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
    $('.menu-trigger').on('click', function() {
        $(this).toggleClass('active');
        $('.header-area .nav').toggleClass('active');
    });

    $('a[href*="#"]:not([href="#"])').on('click', function() {
        if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
            var target = $(this.hash);
            target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
            if (target.length) {
                $('html, body').animate({
                    scrollTop: target.offset().top - 80
                }, 1000);
                return false;
            }
        }
    });

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

    const searchInput = $('#searchText');
    const searchResultsDropdown = $('#searchResultsDropdown');
    const searchForm = $('#search');

    if (searchInput.length) {
        searchInput.on('input', function() {
            const searchTerm = $(this).val().trim();
            if (searchTerm.length >= 3) {
                performSearch(searchTerm);
            } else {
                searchResultsDropdown.empty().removeClass('active');
            }
        });
    }

    if (searchForm.length) {
        searchForm.on('submit', function(event) {
            event.preventDefault();
            const searchText = searchInput.val().trim();
            if (searchText) {
                performSearch(searchText);
            } else {
                searchResultsDropdown.removeClass('active');
                searchResultsDropdown.empty();
            }
        });
    }

    $(document).on('click', function(event) {
        if (!$(event.target).closest('.header-area .search-input').length &&
            !$(event.target).closest('#searchResultsDropdown').length) {
            searchResultsDropdown.removeClass('active');
        }
    });

    $(document).on('keydown', function(event) {
        if (event.key === 'Escape' && searchResultsDropdown.hasClass('active')) {
            searchResultsDropdown.removeClass('active');
        }
    });

    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === 'index.html' || currentPage === '') {
        fetchAndRenderDeveloperComments('recent-comments-home', 6);
        fetchAndRenderNewsUpdates('news-updates-home', 3);
    } else if (currentPage === 'developer-comments.html') {
        const devCommentsContainer = $('#dev-comments-container');
        const filterAuthorSelect = $('#filterAuthor');

        const filterTagContainer = $('#filterTagContainer');
        const filterDateInput = $('#filterDate');
        const applyFiltersButton = $('#applyFilters');
        const clearFiltersButton = $('#clearFilters');

        async function populateTagsFromSupabase() {
            filterTagContainer.empty();

            try {
                const { data, error } = await supabase
                    .from('tag_list')
                    .select('tag_name');

                if (error) {
                    console.error('Error fetching tags from Supabase for filters:', error.message);
                    return;
                }

                data.sort((a, b) => a.tag_name.localeCompare(b.tag_name));

                data.forEach(tag => {
                    const tagElement = $(`<span class="tag-button">${tag.tag_name}</span>`);
                    tagElement.on('click', function() {
                        $(this).toggleClass('selected');
                        applyFilters();
                    });
                    filterTagContainer.append(tagElement);
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
    const selectedDate = filterDateInput.val();
    const selectedTags = [];
    $('#filterTagContainer .tag-button.selected').each(function() {
        selectedTags.push($(this).text());
    });

    let commentsFound = false;

    devCommentsContainer.children('.dev-comment-item').each(function() {
        const commentAuthor = $(this).data('author');
        const commentTags = $(this).data('tag') || []; 
        const commentDate = $(this).data('date');

        const matchesAuthor = selectedAuthor === "" || commentAuthor === selectedAuthor;
        const matchesDate = selectedDate === "" || commentDate === selectedDate;


        const matchesTag = selectedTags.length === 0 || selectedTags.every(tag => commentTags.includes(tag));

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
            filterDateInput.val('');
            $('#filterTagContainer .tag-button').removeClass('selected');

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

// import { supabase } from './supabaseClient.js';
// import { formatCommentDateTime, formatNewsDate } from './utils.js';
// import { fetchAndRenderDeveloperComments } from './devComments.js';
// import { fetchAndRenderNewsUpdates } from './newsUpdates.js';
// import { fetchAndRenderLorePosts } from './lorePosts.js';


// const TAG_LIST_CACHE_KEY = 'paxDeiTagList';
// const TAG_LIST_CACHE_EXPIRY_MS = 10 * 60 * 1000;

// const DEV_COMMENTS_CACHE_KEY = 'paxDeiDevComments';
// const DEV_COMMENTS_CACHE_EXPIRY_MS = 5 * 60 * 1000;

// function showFormMessage(messageElement, message, type) {
//     messageElement.textContent = message;
//     messageElement.className = '';
//     if (type) {
//         messageElement.classList.add('form-message', type);
//         messageElement.style.display = 'block';

//         if (message) {
//             setTimeout(() => {
//                 messageElement.style.display = 'none';
//                 messageElement.textContent = '';
//             }, 5000);
//         }
//     } else {
//         messageElement.style.display = 'none';
//         messageElement.textContent = '';
//     }
// }

// async function performSearch(searchTerm) {
//     const searchResultsDropdown = $('#searchResultsDropdown');
//     searchResultsDropdown.html('<div class="search-loading-indicator">Searching...</div>');
//     searchResultsDropdown.addClass('active');

//     try {
//         const [comments, newsUpdates, lorePosts] = await Promise.all([
//             fetchAndRenderDeveloperComments(null, null, searchTerm),
//             fetchAndRenderNewsUpdates(null, null, searchTerm),
//             fetchAndRenderLorePosts(null, null, searchTerm)
//         ]);

//         const allResults = [];

//         comments.forEach(comment => {
//             allResults.push({
//                 type: 'Developer Comment',
//                 title: null,
//                 content: comment.content,
//                 date: comment.comment_date,
//                 author: comment.author,
//                 source: comment.source,
//                 link: null
//             });
//         });

//         newsUpdates.forEach(newsItem => {
//             allResults.push({
//                 type: 'News Update',
//                 title: newsItem.title,
//                 content: newsItem.summary,
//                 date: newsItem.news_date,
//                 author: null,
//                 source: newsItem.full_article_link,
//                 link: newsItem.full_article_link
//             });
//         });

//         lorePosts.forEach(post => {
//             const loreItemLink = `lore.html?category=${encodeURIComponent(post.category)}&item=${encodeURIComponent(post.slug)}`;
//             allResults.push({
//                 type: 'Lore Post',
//                 title: post.title,
//                 content: post.content,
//                 date: null,
//                 author: null,
//                 source: null,
//                 link: loreItemLink
//             });
//         });

//         allResults.sort((a, b) => {
//             const dateA = a.date ? new Date(a.date) : new Date(0);
//             const dateB = b.date ? new Date(b.date) : new Date(0);
//             return dateB - dateA;
//         });

//         if (allResults.length === 0) {
//             searchResultsDropdown.html('<div class="no-results-message">No results found for your search.</div>');
//         } else {
//             searchResultsDropdown.empty();
//             allResults.forEach(item => {
//                 let sourceDisplay = '';
//                 if (item.source) {
//                     const urlPattern = /^(https?:\/\/[^\s]+)$/i;
//                     if (urlPattern.test(item.source)) {
//                         sourceDisplay = `
//                                 <a href="${item.source}" target="_blank" rel="noopener noreferrer" class="source-link-button">
//                                     <i class="fas fa-external-link-alt"></i> Source
//                                 </a>
//                             `;
//                     } else {
//                         sourceDisplay = `<span class="comment-source">Source: ${item.source}</span>`;
//                     }
//                 }

//                 const formattedDateForDisplay = item.date && item.type !== 'Lore Post' ?
//                     (item.type === 'Developer Comment' ? formatCommentDateTime(item.date) :
//                         (item.type === 'News Update' ? formatNewsDate(item.date) : '')) : '';


//                 const mainLink = item.link ? item.link : '#';

//                 let displayedContent = item.content;
//                 if (item.type === 'Lore Post' && typeof marked !== 'undefined') {
//                     const snippetLength = 200;
//                     let snippet = item.content.substring(0, snippetLength);
//                     if (item.content.length > snippetLength) {
//                         snippet += '...';
//                     }
//                     displayedContent = marked.parse(snippet);
//                 } else if (item.type === 'News Update') {
//                     const snippetLength = 200;
//                     let snippet = item.content.substring(0, snippetLength);
//                     if (item.content.length > snippetLength) {
//                         snippet += '...';
//                     }
//                     displayedContent = snippet;
//                 }

//                 const titleDisplay = item.title ? item.title : '';
//                 const authorPrefix = item.type === 'Developer Comment' && item.author ? item.author + ' - ' : '';
//                 const dateSuffix = formattedDateForDisplay ? `<span class="date">${formattedDateForDisplay}</span>` : '';

//                 let headingContent;
//                 if (item.type === 'Developer Comment') {
//                     headingContent = `${authorPrefix}${dateSuffix}`;
//                 } else {
//                     headingContent = `${titleDisplay} ${dateSuffix}`;
//                 }


//                 const resultHtml = `
//                                 <div class="search-result-item ${item.type.toLowerCase().replace(/\s/g, '-')}-item">
//                                     <div class="down-content">
//                                         ${item.link ? `<h6><a href="${mainLink}">${headingContent}</a></h6>` : `<h6>${headingContent}</h6>`}
//                                         <p>${displayedContent}</p> ${sourceDisplay ? sourceDisplay : ''}
//                                         ${item.link && (item.type === 'News Update' || item.type === 'Lore Post') ? `<div class="main-button"><a href="${mainLink}" ${item.type === 'News Update' ? 'target="_blank"' : ''}>Read More</a></div>` : ''}
//                                     </div>
//                                 </div>
//                             `;
//                 searchResultsDropdown.append(resultHtml);
//             });
//         }

//     } catch (error) {
//         console.error('Error during search:', error);
//         searchResultsDropdown.html('<div class="search-error-message">An error occurred during search. Please try again.</div>');
//     }
// }

// $(document).ready(async function() {
//     $('.menu-trigger').on('click', function() {
//         $(this).toggleClass('active');
//         $('.header-area .nav').toggleClass('active');
//     });

//     $('a[href*="#"]:not([href="#"])').on('click', function() {
//         if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
//             var target = $(this.hash);
//             target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
//             if (target.length) {
//                 $('html, body').animate({
//                     scrollTop: target.offset().top - 80
//                 }, 1000);
//                 return false;
//             }
//         }
//     });

//     const roadmapLink = $('#roadmapLink');
//     const roadmapModalOverlay = $('#roadmapModalOverlay');
//     const closeRoadmapModalButton = $('#closeRoadmapModal');

//     if (roadmapLink.length && roadmapModalOverlay.length && closeRoadmapModalButton.length) {
//         roadmapLink.on('click', function(event) {
//             event.preventDefault();
//             roadmapModalOverlay.addClass('active');
//             $('body').addClass('modal-open');
//         });

//         closeRoadmapModalButton.on('click', function(event) {
//             event.preventDefault();
//             event.stopPropagation();
//             roadmapModalOverlay.removeClass('active');
//             $('body').removeClass('modal-open');
//         });

//         roadmapModalOverlay.on('click', function(event) {
//             if ($(event.target).is(roadmapModalOverlay)) {
//                 event.stopPropagation();
//                 roadmapModalOverlay.removeClass('active');
//                 $('body').removeClass('modal-open');
//             }
//         });

//         $(document).on('keydown', function(event) {
//             if (event.key === 'Escape' && roadmapModalOverlay.hasClass('active')) {
//                 roadmapModalOverlay.removeClass('active');
//                 $('body').removeClass('modal-open');
//             }
//         });
//     }

//     const searchInput = $('#searchText');
//     const searchResultsDropdown = $('#searchResultsDropdown');
//     const searchForm = $('#search');

//     if (searchInput.length) {
//         searchInput.on('input', function() {
//             const searchTerm = $(this).val().trim();
//             if (searchTerm.length >= 3) {
//                 performSearch(searchTerm);
//             } else {
//                 searchResultsDropdown.empty().removeClass('active');
//             }
//         });
//     }

//     if (searchForm.length) {
//         searchForm.on('submit', function(event) {
//             event.preventDefault();
//             const searchText = searchInput.val().trim();
//             if (searchText) {
//                 performSearch(searchText);
//             } else {
//                 searchResultsDropdown.removeClass('active');
//                 searchResultsDropdown.empty();
//             }
//         });
//     }

//     $(document).on('click', function(event) {
//         if (!$(event.target).closest('.header-area .search-input').length &&
//             !$(event.target).closest('#searchResultsDropdown').length) {
//             searchResultsDropdown.removeClass('active');
//         }
//     });

//     $(document).on('keydown', function(event) {
//         if (event.key === 'Escape' && searchResultsDropdown.hasClass('active')) {
//             searchResultsDropdown.removeClass('active');
//         }
//     });

//     const currentPage = window.location.pathname.split('/').pop();

//     if (currentPage === 'index.html' || currentPage === '') {
//         fetchAndRenderDeveloperComments('recent-comments-home', 6);
//         fetchAndRenderNewsUpdates('news-updates-home', 3);
//     } else if (currentPage === 'developer-comments.html') {
//         const devCommentsContainer = $('#dev-comments-container');
//         const filterAuthorSelect = $('#filterAuthor');

//         const filterTagContainer = $('#filterTagContainer');
//         const filterDateInput = $('#filterDate');
//         const applyFiltersButton = $('#applyFilters');
//         const clearFiltersButton = $('#clearFilters');

//         async function populateTagsFromSupabase() {
//             filterTagContainer.empty();

//             const cachedData = localStorage.getItem(TAG_LIST_CACHE_KEY);
//             if (cachedData) {
//                 const { data, timestamp } = JSON.parse(cachedData);
//                 if (Date.now() - timestamp < TAG_LIST_CACHE_EXPIRY_MS) {
//                     console.log("Fetching tag_list from local storage cache.");
//                     renderTags(data);
//                     return;
//                 } else {
//                     console.log("Cached tag_list expired, refetching.");
//                     localStorage.removeItem(TAG_LIST_CACHE_KEY);
//                 }
//             }

//             console.log("Fetching tag_list from Supabase.");
//             try {
//                 const { data, error } = await supabase
//                     .from('tag_list')
//                     .select('tag_name');

//                 if (error) {
//                     console.error('Error fetching tags from Supabase for filters:', error.message);
//                     return;
//                 }

//                 data.sort((a, b) => a.tag_name.localeCompare(b.tag_name));
//                 localStorage.setItem(TAG_LIST_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
//                 renderTags(data);

//             } catch (e) {
//                 console.error('Unexpected error during Supabase tag fetch for filters:', e);
//             }
//         }

//         function renderTags(tags) {
//             tags.forEach(tag => {
//                 const tagElement = $(`<span class="tag-button">${tag.tag_name}</span>`);
//                 tagElement.on('click', function() {
//                     $(this).toggleClass('selected');
//                     applyFilters();
//                 });
//                 filterTagContainer.append(tagElement);
//             });
//         }


//         function populateAuthorsFromComments() {
//             filterAuthorSelect.find('option:not(:first)').remove();
//             const authors = new Set();

//             devCommentsContainer.children('.dev-comment-item').each(function() {
//                 const author = $(this).data('author');
//                 if (author) authors.add(author);
//             });

//             Array.from(authors).sort().forEach(author => {
//                 filterAuthorSelect.append(`<option value="${author}">${author}</option>`);
//             });
//         }

//         function applyFilters() {
//             const selectedAuthor = filterAuthorSelect.val();
//             const selectedDate = filterDateInput.val();
//             const selectedTags = [];
//             $('#filterTagContainer .tag-button.selected').each(function() {
//                 selectedTags.push($(this).text());
//             });

//             let commentsFound = false;

//             devCommentsContainer.children('.dev-comment-item').each(function() {
//                 const commentAuthor = $(this).data('author');
//                 const commentTags = $(this).data('tag') || [];
//                 const commentDate = $(this).data('date');

//                 const matchesAuthor = selectedAuthor === "" || commentAuthor === selectedAuthor;
//                 const matchesDate = selectedDate === "" || commentDate === selectedDate;

//                 const matchesTag = selectedTags.length === 0 || selectedTags.every(tag => commentTags.includes(tag));

//                 if (matchesAuthor && matchesTag && matchesDate) {
//                     $(this).show();
//                     commentsFound = true;
//                 } else {
//                     $(this).hide();
//                 }
//             });

//             const noCommentsMessage = devCommentsContainer.find('.no-comments-found');
//             if (!commentsFound) {
//                 if (noCommentsMessage.length === 0) {
//                     devCommentsContainer.append('<div class="col-lg-12 no-comments-found"><p class="text-center text-white-50">No comments found matching your filters.</p></div>');
//                 } else {
//                     noCommentsMessage.show();
//                 }
//             } else {
//                 noCommentsMessage.hide();
//             }
//         }

//         function clearFilters() {
//             filterAuthorSelect.val('');
//             filterDateInput.val('');
//             $('#filterTagContainer .tag-button').removeClass('selected');

//             devCommentsContainer.children('.dev-comment-item').show();
//             devCommentsContainer.find('.no-comments-found').hide();
//         }

//         await fetchAndRenderDeveloperComments('dev-comments-container', null, null, DEV_COMMENTS_CACHE_KEY, DEV_COMMENTS_CACHE_EXPIRY_MS);

//         devCommentsContainer.on('commentsRendered', function() {
//             populateAuthorsFromComments();
//             applyFilters();
//         });

//         populateTagsFromSupabase();

//         applyFiltersButton.on('click', applyFilters);
//         clearFiltersButton.on('click', clearFilters);

//     } else if (currentPage === 'news-updates.html') {

//         fetchAndRenderNewsUpdates('news-updates-container');
//     }
// });