// utils.js
export const authorRoleColors = {
  "Developer": "#19d36a",
  "Community Dev": "#00BFFF",
  "Admin": "#3371a6",
  "default": "#E0E0E0"
};

export function formatCommentDateTime(dateString) {
    const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    };
    if (!dateString) return '';
    try {
        return new Date(dateString).toLocaleString('en-US', options);
    } catch (e) {
        console.error('Error formatting comment date time:', dateString, e);
        return '';
    }
}

export function formatNewsDate(dateString) {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    if (!dateString) return '';
    try {
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
        console.error('Error formatting news date:', dateString, e);
        return '';
    }
}

export function slugify(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
}

