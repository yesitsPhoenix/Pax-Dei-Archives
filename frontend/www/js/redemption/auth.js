import { supabase } from '../supabaseClient.js';

export const initializePageAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
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

    updateUI(!!session);

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

    supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            updateUI(!!newSession);
        }
    });
};

document.addEventListener('DOMContentLoaded', initializePageAuth);