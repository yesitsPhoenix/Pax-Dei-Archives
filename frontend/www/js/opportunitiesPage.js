import { initializeCharacterContext } from './modules/characters.js';

async function initializePage() {
    const body = document.getElementById('marketValleyGapsBody');
    try {
        const character = await initializeCharacterContext();
        if (!character) throw new Error('Select or create a character before researching market opportunities.');
        const { initializeMarketOpportunities } = await import('./modules/marketOpportunities.js');
        initializeMarketOpportunities();
    } catch (error) {
        if (body) body.innerHTML = `<div class="market-opportunities-empty market-opportunities-error"><i class="fas fa-triangle-exclamation"></i><h4>Market research unavailable</h4><p>${String(error?.message || error)}</p></div>`;
    }
}

initializePage();
