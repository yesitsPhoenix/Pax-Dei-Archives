//trader.js:
import { supabase } from './supabaseClient.js';
import { initializeListings, loadActiveListings } from './modules/listings.js';
import { initializeCharacters, insertCharacterModalHtml, currentCharacterId, getCurrentCharacter } from './modules/characters.js';
import { initializeSales, loadSalesHistory } from './modules/sales.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderSalesChart, setupSalesChartListeners } from './modules/salesChart.js';

let currentUser = null;
const dashboardListingsFilter = {
    itemName: null,
    categoryId: null,
    status: 'all'
};
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
const characterSelectEl = document.getElementById('character-select');
const showCreateCharacterModalBtn = document.getElementById('showCreateCharacterModalBtn');
const deleteCharacterBtn = document.getElementById('deleteCharacterBtn');
const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');
const traderLoginContainer = document.getElementById('traderLoginContainer');
const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
const traderLoginError = document.getElementById('traderLoginError');
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

    if (!currentUser || !currentUser.id) {
        renderDashboard([]);
        await loadActiveListings();
        await loadSalesHistory();
        renderSalesChart(null, 'monthly');
        return;
    }

    try {
        const { data: allListings, error: allListingsError } = await supabase.rpc('search_trader_listings', {
            p_character_id: currentCharacterId,
            p_item_name: dashboardListingsFilter.itemName,
            p_category_id: dashboardListingsFilter.categoryId,
            p_status: dashboardListingsFilter.status,
            p_limit: 999999,
            p_offset: 0
        });
        if (allListingsError) {
            throw allListingsError;
        }
        const currentCharacterData = await getCurrentCharacter();

        renderDashboard(allListings || [], currentCharacterData);
        await loadActiveListings();
        await loadSalesHistory();
        await renderSalesChart(currentUser.id, 'daily');
    } catch (error) {
        console.error('Error loading trader page data:', error.message);
        await showCustomModal('Error', 'Failed to load trader data: ' + error.message, [{ text: 'OK', value: true }]);
    }
};
const addPageEventListeners = () => {
    if (showCreateCharacterModalBtn) {
        showCreateCharacterModalBtn.addEventListener('click', () => {
            const createCharacterModal = document.getElementById('createCharacterModal');
            if (createCharacterModal) {
                createCharacterModal.classList.remove('hidden');
            }
        });
    }
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
                if (traderLoginError) {
                    traderLoginError.textContent = 'Login failed: ' + error.message;
                    traderLoginError.style.display = 'block';
                }
            }
        });
    }
    setupSalesChartListeners();
};
document.addEventListener('DOMContentLoaded', async () => {
    addPageEventListeners();
    await checkUser();
});
