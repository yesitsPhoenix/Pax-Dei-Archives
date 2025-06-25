import { supabase } from './supabaseClient.js';
import { formatNewsDate } from './utils.js';

const NEWS_UPDATES_CACHE_KEY = 'paxDeiNewsUpdates';
const NEWS_UPDATES_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function fetchAndRenderNewsUpdates(containerId, limit = null, searchTerm = null) {
  const container = document.getElementById(containerId);
  if (!container && !searchTerm) return [];

  if (!searchTerm && container) {
    container.innerHTML = '<div class="loading-indicator">Loading news...</div>';
  }

  let newsData = [];

  if (!searchTerm && NEWS_UPDATES_CACHE_KEY) {
    const cachedData = localStorage.getItem(NEWS_UPDATES_CACHE_KEY);
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      if (Date.now() - timestamp < NEWS_UPDATES_CACHE_EXPIRY_MS) {
        newsData = data;
      } else {
        localStorage.removeItem(NEWS_UPDATES_CACHE_KEY);
      }
    }
  }

  if (newsData.length === 0 || searchTerm) {
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

      newsData = data || [];

      if (!searchTerm && NEWS_UPDATES_CACHE_KEY && newsData.length > 0) {
        localStorage.setItem(NEWS_UPDATES_CACHE_KEY, JSON.stringify({ data: newsData, timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('Unexpected error in fetchAndRenderNewsUpdates:', error);
      if (!searchTerm && container) {
        container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
      }
      return [];
    }
  }

  if (container) {
    if (newsData.length === 0 && !searchTerm) {
      container.innerHTML = '<div class="no-content-message">No news updates found.</div>';
      return [];
    }
    
    container.innerHTML = ''; 

    newsData.forEach(newsItem => {
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

  return newsData;
}
