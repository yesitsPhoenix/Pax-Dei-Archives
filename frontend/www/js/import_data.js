import { supabase } from './supabaseClient.js';
import { fetchActiveListings, getCurrentFilters, currentPage } from './market_listings.js';


const importModal = document.getElementById('importDataModal');
const selectCharacter = document.getElementById('selectCharacter');
const selectStall = document.getElementById('selectStall');
const importFile = document.getElementById('importFile');
const importCancelBtn = document.getElementById('importCancelBtn');
const importSubmitBtn = document.getElementById('importSubmitBtn');
const noCharactersWarning = document.getElementById('noCharactersWarning');

const confirmationModal = document.getElementById('confirmationModal');
const confirmationMessageText = document.getElementById('confirmationMessageText');
const confirmationOkBtn = document.getElementById('confirmationOkBtn');

const setAlertIcon = (type) => {
  const iconContainer = document.getElementById('alertIcon');
  let iconHtml = '';
  
  iconContainer.className = 'flex-shrink-0 w-5 h-5 mr-3 mt-0.5';

  if (type === 'success') {
    iconHtml = '<svg class="text-green-700" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>';
  } else if (type === 'error') {
    iconHtml = '<svg class="text-red-700" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';
  } else if (type === 'warning') {
    iconHtml = '<svg class="text-yellow-700" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M8.257 3.328a1 1 0 011.486 0l5.5 9A1 1 0 0114.25 13H5.75a1 1 0 01-.743-1.672l5.5-9zM10 15a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg>';
  }
  iconContainer.innerHTML = iconHtml;
};

const displayTailwindAlert = (message, type = 'success') => {
  const alertElement = document.getElementById('tailwindAlert');
  const alertText = document.getElementById('alertMessageText');
  
  setAlertIcon(type);
  alertText.textContent = message;
  
  let bgClasses = '';
  if (type === 'success') {
    bgClasses = 'bg-green-100 border border-green-400 text-green-700';
  } else if (type === 'error') {
    bgClasses = 'bg-red-100 border border-red-400 text-red-700';
  } else if (type === 'warning') {
    bgClasses = 'bg-yellow-100 border border-yellow-400 text-yellow-700';
  }

  alertElement.classList.remove('opacity-100', 'bg-green-100', 'border-green-400', 'text-green-700', 'bg-red-100', 'border-red-400', 'text-red-700', 'bg-yellow-100', 'border-yellow-400', 'text-yellow-700');
  alertElement.classList.add(...bgClasses.split(' '));
  alertElement.classList.add('opacity-0');
  
  alertElement.classList.remove('hidden');
  
  requestAnimationFrame(() => {
    alertElement.classList.remove('opacity-0');
    alertElement.classList.add('opacity-100');
  });

  setTimeout(() => {
    alertElement.classList.remove('opacity-100');
    alertElement.classList.add('opacity-0');
    setTimeout(() => {
        alertElement.classList.add('hidden');
    }, 300);
  }, 5000);
};

const showBlockingConfirmation = (message) => {
    return new Promise(resolve => {
        confirmationMessageText.textContent = message;
        confirmationModal.classList.remove('hidden');

        const listener = () => {
            confirmationModal.classList.add('hidden');
            confirmationOkBtn.removeEventListener('click', listener);
            resolve();
        };

        confirmationOkBtn.addEventListener('click', listener);
    });
};

const populateStalls = async (charId) => {
    selectStall.innerHTML = '<option value="">Loading stalls...</option>';
    selectStall.disabled = true;
    importSubmitBtn.disabled = true;
    
    if (!charId) {
        selectStall.innerHTML = '<option value="">Select a character first</option>';
        return;
    }

    const { data: stalls, error } = await supabase
        .from('market_stalls')
        .select('id, stall_name, region')
        .eq('character_id', charId);
    
    if (error) {
        displayTailwindAlert('Error fetching stalls: ' + error.message, 'error');
        selectStall.innerHTML = '<option value="">Error loading stalls</option>';
        return;
    }

    if (!stalls || stalls.length === 0) {
        selectStall.innerHTML = '<option value="">No market stalls found for this character</option>';
    } else {
        selectStall.innerHTML = '<option value="">Select Market Stall</option>';
        stalls.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.stall_name || 'Unnamed Stall'} (${s.region || 'Unknown Region'})`;
            selectStall.appendChild(opt);
        });
        selectStall.disabled = false;
        
        if (stalls.length === 1) {
            selectStall.value = stalls[0].id;
        }
        
        if (selectStall.value) {
            importSubmitBtn.disabled = false;
        }
    }
};

export const openImportModal = async () => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return displayTailwindAlert(userError?.message || 'You must be logged in to import listings.', 'error');

  const { data: characters, error } = await supabase
    .from('characters')
    .select('character_id, character_name')
    .eq('user_id', user.id);

  if (error) return displayTailwindAlert('Error fetching characters: ' + error.message, 'error');

  if (!characters || characters.length === 0) {
    noCharactersWarning.classList.remove('hidden');
    selectCharacter.style.display = 'none';
    selectStall.style.display = 'none';
    importSubmitBtn.disabled = true;
  } else {
    noCharactersWarning.classList.add('hidden');
    selectCharacter.style.display = 'block';
    selectStall.style.display = 'block';
    
    selectCharacter.innerHTML = '<option value="">Select Character</option>';
    characters.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.character_id;
      opt.textContent = c.character_name;
      selectCharacter.appendChild(opt);
    });
    
    selectStall.innerHTML = '<option value="">Select a character first</option>';
  }

  importModal.classList.remove('hidden');
};

selectCharacter.addEventListener('change', () => {
    const charId = selectCharacter.value;
    populateStalls(charId);
});

selectStall.addEventListener('change', () => {
    importSubmitBtn.disabled = !selectStall.value;
});

importCancelBtn.addEventListener('click', () => {
  importModal.classList.add('hidden');
  importFile.value = '';
});

importSubmitBtn.addEventListener('click', async () => {
  const charId = selectCharacter.value;
  const marketStallId = selectStall.value;
  const file = importFile.files[0];
  
  if (!charId) return displayTailwindAlert('Please select a character.', 'warning');
  if (!marketStallId) return displayTailwindAlert('Please select a market stall.', 'warning');
  if (!file) return displayTailwindAlert('Please select a JSON file.', 'warning');

  try {
    const text = await file.text();
    const jsonData = JSON.parse(text);
    
    if (!Array.isArray(jsonData) || jsonData.length === 0) return displayTailwindAlert('JSON file is empty or invalid.', 'error');

    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_name');

    if (itemsError) return displayTailwindAlert('Error fetching items: ' + itemsError.message, 'error');

    const insertData = jsonData.map(item => {
      const matchedItem = items.find(i => i.item_name === item.item_name);
      if (!matchedItem) return null;
      
      const totalStackPrice = item.price;
      const unitPrice = totalStackPrice / item.quantity;
      
      return {
        item_id: matchedItem.item_id,
        character_id: charId,
        quantity_listed: item.quantity,
        listed_price_per_unit: unitPrice,
        total_listed_price: totalStackPrice,
        market_fee: Math.ceil(totalStackPrice * 0.05),
        market_stall_id: marketStallId,
        listing_date: new Date(item.creation_date * 1000).toISOString(),
        is_fully_sold: false,
        is_cancelled: false
      };
    }).filter(x => x !== null);

    if (insertData.length === 0) return displayTailwindAlert('No matching items found in your database.', 'warning');

    const { error } = await supabase
      .from('market_listings')
      .insert(insertData);

    if (error) {
      displayTailwindAlert('Error importing listings: ' + error.message, 'error');
    } else {
      const successMessage = `Successfully imported ${insertData.length} listings! Click Ok to refresh the listing table.`;
      
      await showBlockingConfirmation(successMessage);
      
      importModal.classList.add('hidden');
      importFile.value = '';
      fetchActiveListings(currentPage, getCurrentFilters());
    }

  } catch (err) {
    displayTailwindAlert('Error parsing JSON: ' + err.message, 'error');
  }
});