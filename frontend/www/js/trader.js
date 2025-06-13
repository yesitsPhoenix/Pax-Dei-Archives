import { supabase } from './supabaseClient.js';
import { initializeListings, loadActiveListings } from './modules/listings.js';
import { initializeCharacters, insertCharacterModalHtml, currentCharacterId } from './modules/characters.js';
import { initializeSales, loadSalesHistory } from './modules/sales.js';
import { renderDashboard } from './modules/dashboard.js';

let currentUser = null;

export const showCustomModal = (title, message, buttons) => {
    return new Promise(resolve => {
        const modalId = `customModal-${Date.now()}`;
        const modalHtml = `
            <div id="${modalId}" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter">
                    <h3 class="text-xl font-bold mb-4 text-gray-800">${title}</h3>
                    <p class="mb-6 text-gray-700">${message}</p>
                    <div class="flex justify-end gap-3">
                        ${buttons.map(btn => `
                            <button class="px-4 py-2 rounded-full font-bold
                                ${btn.type === 'confirm' ? 'bg-blue-500 hover:bg-blue-700 text-white' : ''}
                                ${btn.type === 'cancel' ? 'bg-gray-500 hover:bg-gray-700 text-white' : ''}
                                ${!btn.type ? 'bg-gray-300 hover:bg-gray-400 text-gray-800' : ''}"
                                data-value="${btn.value}">${btn.text}</button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalElement = document.getElementById(modalId);
        modalElement.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                const value = button.dataset.value === 'true' ? true : (button.dataset.value === 'false' ? false : button.dataset.value);
                modalElement.remove();
                resolve(value);
            });
        });
    });
};

const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const traderLoginContainer = document.getElementById('traderLoginContainer');
    const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');

    if (user) {
        currentUser = user;

        if (traderLoginContainer) {
            traderLoginContainer.style.display = 'none';
        }

        insertCharacterModalHtml();

        await initializeCharacters(currentUser.id, async () => {
            await loadTraderPageData();
        });

        initializeListings(currentUser.id);
        initializeSales();

        if (traderDashboardAndForms) {
            traderDashboardAndForms.style.display = 'block';
        }
        
        await loadTraderPageData();
    } else {
        if (traderLoginContainer) {
            traderLoginContainer.style.display = 'block';
        }
        if (traderDashboardAndForms) {
            traderDashboardAndForms.style.display = 'none';
        }
    }
};

export const loadTraderPageData = async () => {
    if (!currentCharacterId) {
        renderDashboard([]);
        await loadActiveListings();
        await loadSalesHistory();
        return;
    }

    try {
        const { data: allListings, error: allListingsError } = await supabase
            .from('market_listings')
            .select('is_fully_sold, is_cancelled, market_fee, total_listed_price')
            .eq('character_id', currentCharacterId);

        if (allListingsError) {
            throw allListingsError;
        }

        renderDashboard(allListings || []);

        await loadActiveListings();
        await loadSalesHistory();
    } catch (error) {
        console.error('Error loading trader page data:', error.message);
        await showCustomModal('Error', 'Failed to load trader data: ' + error.message, [{ text: 'OK', value: true }]);
    }
};

const addPageEventListeners = () => {
    const showCreateCharacterModalBtn = document.getElementById('showCreateCharacterModalBtn');

    if (showCreateCharacterModalBtn) {
        showCreateCharacterModalBtn.addEventListener('click', () => {
            const createCharacterModal = document.getElementById('createCharacterModal');
            if (createCharacterModal) {
                createCharacterModal.classList.remove('hidden');
            }
        });
    }
    const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
    if (traderDiscordLoginButton) {
        traderDiscordLoginButton.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                    redirectTo: window.location.origin + '/trader.html'
                }
            });
            if (error) {
                console.error('Error logging in with Discord:', error.message);
                const traderLoginError = document.getElementById('traderLoginError');
                if (traderLoginError) {
                    traderLoginError.textContent = 'Login failed: ' + error.message;
                    traderLoginError.style.display = 'block';
                }
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    addPageEventListeners();
    await checkUser();
});
