import {
    supabase
} from '../supabaseClient.js';

export const setupAutocomplete = async (inputElement, suggestionsContainer, categorySelectElement) => {
    let debounceTimer;
    inputElement.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const query = inputElement.value.trim();
            if (query.length < 2) {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.classList.remove('active');
                return;
            }

            try {
                const {
                    data,
                    error
                } = await supabase
                    .from('items')
                    .select('item_name, category_id')
                    .ilike('item_name', `%${query}%`)
                    .limit(10);

                if (error) throw error;

                suggestionsContainer.innerHTML = '';
                if (data.length > 0) {
                    data.forEach(item => {
                        const div = document.createElement('div');
                        div.classList.add('autocomplete-item');
                        div.textContent = item.item_name;
                        div.addEventListener('click', () => {
                            inputElement.value = item.item_name;
                            if (categorySelectElement && item.category_id) {
                                categorySelectElement.value = item.category_id;
                            }
                            suggestionsContainer.innerHTML = '';
                            suggestionsContainer.classList.remove('active');
                        });
                        suggestionsContainer.appendChild(div);
                    });
                    suggestionsContainer.classList.add('active');
                } else {
                    suggestionsContainer.classList.remove('active');
                }
            } catch (e) {
                console.error('Error fetching autocomplete suggestions:', e);
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.classList.remove('active');
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!suggestionsContainer.contains(e.target) && e.target !== inputElement) {
            suggestionsContainer.classList.remove('active');
        }
    });
};