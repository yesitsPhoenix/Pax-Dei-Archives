// lore.js
// Handles dynamic loading and display of lore content from Supabase.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Markdown Renderer (assuming marked.js is loaded via CDN in HTML)
const renderMarkdown = (markdownText) => {
    if (typeof marked === 'undefined') {
        console.error("marked.js is not loaded. Cannot render Markdown.");
        return `<p>${markdownText}</p>`; // Fallback to plain text
    }
    return marked.parse(markdownText);
};


function getQueryParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const regex = /([^&=]+)=([^&]*)/g;
    let m;
    while ((m = regex.exec(queryString))) {
        params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
    }
    return params;
}


async function fetchLoreCategories() {
    const { data, error } = await supabase
        .from('lore_items')
        .select('category')
        .order('category', { ascending: true });

    if (error) {
        console.error('Error fetching lore categories:', error.message);
        return [];
    }

    // Use a Set to ensure unique categories
    const uniqueCategories = [...new Set(data.map(item => item.category))];
    return uniqueCategories;
}


async function fetchLoreItems(category = null) {
    let query = supabase
        .from('lore_items')
        .select('title, slug, category')
        .order('title', { ascending: true });

    if (category) {
        query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching lore items:', error.message);
        return [];
    }
    return data;
}


async function fetchLoreItemDetail(slug) {
    const { data, error } = await supabase
        .from('lore_items')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error) {
        if (error.code !== 'PGRST116') { // Supabase code for "no rows found"
            console.error('Error fetching lore item detail:', error.message);
        }
        return null;
    }
    return data;
}

// Main logic for the lore page
$(document).ready(async function() {
    const loreCategoriesSection = $('#lore-categories-section');
    const dynamicLoreContentWrapper = $('#dynamic-lore-content-wrapper');
    const loreSidebar = $('#lore-sidebar');
    const loreCategoryList = $('#lore-category-list');
    const loreItemList = $('#lore-item-list');
    const dynamicLoreMainContent = $('#dynamic-lore-main-content');


    function updateUrl(newCategory, newItemSlug = null) {
        let newUrl = 'lore.html';
        const queryParts = [];
        if (newCategory) {
            queryParts.push(`category=${encodeURIComponent(newCategory)}`);
        }
        if (newItemSlug) {
            queryParts.push(`item=${encodeURIComponent(newItemSlug)}`);
        }
        if (queryParts.length > 0) {
            newUrl += '?' + queryParts.join('&');
        }
        window.history.pushState({ category: newCategory, item: newItemSlug }, '', newUrl);
    }


    async function displayLoreContent(selectedCategory, selectedItemSlug = null) {
        loreCategoriesSection.hide();
        dynamicLoreContentWrapper.show();
        loreSidebar.show();
        dynamicLoreMainContent.html('<div class="lore-loading-indicator">Loading lore...</div>');

        // --- Populate Categories in Sidebar ---
        const categories = await fetchLoreCategories();
        loreCategoryList.empty(); // Ensure the list is cleared before appending
        if (categories.length > 0) {
            categories.forEach(cat => {
                const li = `<li><a href="lore.html?category=${encodeURIComponent(cat)}" class="${selectedCategory === cat ? 'active-lore-category' : ''}">${cat}</a></li>`;
                loreCategoryList.append(li);
            });
        } else {
            loreCategoryList.append('<li>No lore categories found.</li>');
        }


        // --- Populate Items in Sidebar for the selected category ---
        loreItemList.empty(); // Ensure the list is cleared before appending
        if (selectedCategory) {
            const items = await fetchLoreItems(selectedCategory);
            if (items.length > 0) {
                items.forEach(item => {
                    const li = `<li><a href="lore.html?category=${encodeURIComponent(selectedCategory)}&item=${encodeURIComponent(item.slug)}" class="${selectedItemSlug === item.slug ? 'active-lore-item' : ''}">${item.title}</a></li>`;
                    loreItemList.append(li);
                });
            } else {
                loreItemList.append('<li>No items in this category.</li>');
            }
        } else {
            loreItemList.append('<li>Select a category to see items.</li>');
        }

        // --- Display Main Content ---
        if (selectedItemSlug) {
            const loreItem = await fetchLoreItemDetail(selectedItemSlug);
            if (loreItem) {
                dynamicLoreMainContent.html(`
                    <div class="heading-section">
                        <h4>${loreItem.title}</h4>
                    </div>
                    ${renderMarkdown(loreItem.content)}
                `);
            } else {
                dynamicLoreMainContent.html('<div class="lore-no-content-message">Lore item not found.</div>');
            }
        } else if (selectedCategory) {
            // If only category is selected, try to load the first item in that category
            const items = await fetchLoreItems(selectedCategory);
            if (items.length > 0) {
                // Automatically load the first item in the category if no specific item is chosen
                updateUrl(selectedCategory, items[0].slug); // Update URL to reflect the item
                displayLoreContent(selectedCategory, items[0].slug); // Recursively call to display the item
            } else {
                dynamicLoreMainContent.html('<div class="lore-no-content-message">No lore items found for this category.</div>');
            }
        } else {
            dynamicLoreMainContent.html('<div class="lore-no-content-message">Select a lore category or item to view content.</div>');
        }
    }

    // --- Initial Page Load Logic ---
    const initialParams = getQueryParams();
    const initialCategory = initialParams.category;
    const initialItemSlug = initialParams.item;

    if (initialCategory || initialItemSlug) {
        displayLoreContent(initialCategory, initialItemSlug);
    } else {
        loreCategoriesSection.show();
        dynamicLoreContentWrapper.hide();
    }

    // --- Event Listeners ---

    // Handle clicks on initial feature cards to prevent full page reload
    $(document).on('click', '#lore-categories-section .feature-card a', function(e) {
        e.preventDefault(); // Prevent default link behavior (full page reload)
        const href = $(this).attr('href');
        const url = new URL(href, window.location.origin);
        const newCategory = url.searchParams.get('category');

        updateUrl(newCategory); // Update URL with just the category
        displayLoreContent(newCategory); // Display content for the selected category
    });

    // Handle clicks on sidebar links (using event delegation for dynamically added elements)
    $(document).on('click', '#lore-category-list a, #lore-item-list a', function(e) {
        e.preventDefault(); // Prevent default link behavior
        const href = $(this).attr('href');
        const url = new URL(href, window.location.origin);
        const newCategory = url.searchParams.get('category');
        const newItemSlug = url.searchParams.get('item');

        // Update URL and display content
        updateUrl(newCategory, newItemSlug);
        displayLoreContent(newCategory, newItemSlug);
    });

    // Handle browser back/forward buttons
    window.onpopstate = function(event) {
        const params = getQueryParams();
        // If coming back to the base lore.html without params, show categories
        if (!params.category && !params.item) {
            loreCategoriesSection.show();
            dynamicLoreContentWrapper.hide();
        } else {
            displayLoreContent(params.category, params.item);
        }
    };
});
