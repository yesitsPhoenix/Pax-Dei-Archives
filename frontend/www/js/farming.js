import { supabase } from './supabaseClient.js';


function generateUniqueCode() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().toUpperCase();
    }
    
    const S4 = () => (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4()).toUpperCase();
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('Copied to clipboard');
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

function ensureRunHistoryBody() {
    if (!runHistoryBody) {
        console.error('runHistoryBody element not found. Make sure <tbody id="runHistoryBody"> exists in the HTML.');
        return null;
    }
    return runHistoryBody;
}

function appendRunRow(run) {
    const tbody = ensureRunHistoryBody();
    if (!tbody) return;

    const row = tbody.insertRow(0); // put newest on top
    row.className = 'hover:bg-gray-500 transition duration-150';

    const ratePerHour = (run.amount / (run.time_ms / 3600000)).toFixed(2);
    const date = run.created_at ? new Date(run.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) : '';

    row.insertCell().textContent = run.item;
    row.insertCell().textContent = formatTime(run.time_ms);
    row.insertCell().textContent = run.amount;
    row.insertCell().textContent = ratePerHour;
    row.insertCell().textContent = date;
}


const shareCodeDisplay = document.getElementById('shareCodeDisplay');
const newCodeBtn = document.getElementById('newCodeBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const loadCodeInput = document.getElementById('loadCodeInput');
const loadRunBtn = document.getElementById('loadRunBtn');
const shareRunBtn = document.getElementById('shareRunBtn');
const feedbackMessage = document.getElementById('feedbackMessage');
const runNameInput = document.getElementById('runName');
const farmItemNameInput = document.getElementById('farmItemName');
const itemSearchResults = document.getElementById('itemSearchResults');
const stopwatchDisplay = document.getElementById('stopwatchDisplay');
const startRunBtn = document.getElementById('startRunBtn');
const pauseRunBtn = document.getElementById('pauseRunBtn');
const stopRunBtn = document.getElementById('stopRunBtn');
const finalizeRunModal = document.getElementById('finalizeRunModal');
const finalTimeDisplay = document.getElementById('finalTimeDisplay');
const finalItemNameDisplay = document.getElementById('finalItemNameDisplay');
const gatheredAmountInput = document.getElementById('gatheredAmountInput');
const saveRunBtn = document.getElementById('saveRunBtn');
const cancelFinalizeBtn = document.getElementById('cancelFinalizeBtn');
const runHistoryBody = document.getElementById('runHistoryBody');

const customItemModal = document.getElementById('customItemModal');
const customItemInput = document.getElementById('customItemInput');
const customItemSaveBtn = document.getElementById('customItemSaveBtn');
const customItemCancelBtn = document.getElementById('customItemCancelBtn');


let currentRun = null;
let intervalId = null;
let startTime = 0;
let elapsedTime = 0;
let isRunning = false;
let currentRunCode = '';

const farmingItems = [
    'Aurum Ore', 
    'Copper Ore', 
    'Cotton', 
    'Flax', 
    'Gneiss', 
    'Heartwood',
    'Impure Iron Ore', 
    'Iron Ore', 
    'Pure Iron Ore',
    'Rough Animal Hide', 
    'Sapwood', 
    'Silver Ore', 
    'Tin Ore', 
    'White Grapes',
    'Other'
];


function updateStopwatchDisplay() {
    stopwatchDisplay.textContent = formatTime(elapsedTime);
}

function startStopwatch() {
    if (isRunning) return;
    isRunning = true;
    startTime = Date.now() - elapsedTime;
    intervalId = setInterval(() => {
        elapsedTime = Date.now() - startTime;
        updateStopwatchDisplay();
    }, 100);
    startRunBtn.disabled = true;
    pauseRunBtn.disabled = false;
    stopRunBtn.disabled = false;
    runNameInput.disabled = true;
    farmItemNameInput.disabled = true;
    feedbackMessage.textContent = `Run active, tracking ${currentRun.item}...`;
    feedbackMessage.className = 'text-center text-sm mt-4 text-green-400';
}

function pauseStopwatch() {
    if (!isRunning) return;
    clearInterval(intervalId);
    isRunning = false;
    startRunBtn.textContent = 'Continue Run';
    startRunBtn.disabled = false;
    pauseRunBtn.disabled = true;
    feedbackMessage.textContent = 'Run paused. Click "Continue Run" to resume.';
    feedbackMessage.className = 'text-center text-sm mt-4 text-yellow-400';
}

function stopStopwatch() {
    clearInterval(intervalId);
    isRunning = false;
    
    if (elapsedTime > 0 && currentRun && currentRun.item) {
        finalTimeDisplay.textContent = formatTime(elapsedTime);
        finalItemNameDisplay.textContent = currentRun.item;
        gatheredAmountInput.value = '';
        finalizeRunModal.classList.remove('hidden');
    } else {
        resetFullRunState();
        feedbackMessage.textContent = 'Run stopped.';
        feedbackMessage.className = 'text-center text-sm mt-4';
    }
}

function resetStopwatch() {
    elapsedTime = 0;
    isRunning = false;
    updateStopwatchDisplay();
    startRunBtn.textContent = 'Start Run';
    startRunBtn.disabled = false;
    pauseRunBtn.disabled = true;
    stopRunBtn.disabled = true;
    runNameInput.disabled = false; 
    farmItemNameInput.disabled = false; 
}

function resetFullRunState() {
    resetStopwatch();
    currentRun = null;
    currentRunCode = '';
    shareCodeDisplay.value = '';
    runNameInput.value = '';
    farmItemNameInput.value = '';
    feedbackMessage.textContent = '';
    runHistoryBody.innerHTML = `<tr><td colspan="5" class="px-3 py-2 whitespace-nowrap text-sm text-gray-400 text-center">No runs saved yet.</td></tr>`;
}

function loadRun(code) {
    currentRunCode = code.toUpperCase();
    shareCodeDisplay.value = currentRunCode;
    
    currentRun = {
        code: currentRunCode,
        name: runNameInput.value || `Farming Run ${currentRunCode}`,
        item: farmItemNameInput.value.trim() || 'Unspecified Item',
        history: []
    };

    feedbackMessage.textContent = `Run ${currentRunCode} loaded.`;
    feedbackMessage.className = 'text-center text-sm mt-4 text-green-400';
    
    loadRunHistory();
}

async function saveRunToDB(runData) {
    const { data, error } = await supabase
        .from('farming_runs')
        .insert([runData])
        .select()
        .single();

    if (error) {
        console.error('Error saving run:', error);
        feedbackMessage.textContent = 'Error saving run to database.';
        feedbackMessage.className = 'text-center text-sm mt-4 text-red-400';
        return null;
    } else {
        feedbackMessage.textContent = `Segment saved to run ${currentRunCode}!`;
        feedbackMessage.className = 'text-center text-sm mt-4 text-green-400';

        if (data) {
            appendRunRow(data);
        } else {
            await loadRunHistory();
        }

        resetStopwatch();
        return data;
    }
}

async function loadRunHistory() {
    const tbody = ensureRunHistoryBody();
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!currentRunCode) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-3 py-2 whitespace-nowrap text-sm text-gray-400 text-center">No runs saved yet.</td></tr>`;
        return;
    }

    const { data: runs, error } = await supabase
        .from('farming_runs')
        .select('*')
        .eq('run_code', currentRunCode)
        .order('created_at', { ascending: false });

    if (error) {
        if (error.code !== '42P01') {
            console.error('Error loading history:', error);
            tbody.innerHTML = `<tr><td colspan="5" class="px-3 py-2 whitespace-nowrap text-sm text-red-400 text-center">Error loading history.</td></tr>`;
        }
        return;
    }

    if (!runs || runs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-3 py-2 whitespace-nowrap text-sm text-gray-400 text-center">No runs saved yet.</td></tr>`;
        return;
    }

    runs.forEach(run => appendRunRow(run));
}



newCodeBtn.addEventListener('click', () => {
    const newCode = generateUniqueCode();
    window.location.href = `${window.location.pathname}?code=${newCode}`;
});

copyCodeBtn.addEventListener('click', () => {
    if (shareCodeDisplay.value) {
        copyToClipboard(shareCodeDisplay.value);
        feedbackMessage.textContent = 'Code copied to clipboard!';
        feedbackMessage.className = 'text-center text-sm mt-4 text-green-400';
        setTimeout(() => feedbackMessage.textContent = '', 2000);
    } else {
        feedbackMessage.textContent = 'Generate a new code first.';
        feedbackMessage.className = 'text-center text-sm mt-4 text-red-400';
    }
});

loadRunBtn.addEventListener('click', () => {
    const code = loadCodeInput.value.trim().toUpperCase();
    if (code) {
        window.location.href = `${window.location.pathname}?code=${code}`;
    } else {
        feedbackMessage.textContent = 'Please enter a code to load.';
        feedbackMessage.className = 'text-center text-sm mt-4 text-red-400';
    }
});

shareRunBtn.addEventListener('click', () => {
    if (currentRunCode) {
        const url = `${window.location.origin}${window.location.pathname}?code=${currentRunCode}`;
        copyToClipboard(url);
        feedbackMessage.textContent = 'Run link copied to clipboard!';
        feedbackMessage.className = 'text-center text-sm mt-4 text-green-400';
        setTimeout(() => feedbackMessage.textContent = '', 2000);
    } else {
        feedbackMessage.textContent = 'Start or load a run first.';
        feedbackMessage.className = 'text-center text-sm mt-4 text-red-400';
    }
});

startRunBtn.addEventListener('click', () => {
    if (!currentRunCode) {
        feedbackMessage.textContent = 'Please generate a New Code or Load a Run first.';
        feedbackMessage.className = 'text-center text-sm mt-4 text-red-400';
        return;
    }
    const item = farmItemNameInput.value.trim();
    if (!item) {
        feedbackMessage.textContent = 'Please select or enter an Item to Farm/Gather first.';
        feedbackMessage.className = 'text-center text-sm mt-4 text-red-400';
        return;
    }

    currentRun.item = item;
    currentRun.name = runNameInput.value.trim() || `Farming Run ${currentRunCode}`;
    startStopwatch();
});

pauseRunBtn.addEventListener('click', pauseStopwatch);
stopRunBtn.addEventListener('click', stopStopwatch);

cancelFinalizeBtn.addEventListener('click', () => {
    finalizeRunModal.classList.add('hidden');
});


saveRunBtn.addEventListener('click', async () => {
    const amount = parseInt(gatheredAmountInput.value, 10);
    if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid amount gathered (0 or greater).');
        return;
    }

    if (!currentRun || !currentRunCode) {
        alert('No active run loaded — start or load a run first.');
        finalizeRunModal.classList.add('hidden');
        resetStopwatch();
        return;
    }

    const runData = {
        run_code: currentRunCode,
        run_name: currentRun.name,
        item: currentRun.item,
        time_ms: elapsedTime,
        amount: amount,
    };

    const insertedRow = await saveRunToDB(runData);
    if (!insertedRow) {
    } else {
    }

    finalizeRunModal.classList.add('hidden');
});


function openCustomItemModal() {
    customItemInput.value = '';
    customItemModal.classList.remove('hidden');
    customItemInput.focus();
}

function closeCustomItemModal() {
    customItemModal.classList.add('hidden');
}

customItemSaveBtn.addEventListener('click', () => {
    const val = customItemInput.value.trim();
    if (val) {
        farmItemNameInput.value = val;
        closeCustomItemModal();
    }
});

customItemCancelBtn.addEventListener('click', closeCustomItemModal);

function filterItemSearchResults() {
    const query = farmItemNameInput.value.toLowerCase();
    itemSearchResults.innerHTML = '';

    const results = query
        ? farmingItems.filter(item => item.toLowerCase().includes(query))
        : farmingItems; 

    if (results.length > 0) {
        results.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.textContent = item;
            resultItem.className = 'p-2 cursor-pointer hover:bg-gray-600 text-white';
            resultItem.addEventListener('click', () => {
                if (item === 'Other') {
                    openCustomItemModal();
                } else {
                    farmItemNameInput.value = item;
                }
                itemSearchResults.classList.add('hidden');
            });
            itemSearchResults.appendChild(resultItem);
        });
        itemSearchResults.classList.remove('hidden');
    } else {
        itemSearchResults.classList.add('hidden');
    }
}


farmItemNameInput.addEventListener('input', filterItemSearchResults);
farmItemNameInput.addEventListener('focus', filterItemSearchResults);

document.addEventListener('click', (e) => {
    if (!farmItemNameInput.contains(e.target) && !itemSearchResults.contains(e.target)) {
        itemSearchResults.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        loadRun(code.toUpperCase());
    } else {
        resetFullRunState();
    }
});