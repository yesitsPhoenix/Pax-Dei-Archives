const QUART_API_BASE_URL = 'https://homecraftlodge.serveminecraft.net';

const NEWS_LIST_CACHE_KEY = 'paxDeiNewsList';
const NEWS_LIST_CACHE_EXPIRY_MS = 10 * 60 * 1000;

const NEWS_CATEGORIES_CACHE_KEY = 'paxDeiNewsCategories';
const NEWS_CATEGORIES_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function fetchAndRenderNewsCategories(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];

  const cachedData = localStorage.getItem(NEWS_CATEGORIES_CACHE_KEY);
  if (cachedData) {
    const { data, timestamp } = JSON.parse(cachedData);
    if (Date.now() - timestamp < NEWS_CATEGORIES_CACHE_EXPIRY_MS) {
      renderCategoryButtons(container, data);
      return data;
    } else {
      localStorage.removeItem(NEWS_CATEGORIES_CACHE_KEY);
    }
  }

  try {
    const response = await fetch(`${QUART_API_BASE_URL}/news/categories`);
    if (!response.ok) return [];
    const result = await response.json();
    if (result.status === 'success') {
      localStorage.setItem(NEWS_CATEGORIES_CACHE_KEY, JSON.stringify({ data: result.data, timestamp: Date.now() }));
      renderCategoryButtons(container, result.data);
      return result.data;
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function fetchAndRenderNewsUpdates(containerId, limit = null, searchTerm = null, selectedCategory = null) {
  const container = document.getElementById(containerId);
  if (!container && !searchTerm) return [];

  if (!searchTerm && container) {
    container.innerHTML = '<div class="loading-indicator">Loading news...</div>';
  }

  let newsData = [];
  if (!searchTerm && !selectedCategory) {
    const cachedData = sessionStorage.getItem(NEWS_LIST_CACHE_KEY);
    if (cachedData) {
      const parsedCache = JSON.parse(cachedData);
      if (Date.now() - parsedCache.timestamp < NEWS_LIST_CACHE_EXPIRY_MS) {
        newsData = parsedCache.data;
      } else {
        sessionStorage.removeItem(NEWS_LIST_CACHE_KEY);
      }
    }
  }

  if (newsData.length === 0 || searchTerm || selectedCategory) {
    try {
      let url = new URL(`${QUART_API_BASE_URL}/news/items`);
      if (selectedCategory) url.searchParams.append('category', selectedCategory);
      if (searchTerm) url.searchParams.append('searchTerm', searchTerm);
      if (limit) url.searchParams.append('limit', limit);

      const response = await fetch(url.toString());
      if (!response.ok) {
        if (!searchTerm && container) {
          container.innerHTML = '<div class="error-message">Failed to load news. Please try again later.</div>';
        }
        return [];
      }
      const result = await response.json();
      if (result.status === 'success') {
        newsData = result.data;
        if (!searchTerm && !selectedCategory) {
          sessionStorage.setItem(NEWS_LIST_CACHE_KEY, JSON.stringify({ data: newsData, timestamp: Date.now() }));
        }
      } else {
        if (!searchTerm && container) {
          container.innerHTML = '<div class="error-message">Failed to load news. Please try again later.</div>';
        }
        return [];
      }
    } catch (error) {
      if (!searchTerm && container) {
        container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
      }
      return [];
    }
  }

  if (container && !searchTerm) {
    renderNewsItems(container, newsData, containerId);
  }
  return newsData;
}

function renderCategoryButtons(container, categories) {
  container.innerHTML = '';
  if (categories.length === 0) return;
  categories.forEach(category => {
    const button = document.createElement('span');
    button.className = 'category-button';
    button.dataset.category = category;
    button.textContent = category;
    button.addEventListener('click', () => {
      document.querySelectorAll('.category-button').forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');
      document.dispatchEvent(new CustomEvent('newsCategorySelected', { detail: category }));
    });
    container.appendChild(button);
  });
}

function renderNewsItems(container, newsItems, containerId) {
  container.innerHTML = '';
  if (newsItems.length === 0) {
    container.innerHTML = '<div class="no-content-message">No news updates found.</div>';
    return;
  }

  newsItems.forEach(newsItem => {
    const wrapperClass = containerId === 'news-updates-home' ? 'col-lg-4 col-md-6' : 'col-lg-12';
    const newsHtml = `
      <div class="${wrapperClass}">
        <div class="news-item">
          <h6>${newsItem.title}</h6>
          <span>${formatNewsDate(newsItem.news_date)}</span>
          <p>${newsItem.summary}</p>
          ${newsItem.full_article_link ? `<div class="main-button"><a href="${newsItem.full_article_link}" target="_blank" rel="noopener noreferrer">Read More</a></div>` : ''}
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', newsHtml);
  });
}
