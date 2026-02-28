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
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching user profile:', profileError);
    return null;
  }

  // New user — no row yet, create one from Discord OAuth metadata
  if (!profile) {
    const meta = user.user_metadata || {};
    const newUser = {
      id: user.id,
      discord_user_id: meta.provider_id || meta.sub || null,
      username: meta.full_name || meta.name || meta.global_name || 'Unknown',
      discriminator: meta.custom_claims?.discriminator || meta.discriminator || '0',
      avatar_url: meta.avatar_url || meta.picture || null,
    };

    const { data: created, error: createError } = await supabase
      .from('users')
      .insert(newUser)
      .select('discord_user_id, username, discriminator, avatar_url, created_at, last_login_at')
      .single();

    if (createError) {
      console.error('Error creating user profile:', createError);
      return null;
    }

    console.log('[getUserProfile] New user profile created:', created);
    return created;
  }

  return profile;
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

export const updateUtcClock = (element) => {
    if (!element) return;
    const now = new Date();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const minutes = now.getUTCMinutes().toString().padStart(2, '0');
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    element.textContent = `${monthNames[month]} ${day}, ${hours}:${minutes} UTC`;
};

    const utcClockDisplay = document.getElementById('utc-clock-display');
        if (utcClockDisplay) {
            updateUtcClock(utcClockDisplay);
            setInterval(() => updateUtcClock(utcClockDisplay), 1000);
        }
        
        if (typeof $ !== 'undefined') {
            $('.menu-trigger').on('click', function() {
                $(this).toggleClass('active');
                $('.header-area .nav').toggleClass('active');
            });
        
            $('a[href*="#"]:not([href="#"])').on('click', function() {
                if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
                    var target = $(this.hash);
                    target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
                    if (target.length) {
                        $('html, body').animate({
                            scrollTop: target.offset().top - 80
                        }, 1000);
                        return false;
                    }
                }
            });
        }