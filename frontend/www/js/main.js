import { supabase } from './supabaseClient.js';
import { formatCommentDateTime, formatNewsDate } from './utils.js';
import { fetchAndRenderDeveloperComments } from './devComments.js';
import { fetchAndRenderNewsUpdates } from './newsUpdates.js';
import { fetchAndRenderLorePosts } from './lorePosts.js';
import { fetchAndRenderArticles, handleArticlePageLogic } from './articles/articles.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

const TAG_LIST_CACHE_KEY = 'paxDeiTagList';
const TAG_LIST_CACHE_EXPIRY_MS = 10 * 1000; 
const DEV_COMMENTS_CACHE_KEY = 'paxDeiDevComments';
const DEV_COMMENTS_CACHE_EXPIRY_MS = 5 * 60 * 1000;

function normalizeAbilityNameForHash(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
}

async function fetchAbilitiesForSearch(searchTerm) {
    if (!searchTerm) return [];
    try {
        const { data: abilitiesByName } = await supabase
            .from('abilities')
            .select('*')
            .ilike('name', `%${searchTerm}%`);

        const { data: abilitiesByDescription } = await supabase
            .from('abilities')
            .select('*')
            .ilike('description', `%${searchTerm}%`);

        const combinedAbilitiesMap = new Map();
        (abilitiesByName || []).forEach(ability => combinedAbilitiesMap.set(ability.name, ability));
        (abilitiesByDescription || []).forEach(ability => combinedAbilitiesMap.set(ability.name, ability));

        return Array.from(combinedAbilitiesMap.values());
    } catch (e) {
        console.error(e);
        return [];
    }
}

async function performSearch(searchTerm) {
    const searchResultsDropdown = $('#searchResultsDropdown');
    searchResultsDropdown.html('<div class="search-loading-indicator">Searching...</div>');
    searchResultsDropdown.addClass('active');

    try {
        const [comments, newsUpdates, lorePosts, articles, abilities] = await Promise.all([
            fetchAndRenderDeveloperComments(null, null, searchTerm),
            fetchAndRenderNewsUpdates(null, null, searchTerm),
            fetchAndRenderLorePosts(null, null, searchTerm),
            fetchAndRenderArticles(null, searchTerm),
            fetchAbilitiesForSearch(searchTerm)
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

        articles.forEach(article => {
            const articleLink = `articles.html?item=${encodeURIComponent(article.slug)}`;
            allResults.push({
                type: 'Article',
                title: article.title,
                content: article.summary || article.content,
                date: article.publication_date,
                author: article.author,
                source: article.source,
                link: articleLink
            });
        });

        abilities.forEach(ability => {
            const abilityLink = `abilities.html#${normalizeAbilityNameForHash(ability.name)}`;
            allResults.push({
                type: 'Ability',
                title: ability.name,
                content: ability.description,
                date: null,
                author: null,
                source: null,
                link: abilityLink
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
                        sourceDisplay = `<a href="${item.source}" target="_blank" rel="noopener noreferrer" class="source-link-button"><i class="fas fa-external-link-alt"></i> Source</a>`;
                    } else {
                        sourceDisplay = `<span class="comment-source">Source: ${item.source}</span>`;
                    }
                }

                const formattedDateForDisplay = item.date ?
                    (item.type === 'Developer Comment' ? formatCommentDateTime(item.date) :
                        (item.type === 'News Update' || item.type === 'Article' ? formatNewsDate(item.date) : '')) : '';

                const mainLink = item.link ? item.link : '#';
                let displayedContent = item.content;
                if ((item.type === 'Lore Post' || item.type === 'Ability') && typeof marked !== 'undefined') {
                    const contentString = item.content ?? ''; 
                    const snippet = contentString.length > 200 ? contentString.substring(0, 200) + '...' : contentString;
                    displayedContent = marked.parse(snippet);
                } else if (item.type === 'News Update' || item.type === 'Article') {
                    const contentString = item.content ?? '';
                    displayedContent = contentString.length > 200 ? contentString.substring(0, 200) + '...' : contentString;
                }
                const titleDisplay = item.title ? item.title : '';
                const authorPrefix = item.type === 'Developer Comment' && item.author ? item.author + ' - ' : '';
                const dateSuffix = formattedDateForDisplay ? `<span class="date">${formattedDateForDisplay}</span>` : '';

                let headingContent;
                if (item.type === 'Developer Comment') {
                    headingContent = `${authorPrefix}${dateSuffix}`;
                } else if (item.type === 'Article') {
                    headingContent = `${item.title} - ${item.author || 'Unknown'} ${dateSuffix}`;
                } else if (item.type === 'Ability') {
                    headingContent = `${item.title}`;
                } else {
                    headingContent = `${titleDisplay} ${dateSuffix}`;
                }

                const resultHtml = `
                    <div class="search-result-item ${item.type.toLowerCase().replace(/\s/g, '-')}-item">
                        <div class="down-content">
                            ${item.link ? `<h6><a href="${mainLink}">${headingContent}</a></h6>` : `<h6>${headingContent}</h6>`}
                            <p>${displayedContent}</p> ${sourceDisplay ? sourceDisplay : ''}
                            ${item.link && (['News Update', 'Lore Post', 'Article', 'Ability'].includes(item.type)) ? `<div class="main-button"><a href="${mainLink}" ${item.type === 'News Update' || item.type === 'Article' ? 'target="_blank"' : ''}>Read More</a></div>` : ''}
                        </div>
                    </div>`;
                searchResultsDropdown.append(resultHtml);
            });
        }
    } catch (error) {
        console.error(error);
        searchResultsDropdown.html('<div class="search-error-message">An error occurred during search.</div>');
    }
}

$(document).ready(async function() {
    const utcClockDisplay = document.getElementById('utc-clock-display');
    if (utcClockDisplay) {
        updateUtcClock(utcClockDisplay);
        setInterval(() => updateUtcClock(utcClockDisplay), 1000);
    }
    
    $('.menu-trigger').on('click', function() {
        $(this).toggleClass('active');
        $('.header-area .nav').toggleClass('active');
    });

    $('a[href*="#"]:not([href="#"])').on('click', function() {
        if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
            var target = $(this.hash);
            target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
            if (target.length) {
                $('html, body').animate({ scrollTop: target.offset().top - 80 }, 1000);
                return false;
            }
        }
    });

    const searchInput = $('#searchText');
    const searchResultsDropdown = $('#searchResultsDropdown');

    if (searchInput.length) {
        searchInput.on('input', function() {
            const searchTerm = $(this).val().trim();
            if (searchTerm.length >= 3) performSearch(searchTerm);
            else searchResultsDropdown.empty().removeClass('active');
        });
    }

    $('#search').on('submit', function(event) {
        event.preventDefault();
        const searchText = searchInput.val().trim();
        if (searchText) performSearch(searchText);
    });

    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === 'index.html' || currentPage === '') {
        fetchAndRenderDeveloperComments('recent-comments-home', 9);
        fetchAndRenderNewsUpdates('news-updates-home', 3);
    } else if (currentPage === 'developer-comments.html') {
        const devCommentsContainer = $('#dev-comments-container');
        const filterTagContainer = $('#filterTagContainer');

        async function populateTags() {
            const cachedData = localStorage.getItem(TAG_LIST_CACHE_KEY);
            if (cachedData) {
                const { data, timestamp } = JSON.parse(cachedData);
                if (Date.now() - timestamp < TAG_LIST_CACHE_EXPIRY_MS) {
                    renderTags(data);
                    return;
                }
            }
            const { data } = await supabase.from('tag_list').select('tag_name');
            if (data) {
                data.sort((a, b) => a.tag_name.localeCompare(b.tag_name));
                localStorage.setItem(TAG_LIST_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
                renderTags(data);
            }
        }

        function renderTags(tags) {
            tags.forEach(tag => {
                const tagElement = $(`<span class="tag-button">${tag.tag_name}</span>`);
                tagElement.on('click', function() {
                    $(this).toggleClass('selected');
                    applyFilters();
                });
                filterTagContainer.append(tagElement);
            });
        }

        function applyFilters() {
            const selectedAuthor = $('#filterAuthor').val();
            const selectedDate = $('#filterDate').val();
            const selectedTags = [];
            $('#filterTagContainer .tag-button.selected').each(function() { selectedTags.push($(this).text()); });

            devCommentsContainer.children('.dev-comment-item').each(function() {
                const authorMatch = selectedAuthor === "" || $(this).data('author') === selectedAuthor;
                const dateMatch = selectedDate === "" || $(this).data('date') === selectedDate;
                const tagMatch = selectedTags.length === 0 || selectedTags.every(tag => ($(this).data('tag') || []).includes(tag));
                $(this).toggle(authorMatch && dateMatch && tagMatch);
            });
        }

        await fetchAndRenderDeveloperComments('dev-comments-container', null, null, DEV_COMMENTS_CACHE_KEY, DEV_COMMENTS_CACHE_EXPIRY_MS);
        populateTags();
        $('#applyFilters').on('click', applyFilters);
        $('#clearFilters').on('click', () => {
            $('#filterAuthor, #filterDate').val('');
            $('.tag-button').removeClass('selected');
            devCommentsContainer.children('.dev-comment-item').show();
        });
    } else if (currentPage === 'news-updates.html') {
        fetchAndRenderNewsUpdates('news-updates-container');
    } else if (currentPage === 'articles.html') {
        handleArticlePageLogic();
    }
});

export const updateUtcClock = (element) => {
    if (!element) return;
    const now = new Date();
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const minutes = now.getUTCMinutes().toString().padStart(2, '0');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    element.textContent = `${monthNames[now.getUTCMonth()]} ${now.getUTCDate()}, ${hours}:${minutes} UTC`;
};