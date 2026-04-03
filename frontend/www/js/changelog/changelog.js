import { supabase } from '../supabaseClient.js';
import { authSession } from '../authSessionManager.js';
import { formatNewsDate } from '../utils.js';

const CHANGELOG_TABLE = 'site_changelog';

let changelogEntries = [];
let isAdminUser = false;
let tableAvailable = true;

document.addEventListener('DOMContentLoaded', async () => {
  setupFormHandlers();
  await initializeChangelogPage();

  authSession.onChange(async () => {
    await initializeChangelogPage();
  });
});

async function initializeChangelogPage() {
  isAdminUser = await checkIsAdmin();
  syncAdminUi();
  await fetchAndRenderEntries();
}

async function checkIsAdmin() {
  const user = await authSession.getUser();
  if (!user) return false;

  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (error) return false;
    return data?.is_admin === true;
  } catch (error) {
    console.error('Error checking admin access for changelog:', error);
    return false;
  }
}

function syncAdminUi() {
  const adminPanel = document.getElementById('changelogAdminPanel');
  const viewerState = document.getElementById('changelogViewerState');

  if (adminPanel) {
    adminPanel.classList.toggle('hidden', !isAdminUser);
  }

  if (viewerState) {
    viewerState.textContent = isAdminUser ? 'Admin editing enabled' : 'Read-only public view';
  }
}

async function fetchAndRenderEntries() {
  const missingNotice = document.getElementById('changelogMissingTableNotice');
  if (missingNotice) {
    missingNotice.classList.add('hidden');
    missingNotice.textContent = '';
  }

  try {
    const { data, error } = await supabase
      .from(CHANGELOG_TABLE)
      .select('*')
      .order('published_at', { ascending: false });

    if (error) {
      handleTableError(error);
      changelogEntries = [];
    } else {
      tableAvailable = true;
      changelogEntries = Array.isArray(data) ? data : [];
    }
  } catch (error) {
    handleTableError(error);
    changelogEntries = [];
  }

  renderStats();
  renderEntries();
}

function handleTableError(error) {
  console.error('Error loading changelog entries:', error);
  tableAvailable = false;

  const missingNotice = document.getElementById('changelogMissingTableNotice');
  if (!missingNotice) return;

  missingNotice.classList.remove('hidden');
  missingNotice.textContent = isAdminUser
    ? 'The changelog data source is not available yet. Create a Supabase table named "site_changelog" to start publishing entries.'
    : 'The changelog is not available yet. Check back after the first entries are published.';
}

function renderStats() {
  const entryCount = document.getElementById('changelogEntryCount');
  const latestDate = document.getElementById('changelogLatestDate');

  if (entryCount) entryCount.textContent = String(changelogEntries.length);
  if (latestDate) {
    latestDate.textContent = changelogEntries[0]?.published_at
      ? formatNewsDate(changelogEntries[0].published_at)
      : 'No entries';
  }
}

function renderEntries() {
  const entriesContainer = document.getElementById('changelogEntries');
  const emptyState = document.getElementById('changelogEmptyState');
  if (!entriesContainer || !emptyState) return;

  entriesContainer.innerHTML = '';
  emptyState.classList.add('hidden');

  if (!changelogEntries.length) {
    emptyState.classList.remove('hidden');
    emptyState.textContent = tableAvailable
      ? 'No changelog entries have been published yet.'
      : emptyState.textContent || 'No changelog entries are available yet.';
    return;
  }

  entriesContainer.innerHTML = changelogEntries.map(entry => `
    <article class="changelog-entry">
      <div class="changelog-entry-top">
        <div>
          <span class="changelog-entry-date">${escapeHtml(formatNewsDate(entry.published_at || entry.created_at))}</span>
          <h3 class="changelog-entry-title">${escapeHtml(entry.title || 'Untitled Update')}</h3>
        </div>
        ${isAdminUser ? `
          <div class="changelog-entry-actions">
            <button class="changelog-entry-button edit" type="button" data-action="edit" data-id="${entry.id}">
              <i class="fas fa-pen"></i> Edit
            </button>
            <button class="changelog-entry-button delete" type="button" data-action="delete" data-id="${entry.id}">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        ` : ''}
      </div>
      ${entry.summary ? `<p class="changelog-entry-summary">${escapeHtml(entry.summary)}</p>` : ''}
      <div class="changelog-entry-body">${sanitizeMarkdown(entry.content || '')}</div>
    </article>
  `).join('');

  if (isAdminUser) {
    entriesContainer.querySelectorAll('[data-action="edit"]').forEach(button => {
      button.addEventListener('click', () => loadEntryIntoForm(button.dataset.id));
    });

    entriesContainer.querySelectorAll('[data-action="delete"]').forEach(button => {
      button.addEventListener('click', () => deleteEntry(button.dataset.id));
    });
  }
}

function setupFormHandlers() {
  const form = document.getElementById('changelogEntryForm');
  const resetButton = document.getElementById('changelogResetButton');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveEntry();
  });

  resetButton?.addEventListener('click', () => {
    resetForm();
  });
}

async function saveEntry() {
  if (!isAdminUser) {
    showFormMessage('Only admins can edit the changelog.', 'error');
    return;
  }

  if (!tableAvailable) {
    showFormMessage('The changelog table is not available yet.', 'error');
    return;
  }

  const id = document.getElementById('changelogEntryId')?.value.trim();
  const title = document.getElementById('changelogTitle')?.value.trim();
  const summary = document.getElementById('changelogSummary')?.value.trim();
  const publishedAt = document.getElementById('changelogDate')?.value;
  const content = document.getElementById('changelogContent')?.value.trim();

  if (!title || !content) {
    showFormMessage('Title and details are required.', 'error');
    return;
  }

  const user = await authSession.getUser();
  const payload = {
    title,
    summary: summary || null,
    content,
    published_at: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: user?.id || null,
  };

  if (!id) {
    payload.created_by = user?.id || null;
  }

  try {
    let query = supabase.from(CHANGELOG_TABLE);
    const response = id
      ? await query.update(payload).eq('id', id).select().single()
      : await query.insert(payload).select().single();

    if (response.error) throw response.error;

    showFormMessage(id ? 'Changelog entry updated.' : 'Changelog entry published.', 'success');
    resetForm();
    await fetchAndRenderEntries();
  } catch (error) {
    console.error('Error saving changelog entry:', error);
    showFormMessage(error.message || 'Unable to save changelog entry.', 'error');
  }
}

function loadEntryIntoForm(entryId) {
  const entry = changelogEntries.find(item => String(item.id) === String(entryId));
  if (!entry) return;

  document.getElementById('changelogEntryId').value = entry.id || '';
  document.getElementById('changelogTitle').value = entry.title || '';
  document.getElementById('changelogSummary').value = entry.summary || '';
  document.getElementById('changelogContent').value = entry.content || '';
  document.getElementById('changelogDate').value = toDatetimeLocal(entry.published_at || entry.created_at);

  document.getElementById('changelogAdminPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showFormMessage(`Editing "${entry.title || 'entry'}".`, 'success');
}

async function deleteEntry(entryId) {
  if (!isAdminUser || !tableAvailable) return;

  const entry = changelogEntries.find(item => String(item.id) === String(entryId));
  const confirmed = window.confirm(`Delete "${entry?.title || 'this changelog entry'}"?`);
  if (!confirmed) return;

  try {
    const { error } = await supabase.from(CHANGELOG_TABLE).delete().eq('id', entryId);
    if (error) throw error;

    if (document.getElementById('changelogEntryId')?.value === String(entryId)) {
      resetForm();
    }

    await fetchAndRenderEntries();
  } catch (error) {
    console.error('Error deleting changelog entry:', error);
    showFormMessage(error.message || 'Unable to delete changelog entry.', 'error');
  }
}

function resetForm() {
  document.getElementById('changelogEntryForm')?.reset();
  document.getElementById('changelogEntryId').value = '';
  hideFormMessage();
}

function showFormMessage(message, type) {
  const messageEl = document.getElementById('changelogFormMessage');
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.className = `changelog-form-message ${type}`;
  messageEl.classList.remove('hidden');
}

function hideFormMessage() {
  const messageEl = document.getElementById('changelogFormMessage');
  if (!messageEl) return;

  messageEl.className = 'changelog-form-message hidden';
  messageEl.textContent = '';
}

function sanitizeMarkdown(markdownText) {
  const parsed = window.marked ? window.marked.parse(markdownText) : escapeHtml(markdownText);
  return window.DOMPurify ? window.DOMPurify.sanitize(parsed) : parsed;
}

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
