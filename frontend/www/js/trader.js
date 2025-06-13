import { supabase } from './supabaseClient.js';
import { renderDashboard } from './modules/dashboard.js';
import { initializeListings, loadActiveListings } from './modules/listings.js';
import { initializeSales, loadSalesHistory } from './modules/sales.js';

const traderLoginContainer = document.getElementById('traderLoginContainer');
const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
const traderLoginError = document.getElementById('traderLoginError');
const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');

let currentUserId = null;

const customModalHtml = `
    <div id="customModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
        <div class="bg-white p-6 rounded-lg shadow-xl w-96 max-w-full font-inter">
            <h3 id="modalTitle" class="text-xl font-bold mb-4 text-gray-800"></h3>
            <p id="modalMessage" class="mb-6 text-gray-700"></p>
            <div id="modalButtons" class="flex justify-end space-x-3"></div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', customModalHtml);

export const showCustomModal = (title, message, buttons) => {
    return new Promise(resolve => {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalButtons = document.getElementById('modalButtons');

        if (!modal || !modalTitle || !modalMessage || !modalButtons) {
            resolve(false);
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalButtons.innerHTML = '';

        buttons.forEach(buttonConfig => {
            const button = document.createElement('button');
            button.textContent = buttonConfig.text;
            let baseClass = 'px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out transform hover:scale-105';
            
            if (buttonConfig.type === 'confirm') {
                button.className = `${baseClass} bg-blue-500 text-white hover:bg-blue-700`;
            } else if (buttonConfig.type === 'cancel') {
                button.className = `${baseClass} bg-gray-500 text-white hover:bg-gray-700`;
            } else {
                button.className = `${baseClass} bg-blue-500 text-white hover:bg-blue-700`;
            }

            button.onclick = () => {
                modal.classList.add('hidden');
                resolve(buttonConfig.value);
            };
            modalButtons.appendChild(button);
        });

        modal.classList.remove('hidden');
    });
};

const checkUser = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error("Error getting session:", error.message);
        return;
    }

    if (session && session.user) {
        currentUserId = session.user.id;
        traderLoginContainer.style.display = 'none';
        traderDashboardAndForms.style.display = 'block';

        initializeListings(currentUserId);
        initializeSales(currentUserId);
        
        loadTraderPageData();
    } else {
        traderLoginContainer.style.display = 'block';
        traderDashboardAndForms.style.display = 'none';
    }
};

export const loadTraderPageData = async () => {
    if (!currentUserId) return;

    const dashboardPromise = supabase
        .from('market_listings')
        .select('total_listed_price, market_fee, is_fully_sold, is_cancelled')
        .eq('user_id', currentUserId)
        .then(({ data, error }) => {
            if (error) console.error("Dashboard fetch error:", error);
            renderDashboard(data || []);
        });

    await Promise.all([
        loadActiveListings(),
        loadSalesHistory(),
        dashboardPromise
    ]);
};

const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
    });
    if (error) {
        traderLoginError.textContent = 'Error logging in: ' + error.message;
        traderLoginError.style.display = 'block';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (traderDiscordLoginButton) {
        traderDiscordLoginButton.addEventListener('click', handleLogin);
    }
    checkUser();
});