// lorePosts.js
import { supabase } from './supabaseClient.js';
import { formatCommentDateTime } from './utils.js'; // Using formatCommentDateTime for consistency

export async function fetchAndRenderLorePosts(containerId, limit = null, searchTerm = null) {
  const container = document.getElementById(containerId);
  if (!container && !searchTerm) return [];

  if (!searchTerm && container) {
    container.innerHTML = '<div class="loading-indicator">Loading lore posts...</div>';
  }

  try {
    let query = supabase
      .from('lore_items')
      .select('*');

    if (searchTerm) {
      query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%`);
    }

    query = query.order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching lore posts:', error.message);
      if (!searchTerm && container) {
        container.innerHTML = '<div class="error-message">Failed to load lore posts. Please try again later.</div>';
      }
      return [];
    }

    if (data.length === 0 && !searchTerm && container) {
      container.innerHTML = '<div class="no-content-message">No lore posts found.</div>';
      return [];
    }

    if (!searchTerm && container) {
      container.innerHTML = '';
      data.forEach(post => {
        const postHtml = `
                        <div class="col-lg-12 mb-4 lore-post-item">
                            <div class="lore-post-content">
                                <h4>${post.title}</h4>
                                <p>${post.content}</p>
                                ${post.tags ? `<p><strong>Tags:</strong> ${Array.isArray(post.tags) ? post.tags.join(', ') : post.tags}</p>` : ''}
                                <span>Published: ${formatCommentDateTime(post.created_at)}</span>
                            </div>
                        </div>
                `;
        container.insertAdjacentHTML('beforeend', postHtml);
      });
    }
    return data;
  } catch (error) {
    console.error('Unexpected error in fetchAndRenderLorePosts:', error);
    if (!searchTerm && container) {
      container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
    }
    return [];
  }
}