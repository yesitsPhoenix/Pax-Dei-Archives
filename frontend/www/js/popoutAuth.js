import { isLoggedIn, logout, getUserProfile } from './utils.js';
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const floatingAvatarContainer = document.getElementById('floating-avatar-container');
    const floatingAvatar = document.getElementById('floating-avatar');
    const authModal = document.getElementById('auth-modal');
    const modalContentWrapper = document.getElementById('modal-content-wrapper');

    const DEFAULT_AVATAR_URL = 'https://cdn.discordapp.com/embed/avatars/0.png';

    const setFloatingAvatar = (url, loaded = true) => {
        floatingAvatar.src = url;
        if (loaded) {
            floatingAvatar.classList.add('loaded');
            sessionStorage.setItem('userAvatarUrl', url);
        } else {
            floatingAvatar.classList.remove('loaded');
            sessionStorage.removeItem('userAvatarUrl');
        }
    };

    const updateAuthUI = async () => {
        if (await isLoggedIn()) {
            const userProfile = await getUserProfile();
            const userName = userProfile ? userProfile.username : 'Guest';
            const avatarUrl = userProfile ? (userProfile.avatar_url || DEFAULT_AVATAR_URL) : DEFAULT_AVATAR_URL;

            setFloatingAvatar(avatarUrl);

            modalContentWrapper.innerHTML = `
                <img src="${avatarUrl}" alt="User Avatar" class="modal-avatar">
                <h4>Welcome, ${userName}!</h4>
                <a href="profile.html" class="profile-button modal-button">
                    <i class="fa-solid fa-user"></i> My Profile
                </a>
                <button id="logoutButton" class="logout-button modal-button">
                    <i class="fa-solid fa-right-from-bracket"></i> Logout
                </button>
            `;
            document.getElementById('logoutButton').addEventListener('click', async () => {
                await logout();
                sessionStorage.removeItem('userAvatarUrl');
                authModal.classList.remove('open');
                updateAuthUI();
            });
        } else {
            setFloatingAvatar(DEFAULT_AVATAR_URL, false);

            modalContentWrapper.innerHTML = `
                <h4>Join the Archives!</h4>
                <button id="discordLoginButton" class="login-button modal-button">
                    <i class="fa-brands fa-discord"></i> Login with Discord
                </button>
            `;
            document.getElementById('discordLoginButton').addEventListener('click', async () => {
                await supabase.auth.signInWithOAuth({
                    provider: 'discord',
                    options: {
                        redirectTo: window.location.href,
                        scopes: 'identify'
                    }
                });
            });
        }
    };

    if (await isLoggedIn()) {
        const storedAvatarUrl = sessionStorage.getItem('userAvatarUrl');
        if (storedAvatarUrl) {
            setFloatingAvatar(storedAvatarUrl);
        } else {
            const userProfile = await getUserProfile();
            const avatarUrl = userProfile ? (userProfile.avatar_url || DEFAULT_AVATAR_URL) : DEFAULT_AVATAR_URL;
            setFloatingAvatar(avatarUrl);
        }
    } else {
        setFloatingAvatar(DEFAULT_AVATAR_URL, false);
    }

    floatingAvatarContainer.addEventListener('mouseenter', () => {
        authModal.classList.add('open');
    });

    authModal.addEventListener('mouseleave', () => {
        authModal.classList.remove('open');
    });

    updateAuthUI();
});