import { supabase } from './supabaseClient.js';

const skillLevelInput = document.getElementById('skillLevelInput');
const itemDifficultyInput = document.getElementById('itemDifficultyInput');
const miracleStatusInput = document.getElementById('miracleStatus');
const successCountInput = document.getElementById('successCountInput');
const failureCountInput = document.getElementById('failureCountInput');
const successPlusBtn = document.getElementById('successPlusBtn');
const successMinusBtn = document.getElementById('successMinusBtn');
const failurePlusBtn = document.getElementById('failurePlusBtn');
const failureMinusBtn = document.getElementById('failureMinusBtn');
const totalAttemptsMadeDisplay = document.getElementById('totalAttemptsMadeDisplay');
const successRateDisplay = document.getElementById('successRateDisplay');
const miracleToggleDiv = document.getElementById('miracleToggle');
const miracleToggleNo = document.getElementById('miracleToggleNo');
const miracleToggleYes = document.getElementById('miracleToggleYes');
const resetTrackerBtn = document.getElementById('resetTrackerBtn');
const craftingItemSelect = document.getElementById('craftingItemSelect');

async function populateCraftingItems() {
    const { data: items, error } = await supabase
        .from('items')
        .select('item_name')
        .order('item_name', { ascending: true });

    if (error) {
        console.error('Error fetching crafting items:', error.message);
        const errorOption = document.createElement('option');
        errorOption.textContent = 'Error loading items!';
        craftingItemSelect.appendChild(errorOption);
        return;
    }

    if (items) {
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.item_name;
            option.textContent = item.item_name;
            craftingItemSelect.appendChild(option);
        });
    }
}

function updateAttemptsAndRate() {
    const currentSuccesses = parseInt(successCountInput.value) || 0;
    const currentFailures = parseInt(failureCountInput.value) || 0;
    
    if (currentSuccesses < 0) successCountInput.value = 0;
    if (currentFailures < 0) failureCountInput.value = 0;

    const totalAttempts = currentSuccesses + currentFailures;
    totalAttemptsMadeDisplay.textContent = totalAttempts;

    if (totalAttempts > 0) {
        const rate = (currentSuccesses / totalAttempts) * 100;
        successRateDisplay.textContent = rate.toFixed(2);
    } else {
        successRateDisplay.textContent = '0.00';
    }
}

function setMiracleStatus(status) {
    miracleStatusInput.value = status;
    const buttons = miracleToggleDiv.querySelectorAll('button');
    buttons.forEach(button => {
        if (button.getAttribute('data-status') === status) {
            button.classList.remove('text-gray-300', 'hover:bg-gray-600');
            button.classList.add('bg-indigo-500', 'text-white');
        } else {
            button.classList.remove('bg-indigo-500', 'text-white');
            button.classList.add('text-gray-300', 'hover:bg-gray-600');
        }
    });
}

function resetTracker() {
    successCountInput.value = 0;
    failureCountInput.value = 0;

    updateAttemptsAndRate();
    document.getElementById('craftingItemSelect').value = '';
    document.getElementById('expectedDifficultySelect').value = 'Moderate';
    document.getElementById('skillLevelInput').value = '1';
    document.getElementById('itemDifficultyInput').value = '1';
    document.getElementById('totalAttemptsInput').value = '50';
    setMiracleStatus('no');
}

successPlusBtn.addEventListener('click', () => {
    successCountInput.value = parseInt(successCountInput.value) + 1;
    updateAttemptsAndRate();
});

successMinusBtn.addEventListener('click', () => {
    const current = parseInt(successCountInput.value);
    if (current > 0) {
        successCountInput.value = current - 1;
        updateAttemptsAndRate();
    }
});

failurePlusBtn.addEventListener('click', () => {
    failureCountInput.value = parseInt(failureCountInput.value) + 1;
    updateAttemptsAndRate();
});

failureMinusBtn.addEventListener('click', () => {
    const current = parseInt(failureCountInput.value);
    if (current > 0) {
        failureCountInput.value = current - 1;
        updateAttemptsAndRate();
    }
});

successCountInput.addEventListener('input', updateAttemptsAndRate);
failureCountInput.addEventListener('input', updateAttemptsAndRate);

miracleToggleNo.addEventListener('click', () => setMiracleStatus('no'));
miracleToggleYes.addEventListener('click', () => setMiracleStatus('yes'));

resetTrackerBtn.addEventListener('click', resetTracker);

setMiracleStatus('no');
populateCraftingItems();