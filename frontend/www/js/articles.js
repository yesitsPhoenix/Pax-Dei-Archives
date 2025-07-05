import { formatCommentDateTime } from './utils.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

const API_BASE_URL = 'https://homecraftlodge.serveminecraft.net';
const ARTICLE_LIST_CACHE_KEY = 'paxDeiArticleList';
const ARTICLE_LIST_CACHE_EXPIRY_MS = 10 * 60 * 1000;
const ARTICLE_CATEGORIES_CACHE_KEY = 'paxDeiArticleCategories';
const ARTICLE_CATEGORIES_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function fetchAndRenderArticleCategories(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];

  const cachedData = localStorage.getItem(ARTICLE_CATEGORIES_CACHE_KEY);
  if (cachedData) {
    const { data, timestamp } = JSON.parse(cachedData);
    if (Date.now() - timestamp < ARTICLE_CATEGORIES_CACHE_EXPIRY_MS) {
      renderCategoryButtons(container, data);
      return data;
    } else {
      localStorage.removeItem(ARTICLE_CATEGORIES_CACHE_KEY);
    }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/articles/categories`);
    const result = await res.json();
    if (result.status !== 'success') return [];
    const categories = result.data;
    localStorage.setItem(ARTICLE_CATEGORIES_CACHE_KEY, JSON.stringify({ data: categories, timestamp: Date.now() }));
    renderCategoryButtons(container, categories);
    return categories;
  } catch {
    return [];
  }
}

export async function fetchAndRenderArticles(containerId, selectedCategory = null, searchTerm = null, limit = null) {
  const container = document.getElementById(containerId);
  if (!container && !searchTerm) return [];

  if (!searchTerm && container) {
    container.innerHTML = '<div class="loading-indicator">Loading articles...</div>';
  }

  let articlesData = [];
  if (!searchTerm && !selectedCategory) {
    const cachedData = sessionStorage.getItem(ARTICLE_LIST_CACHE_KEY);
    if (cachedData) {
      const parsedCache = JSON.parse(cachedData);
      if (Date.now() - parsedCache.timestamp < ARTICLE_LIST_CACHE_EXPIRY_MS) {
        articlesData = parsedCache.data;
      } else {
        sessionStorage.removeItem(ARTICLE_LIST_CACHE_KEY);
      }
    }
  }

  if (articlesData.length === 0 || searchTerm || selectedCategory) {
    try {
      let url = `${API_BASE_URL}/articles/items`;
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (limit) params.append('limit', limit);
      if ([...params].length) url += `?${params.toString()}`;

      const res = await fetch(url);
      const result = await res.json();
      if (result.status !== 'success') return [];
      articlesData = result.data;
      if (!searchTerm && !selectedCategory) {
        sessionStorage.setItem(ARTICLE_LIST_CACHE_KEY, JSON.stringify({ data: articlesData, timestamp: Date.now() }));
      }
    } catch {
      return [];
    }
  }

  if (container && !searchTerm) {
    renderArticleCards(container, articlesData);
  }

  return articlesData;
}

export async function fetchSingleArticle(slug) {
  if (!slug) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/articles/item/${encodeURIComponent(slug)}`);
    const result = await response.json();
    if (result.status === 'success') return result.data;
    return null;
  } catch {
    return null;
  }
}

function renderCategoryButtons(container, categories) {
  container.innerHTML = '';
  if (!categories.length) return;

  categories.forEach(category => {
    const button = $(`<span class="category-button" data-category="${category}">${category}</span>`);
    button.on('click', function() {
      $('.category-button').removeClass('selected');
      $(this).addClass('selected');
      $(document).trigger('articleCategorySelected', category);
    });
    $(container).append(button);
  });
}

function renderArticleCards(container, articles) {
  container.innerHTML = '';
  if (!articles.length) {
    container.innerHTML = '<div class="col-lg-12 no-articles-found"><p>No articles found matching your criteria.</p></div>';
    return;
  }

  articles.forEach(article => {
    const formattedDate = article.publication_date ? formatCommentDateTime(article.publication_date) : 'No Date';
    const articleHtml = `
      <div class="article-card" data-slug="${article.slug}">
        <h4>${article.title}</h4>
        <div class="meta-info">
          <span><i class="fa fa-user"></i> ${article.author || 'Unknown'}</span>
          <span><i class="fa fa-calendar"></i> ${formattedDate}</span>
          ${article.category ? `<span><i class="fa fa-tag"></i> ${article.category}</span>` : ''}
        </div>
        <p>${article.summary || (article.content ? article.content.substring(0, 150) + '...' : '')}</p>
        <div class="main-button">
          <a href="#" class="read-article-link" data-slug="${article.slug}">Read Article</a>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', articleHtml);
  });

  $(container).find('.read-article-link').on('click', function(event) {
    event.preventDefault();
    const slug = $(this).data('slug');
    displayFullArticle(slug);
  });
}

async function displayFullArticle(slug) {
  const article = await fetchSingleArticle(slug);
  if (article) {
    $('#articleModalTitle').text(article.title);
    $('#articleModalAuthor').text(`By ${article.author || 'Unknown'}`);
    $('#articleModalDate').text(article.publication_date ? formatCommentDateTime(article.publication_date) : 'No Date');

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
  }
}

export function setupArticleModalListeners() {
  $('#closeArticleModal').on('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    $('#fullArticleModalOverlay').removeClass('active');
    $('body').removeClass('modal-open');
  });

  $('#fullArticleModalOverlay').on('click', function(e) {
    if ($(e.target).is('#fullArticleModalOverlay')) {
      e.stopPropagation();
      $('#fullArticleModalOverlay').removeClass('active');
      $('body').removeClass('modal-open');
    }
  });

  $(document).on('keydown', function(e) {
    if (e.key === 'Escape' && $('#fullArticleModalOverlay').hasClass('active')) {
      $('#fullArticleModalOverlay').removeClass('active');
      $('body').removeClass('modal-open');
    }
  });
}
