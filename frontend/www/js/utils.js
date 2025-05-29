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
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString(undefined, options);
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
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', options);
  } catch (e) {
    console.error('Error formatting news date:', dateString, e);
    return '';
  }
}