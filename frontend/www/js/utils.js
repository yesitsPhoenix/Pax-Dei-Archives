import { supabase } from './supabaseClient.js';

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

// Centralized slugify function
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

// Centralized showFormMessage function
export function showFormMessage(messageElement, message, type) {
    messageElement.textContent = message;
    messageElement.className = '';
    messageElement.style.display = 'none'; // Ensure it's hidden by default

    if (message) {
        messageElement.style.display = 'block';
        messageElement.classList.add('form-message'); // Base class for styling

        if (type === 'success') {
            messageElement.classList.add('success-message'); // Specific success style
            messageElement.classList.add('bg-green-100', 'border-green-400', 'text-green-700', 'px-4', 'py-3', 'rounded', 'mb-4', 'border'); // Tailwind classes for success
        } else if (type === 'error') {
            messageElement.classList.add('error-message'); // Specific error style
            messageElement.classList.add('bg-red-100', 'border-red-400', 'text-red-700', 'px-4', 'py-3', 'rounded', 'mb-4', 'border'); // Tailwind classes for error
        } else if (type === 'info') {
            messageElement.classList.add('info-message'); // Specific info style
            messageElement.classList.add('bg-blue-100', 'border-blue-400', 'text-blue-700', 'px-4', 'py-3', 'rounded', 'mb-4', 'border'); // Tailwind classes for info
        } else if (type === 'warning') {
            messageElement.classList.add('warning-message'); // Specific warning style
            messageElement.classList.add('bg-yellow-100', 'border-yellow-400', 'text-yellow-700', 'px-4', 'py-3', 'rounded', 'mb-4', 'border'); // Tailwind classes for warning
        } else {
             // Default styling if no specific type
            messageElement.classList.add('bg-gray-100', 'border-gray-400', 'text-gray-700', 'px-4', 'py-3', 'rounded', 'mb-4', 'border');
        }

        // Hide message after 5 seconds if it's not empty
        if (message) {
            setTimeout(() => {
                messageElement.style.display = 'none';
                messageElement.textContent = '';
                messageElement.className = ''; // Clear all classes
            }, 5000);
        }
    }
}

export async function isLoggedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getUserProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    return null;
  }

  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('discord_user_id, username, discriminator, avatar_url, created_at, last_login_at')
    .eq('id', user.id)
    .single();

  if (profileError && profileError.code === 'PGRST116') {
    const discordProfile = user.user_metadata;
    if (discordProfile && discordProfile.provider_id) {
      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          discord_user_id: discordProfile.provider_id,
          username: discordProfile.global_name || discordProfile.full_name || discordProfile.user_name || `discord_user_${discordProfile.provider_id}`,
          discriminator: discordProfile.discriminator || '0000',
          avatar_url: discordProfile.avatar_url,
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        return null;
      }
      return newProfile;
    }
  } else if (profileError) {
    return null;
  }

  if (profile) {
    const { error: updateError } = await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
    }
    return profile;
  }
  return null;
}

export async function getDungeonRuns(userId) {
    const { data, error } = await supabase
        .from('dungeon_runs')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

    if (error) {
        console.error('Error fetching dungeon runs:', error);
        return [];
    }
    return data;
}

export async function deleteDungeonRun(runId) {
    const { error } = await supabase
        .from('dungeon_runs')
        .delete()
        .eq('id', runId);

    if (error) {
        console.error('Error deleting dungeon run:', error);
        return false;
    }
    return true;
}

export async function updateDungeonRun(runId, updatedData) {
    const { data, error } = await supabase
        .from('dungeon_runs')
        .update(updatedData)
        .eq('id', runId)
        .select();

    if (error) {
        console.error('Error updating dungeon run:', error);
        return null;
    }
    return data ? data[0] : null;
}
