import { supabase } from './supabaseClient.js';
import { formatCommentDateTime } from './utils.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

// Removed client-side cache constants as caching is now handled server-side by Redis.

export async function fetchAndRenderArticleCategories(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('Category select element not found. Cannot populate categories.');
        return [];
    }

    try {
        const response = await fetch('/articles/categories');
        if (!response.ok) {
            console.error('Error fetching article categories from API:', response.statusText);
            return [];
        }
        const result = await response.json();

        if (result.status === 'success') {
            const uniqueCategories = result.data;
            renderCategoryButtons(container, uniqueCategories);
            return uniqueCategories;
        } else {
            console.error('API error fetching article categories:', result.message);
            return [];
        }

    } catch (error) {
        console.error('Unexpected error fetching or rendering article categories:', error);
        return [];
    }
}

function renderCategoryButtons(container, categories) {
    container.innerHTML = '';
    const allButton = document.createElement('button');
    allButton.textContent = 'All Articles';
    allButton.classList.add('category-button', 'active');
    allButton.dataset.category = '';
    container.appendChild(allButton);

    categories.forEach(category => {
        if (category) {
            const button = document.createElement('button');
            button.textContent = category;
            button.classList.add('category-button');
            button.dataset.category = category;
            container.appendChild(button);
        }
    });
}

function renderArticles(container, articles) {
    container.innerHTML = '';
    if (articles.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500">No articles found.</p>';
        return;
    }
    articles.forEach(article => {
        const articleElement = document.createElement('div');
        articleElement.className = 'article-card bg-gray-800 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer';
        articleElement.dataset.articleId = article.id;
        articleElement.innerHTML = `
            <h3 class="text-xl font-semibold text-white mb-2">${article.title}</h3>
            <p class="text-gray-400 text-sm mb-2">${article.category ? `Category: ${article.category}` : 'No Category'}</p>
            <p class="text-gray-300 text-sm italic">${article.publication_date ? new Date(article.publication_date).toLocaleDateString() : 'No Date'}</p>
        `;
        container.appendChild(articleElement);
    });
}

export async function fetchAndRenderArticles(containerId, category = null, searchTerm = '') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('Article container element not found. Cannot render articles.');
        return;
    }

    let apiUrl = '/articles/items';
    const params = new URLSearchParams();
    if (category) {
        params.append('category', category);
    }
    if (searchTerm) {
        params.append('searchTerm', searchTerm);
    }
    if (params.toString()) {
        apiUrl += `?${params.toString()}`;
    }

    try {
        console.log(`Fetching articles from API: ${apiUrl}`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            console.error('Error fetching articles from API:', response.statusText);
            return;
        }
        const result = await response.json();

        if (result.status === 'success') {
            renderArticles(container, result.data);
        } else if (result.status === 'cache_miss') {
            console.log('Cache miss for articles, fetching from Supabase via API...');
            renderArticles(container, result.data); // data will be populated by API after Supabase fetch
        } else {
            console.error('API error fetching articles:', result.message);
        }

    } catch (error) {
        console.error('Unexpected error fetching or rendering articles:', error);
    }
}


export async function showArticleModal(articleId) {
    if (!articleId) {
        console.warn('Article ID not provided. Cannot show article modal.');
        return;
    }

    try {
        const response = await fetch(`/articles/item/${articleId}`);
        if (!response.ok) {
            console.error('Error fetching article details from API:', response.statusText);
            return;
        }
        const result = await response.json();

        if (result.status === 'success') {
            const article = result.data;
            $('#articleModalTitle').text(article.title);
            $('#articleModalCategory').text(article.category ? `Category: ${article.category}` : 'No Category');
            $('#articleModalDate').text(article.publication_date ? new Date(article.publication_date).toLocaleDateString() : 'No Date');

            const markdownHtml = marked.parse(article.content || '');
            const sanitizedHtmlContent = DOMPurify.sanitize(markdownHtml);
            $('#articleModalContent').html(sanitizedHtmlContent);

            const sourceLinkElement = $('#articleModalSourceLink');
            if (article.source && article.source.startsWith('http')) {
                sourceLinkElement.attr('href', article.source).show();
            } else {
                sourceLinkElement.hide();
            }

            $('#fullArticleModalOverlay').addClass('active');
            $('body').addClass('modal-open');
        } else if (result.status === 'not_found') {
            console.warn(`Article with ID '${articleId}' not found on server.`);
        } else {
            console.error('API error fetching article details:', result.message);
        }
    } catch (error) {
        console.error('Unexpected error fetching or showing article modal:', error);
    }
}

export function setupArticleModalListeners() {
    $('#closeArticleModal').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        $('#fullArticleModalOverlay').removeClass('active');
        $('body').removeClass('modal-open');
    });

    $('#fullArticleModalOverlay').on('click', function(event) {
        if ($(event.target).is('#fullArticleModalOverlay')) {
            event.stopPropagation();
            $('#fullArticleModalOverlay').removeClass('active');
            $('body').removeClass('modal-open');
        }
    });

    $(document).on('keydown', function(event) {
        if (event.key === 'Escape' && $('#fullArticleModalOverlay').hasClass('active')) {
            $('#fullArticleModalOverlay').removeClass('active');
            $('body').removeClass('modal-open');
        }
    });
}