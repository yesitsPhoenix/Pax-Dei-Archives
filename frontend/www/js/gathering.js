import { supabase } from './supabaseClient.js';
import { FARMING_CATEGORIES, GATHERING_TOOLS } from './gatheringConstants.js';


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

    const row = tbody.insertRow(0);
    row.className = 'hover:bg-gray-500 transition duration-150';

    const ratePerHour = (run.amount / (run.time_ms / 3600000)).toFixed(2);
    const date = run.created_at ? new Date(run.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) : '';
    const miracleStatus = run.miracle_active ? 'Yes' : 'No';

    const cellClass = 'px-3 py-2 whitespace-nowrap text-sm text-gray-200 text-center';

    const itemCell = row.insertCell();
    itemCell.textContent = run.item;
    itemCell.className = cellClass;
    
    const categoryCell = row.insertCell();
    categoryCell.textContent = run.category;
    categoryCell.className = cellClass;
    
    const toolCell = row.insertCell();
    toolCell.textContent = run.tool_used || '';
    toolCell.className = cellClass;
    
    const timeCell = row.insertCell();
    timeCell.textContent = formatTime(run.time_ms);
    timeCell.className = cellClass;
    
    const amountCell = row.insertCell();
    amountCell.textContent = run.amount;
    amountCell.className = cellClass;
    
    const rateCell = row.insertCell();
    rateCell.textContent = ratePerHour;
    rateCell.className = cellClass;
    
    const dateCell = row.insertCell();
    dateCell.textContent = date;
    dateCell.className = cellClass;
    
    const miracleCell = row.insertCell();
    miracleCell.textContent = miracleStatus;
    miracleCell.className = cellClass;
}

const urlParams = new URLSearchParams(window.location.search);
const isReadOnly = urlParams.get('mode') === 'view';
const shareCodeDisplay = document.getElementById('shareCodeDisplay');
const newCodeBtn = document.getElementById('newCodeBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const loadCodeInput = document.getElementById('loadCodeInput');
const loadRunBtn = document.getElementById('loadRunBtn');
const shareRunBtn = document.getElementById('shareRunBtn');
const feedbackMessage = document.getElementById('feedbackMessage');
const runNameInput = document.getElementById('runName');
const farmCategoryInput = document.getElementById('farmCategoryInput');
const categorySearchResults = document.getElementById('categorySearchResults');
const farmItemNameInput = document.getElementById('farmItemName');
const itemSearchResults = document.getElementById('itemSearchResults');
const toolNameInput = document.getElementById('toolName');
const toolSearchResults = document.getElementById('toolSearchResults');
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
const gatheringMiracleToggle = document.getElementById('gatheringMiracleToggle');
const gatheringMiracleStatusInput = document.getElementById('gatheringMiracleStatus');


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


if (isReadOnly) {
    newCodeBtn.disabled = true;
    loadRunBtn.disabled = true;
    startRunBtn.disabled = true;
    pauseRunBtn.disabled = true;
    stopRunBtn.disabled = true;
    loadCodeInput.disabled = true;
    runNameInput.disabled = true;
    farmCategoryInput.disabled = true;
    farmItemNameInput.disabled = true;
    toolNameInput.disabled = true;
    if (gatheringMiracleToggle) {
        gatheringMiracleToggle.classList.add('pointer-events-none', 'opacity-50');
    }
    
    if (feedbackMessage) {
        feedbackMessage.textContent = 'This run is in View-Only Mode.';
        feedbackMessage.className = 'text-center text-sm mt-4 text-indigo-400';
    }
}


function setGatheringMiracle(status) {
    gatheringMiracleStatusInput.value = status;
    const buttons = gatheringMiracleToggle.querySelectorAll('button');
    buttons.forEach(button => {
        if (button.getAttribute('data-status') === status) {
            button.classList.add('bg-indigo-500', 'text-white');
            button.classList.remove('text-gray-300', 'hover:bg-gray-600');
        } else {
            button.classList.remove('bg-indigo-500', 'text-white');
            button.classList.add('text-gray-300', 'hover:bg-gray-600');
        }
    });
}

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
    farmCategoryInput.disabled = true;
    farmItemNameInput.disabled = true;
    toolNameInput.disabled = true;
    gatheringMiracleToggle.classList.add('pointer-events-none', 'opacity-50');
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
    farmCategoryInput.disabled = false; 
    farmItemNameInput.disabled = false; 
    toolNameInput.disabled = false;
    gatheringMiracleToggle.classList.remove('pointer-events-none', 'opacity-50');
}

function resetFullRunState() {
    resetStopwatch();
    currentRun = null;
    currentRunCode = '';
    shareCodeDisplay.value = '';
    runNameInput.value = '';
    farmCategoryInput.value = '';
    farmItemNameInput.value = '';
    toolNameInput.value = '';
    setGatheringMiracle('not_active');
    feedbackMessage.textContent = '';
    if (runHistoryBody) {
        runHistoryBody.innerHTML = `<tr><td colspan="8" class="px-3 py-2 whitespace-nowrap text-sm text-gray-400 text-center">No runs saved yet.</td></tr>`;
    }
}

async function loadRun(code) {
    currentRunCode = code.toUpperCase();
    shareCodeDisplay.value = currentRunCode;

    const { data: latestRun, error } = await supabase
        .from('farming_runs')
        .select('*')
        .eq('run_code', currentRunCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    let runName = `Farming Run ${currentRunCode}`;
    if (!error && latestRun && latestRun.run_name) {
        runName = latestRun.run_name;
    }

    runNameInput.value = runName;

    currentRun = {
        code: currentRunCode,
        name: runName,
        item: farmItemNameInput.value.trim() || 'Unspecified Item',
        history: []
    };

    feedbackMessage.textContent = `Run ${currentRunCode} loaded.`;
    feedbackMessage.className = 'text-center text-sm mt-4 text-green-400';

    await loadRunHistory();
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

    let runs = [];
    let error = null;

    if (currentRunCode) {
        const result = await supabase
            .from('farming_runs')
            .select('*')
            .eq('run_code', currentRunCode)
            .order('created_at', { ascending: false });

        runs = result.data;
        error = result.error;
    }

    if (error) {
        if (error.code !== '42P01') {
            console.error('Error loading history:', error);
            tbody.innerHTML = `<tr><td colspan="8" class="px-3 py-2 whitespace-nowrap text-sm text-red-400 text-center">Error loading history.</td></tr>`;
        }
        return;
    }

    if (!currentRunCode || !runs || runs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-3 py-2 whitespace-nowrap text-sm text-gray-400 text-center">No runs saved yet.</td></tr>`;
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
        const url = `${window.location.origin}${window.location.pathname}?code=${currentRunCode}&mode=view`;
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

    const category = farmCategoryInput.value.trim();
    if (!category) {
        feedbackMessage.textContent = 'Please select a Category first.';
        feedbackMessage.className = 'text-center text-sm mt-4 text-red-400';
        return;
    }

    const item = farmItemNameInput.value.trim();
    if (!item) {
        feedbackMessage.textContent = 'Please select or enter an Item to Farm/Gather.';
        feedbackMessage.className = 'text-center text-sm mt-4 text-red-400';
        return;
    }

    const runName = runNameInput.value.trim();
    if (!runName) {
        feedbackMessage.textContent = 'Please enter a Run Name.';
        feedbackMessage.className = 'text-center text-sm mt-4 text-red-400';
        runNameInput.focus();
        return;
    }

    currentRun.item = item;
    currentRun.name = runName;
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

    const miracleStatus = gatheringMiracleStatusInput.value === 'active';

    const runData = {
        run_code: currentRunCode,
        run_name: currentRun.name,
        category: farmCategoryInput.value.trim(),
        item: currentRun.item,
        tool_used: toolNameInput.value.trim(),
        time_ms: elapsedTime,
        amount: amount,
        miracle_active: miracleStatus,
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


function filterCategoryResults(event) {

    const isTyping = event && event.type === 'input';
    const query = isTyping ? farmCategoryInput.value.toLowerCase() : '';

    categorySearchResults.innerHTML = '';

    const categories = Object.keys(FARMING_CATEGORIES);
    const results = query
        ? categories.filter(category => category.toLowerCase().includes(query))
        : categories;

    if (results.length > 0) {
        results.forEach(category => {
            const resultItem = document.createElement('div');
            resultItem.textContent = category;
            resultItem.className = 'p-2 cursor-pointer hover:bg-gray-600 text-white';
            resultItem.addEventListener('click', () => {
                farmCategoryInput.value = category;
                categorySearchResults.classList.add('hidden');
                
                farmItemNameInput.value = '';
                toolNameInput.value = '';

                filterItemSearchResults();
                filterToolSearchResults();
            });
            categorySearchResults.appendChild(resultItem);
        });
        categorySearchResults.classList.remove('hidden');
    } else {
        categorySearchResults.classList.add('hidden');
    }
}


function filterItemSearchResults() {
    const category = farmCategoryInput.value.trim();
    const query = farmItemNameInput.value.toLowerCase();
    itemSearchResults.innerHTML = '';

    if (!category || !FARMING_CATEGORIES[category]) {
        itemSearchResults.classList.add('hidden');
        return;
    }
    
    const items = FARMING_CATEGORIES[category];
    const results = query
        ? items.filter(item => item.toLowerCase().includes(query))
        : items; 

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

function filterToolSearchResults() {
    const category = farmCategoryInput.value.trim();
    const query = toolNameInput.value.toLowerCase();
    toolSearchResults.innerHTML = '';

    if (!category || !GATHERING_TOOLS[category]) {
        toolSearchResults.classList.add('hidden');
        return;
    }
    
    const tools = GATHERING_TOOLS[category];
    const results = query
        ? tools.filter(tool => tool.toLowerCase().includes(query))
        : tools; 

    if (results.length > 0) {
        results.forEach(tool => {
            const resultItem = document.createElement('div');
            resultItem.textContent = tool;
            resultItem.className = 'p-2 cursor-pointer hover:bg-gray-600 text-white';
            resultItem.addEventListener('click', () => {
                toolNameInput.value = tool;
                toolSearchResults.classList.add('hidden');
            });
            toolSearchResults.appendChild(resultItem);
        });
        toolSearchResults.classList.remove('hidden');
    } else {
        toolSearchResults.classList.add('hidden');
    }
}


farmCategoryInput.addEventListener('input', filterCategoryResults);
farmCategoryInput.addEventListener('focus', filterCategoryResults);
farmItemNameInput.addEventListener('input', filterItemSearchResults);
farmItemNameInput.addEventListener('focus', filterItemSearchResults);
toolNameInput.addEventListener('input', filterToolSearchResults);
toolNameInput.addEventListener('focus', filterToolSearchResults);

document.addEventListener('click', (e) => {
    if (farmCategoryInput && !farmCategoryInput.contains(e.target) && categorySearchResults && !categorySearchResults.contains(e.target)) {
        categorySearchResults.classList.add('hidden');
    }
    if (farmItemNameInput && !farmItemNameInput.contains(e.target) && itemSearchResults && !itemSearchResults.contains(e.target)) {
        itemSearchResults.classList.add('hidden');
    }
    if (toolNameInput && !toolNameInput.contains(e.target) && toolSearchResults && !toolSearchResults.contains(e.target)) {
        toolSearchResults.classList.add('hidden');
    }
});

closeRunBtn.addEventListener('click', () => {
    if (isReadOnly) return;
    document.getElementById('closeRunModal').classList.remove('hidden');
});

document.getElementById('cancelCloseRun').addEventListener('click', () => {
    document.getElementById('closeRunModal').classList.add('hidden');
});

document.getElementById('confirmCloseRun').addEventListener('click', () => {
    resetFullRunState();
    window.location.href = 'gathering.html';
});


document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    setGatheringMiracle(gatheringMiracleStatusInput.value);
    if (code) {
        loadRun(code.toUpperCase());
    } else {
        resetFullRunState();
    }
});

window.setGatheringMiracle = setGatheringMiracle;