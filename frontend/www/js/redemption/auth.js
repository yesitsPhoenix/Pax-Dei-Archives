import { supabase } from '../supabaseClient.js';
import { questState } from './questStateManager.js';

export const initializePageAuth = async () => {
    if (!questState.isReady()) {
        await questState.initialize();
    }
    
    const user = questState.getUser();
    
    const loginContainer = document.getElementById('traderLoginContainer');
    const questContent = document.getElementById('quest-log-main-content');
    const discordBtn = document.getElementById('traderDiscordLoginButton');
    const sidebar = document.getElementById('sidebar');
    const errorMsg = document.getElementById('traderLoginError');

    const updateUI = (hasSession) => {
        if (hasSession) {
            if (loginContainer) {
                loginContainer.style.setProperty('display', 'none', 'important');
                loginContainer.classList.add('hidden');
            }
            if (questContent) {
                questContent.style.setProperty('display', 'block', 'important');
            }
            if (sidebar) {
                sidebar.style.setProperty('display', 'block', 'important');
            }
        } else {
            if (loginContainer) {
                loginContainer.style.setProperty('display', 'flex', 'important');
                loginContainer.classList.remove('hidden');
            }
            if (questContent) {
                questContent.style.setProperty('display', 'none', 'important');
            }
            if (sidebar) {
                sidebar.style.setProperty('display', 'none', 'important');
            }
        }
    };

    updateUI(!!user);

    questState.subscribe((event, data) => {
        if (event === 'initialized' || event === 'reset') {
            const currentUser = questState.getUser();
            updateUI(!!currentUser);
        }
    });

    if (discordBtn) {
        discordBtn.onclick = async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                    redirectTo: window.location.href
                }
            });

            if (error && errorMsg) {
                errorMsg.textContent = error.message;
                errorMsg.style.display = 'block';
            }
        };
    }

    let authTimeout;
    supabase.auth.onAuthStateChange((event, newSession) => {
        clearTimeout(authTimeout);
        authTimeout = setTimeout(async () => {
            if (event === 'SIGNED_IN') {
                await questState.initialize();
                updateUI(true);
            } else if (event === 'SIGNED_OUT') {
                questState.reset();
                updateUI(false);
            }
        }, 300);
    });
};

document.addEventListener('DOMContentLoaded', initializePageAuth);