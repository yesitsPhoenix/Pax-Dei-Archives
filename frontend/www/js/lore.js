// lore.js
// Handles dynamic loading and display of lore content from Supabase.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Your Supabase credentials
const SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImexZzI0cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Markdown Renderer (assuming marked.js is loaded via CDN in HTML)
const renderMarkdown = (markdownText) => {
    if (typeof marked === 'undefined') {
        console.error("marked.js is not loaded. Cannot render Markdown.");
        return `<p>${markdownText}</p>`; // Fallback to plain text
    }
    return marked.parse(markdownText);
};

// Function to parse URL query parameters
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

// Function to fetch unique lore categories from Supabase
async function fetchLoreCategories() {
    const { data, error } = await supabase
        .from('lore_items')
        .select('category')
        .order('category', { ascending: true });

    if (error) {
        console.error('Error fetching lore categories:', error.message);
        return [];
    }

    // Use a Set to ensure unique categories and then convert back to array
    const uniqueCategories = [...new Set(data.map(item => item.category))];
    return uniqueCategories;
}

// Function to fetch lore items, optionally filtered by category
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

// Function to fetch detailed lore item content by slug
async function fetchLoreItemDetail(slug) {
    const { data, error } = await supabase
        .from('lore_items')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error) {
        // PGRST116 is the Supabase code for "no rows found" - not a critical error if expected
        if (error.code !== 'PGRST116') {
            console.error('Error fetching lore item detail:', error.message);
        }
        return null;
    }
    return data;
}

// Main logic for the lore page
$(document).ready(async function() {
    // Cache jQuery selectors for performance
    const loreCategoriesSection = $('#lore-categories-section');
    const dynamicLoreContentWrapper = $('#dynamic-lore-content-wrapper');
    const loreSidebar = $('#lore-sidebar');
    const loreCategoryList = $('#lore-category-list');
    const loreItemList = $('#lore-item-list');
    const dynamicLoreMainContent = $('#dynamic-lore-main-content');

    // Function to update the browser's URL and history state
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

    // Function to display lore content based on selected category and item slug
    async function displayLoreContent(selectedCategory, selectedItemSlug = null) {
        // Show loading state and hide initial category cards
        loreCategoriesSection.hide();
        dynamicLoreContentWrapper.show();
        loreSidebar.show();
        dynamicLoreMainContent.html('<div class="lore-loading-indicator">Loading lore...</div>');

        // --- Populate Categories in Sidebar ---
        const categories = await fetchLoreCategories();
        loreCategoryList.empty(); // Clear existing list items
        if (categories.length > 0) {
            categories.forEach(cat => {
                const li = `<li><a href="lore.html?category=${encodeURIComponent(cat)}" class="${selectedCategory === cat ? 'active-lore-category' : ''}">${cat}</a></li>`;
                loreCategoryList.append(li);
            });
        } else {
            loreCategoryList.append('<li>No lore categories found.</li>');
        }

        // --- Populate Items in Sidebar for the selected category ---
        loreItemList.empty(); // Clear existing list items
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
            // If a specific item slug is provided, fetch and display its details
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
            // If only a category is selected (and no item slug was provided to displayLoreContent),
            // it means the URL was updated to include the first item.
            // This path should ideally only be hit if there are no items in the category,
            // or if the URL was somehow malformed after a category selection.
            dynamicLoreMainContent.html('<div class="lore-no-content-message">Select an item from the sidebar to view content.</div>');
        } else {
            // Default message if no category or item is selected
            dynamicLoreMainContent.html('<div class="lore-no-content-message">Select a lore category or item to view content.</div>');
        }
    }

    // --- Initial Page Load Logic ---
    const initialParams = getQueryParams();
    const initialCategory = initialParams.category;
    let initialItemSlug = initialParams.item; // Use 'let' because it might be updated

    if (initialCategory || initialItemSlug) {
        // If only a category is present in the initial URL (e.g., lore.html?category=World),
        // we need to automatically select the first item and update the URL accordingly.
        if (initialCategory && !initialItemSlug) {
            const items = await fetchLoreItems(initialCategory);
            if (items.length > 0) {
                initialItemSlug = items[0].slug; // Set the first item's slug
                updateUrl(initialCategory, initialItemSlug); // Update URL in browser history
            }
            // If no items in the category, initialItemSlug remains null, and displayLoreContent will handle it.
        }
        // Now, call displayLoreContent with the (potentially updated) item slug
        displayLoreContent(initialCategory, initialItemSlug);
    } else {
        // If no category or item in URL, show the initial category cards
        loreCategoriesSection.show();
        dynamicLoreContentWrapper.hide();
    }

    // --- Event Listeners ---

    // Handle clicks on the initial category feature cards
    $(document).on('click', '#lore-categories-section .feature-card a', async function(e) {
        e.preventDefault(); // Prevent the default full page reload
        const href = $(this).attr('href');
        const url = new URL(href, window.location.origin);
        const newCategory = url.searchParams.get('category');
        let newItemSlug = null; // Will store the slug of the first item in the new category

        // Fetch items for the clicked category to get the first item's slug
        const items = await fetchLoreItems(newCategory);
        if (items.length > 0) {
            newItemSlug = items[0].slug;
        }

        // Update the URL with the selected category and the first item (if found)
        updateUrl(newCategory, newItemSlug);
        // Display the content for the selected category and its first item
        displayLoreContent(newCategory, newItemSlug);
    });

    // Handle clicks on sidebar links (both categories and individual lore items)
    // Using event delegation as these elements are dynamically added
    $(document).on('click', '#lore-category-list a, #lore-item-list a', function(e) {
        e.preventDefault(); // Prevent default link behavior (full page reload)
        const href = $(this).attr('href');
        const url = new URL(href, window.location.origin);
        const newCategory = url.searchParams.get('category');
        const newItemSlug = url.searchParams.get('item');

        // Update URL and display content based on the clicked link
        updateUrl(newCategory, newItemSlug);
        displayLoreContent(newCategory, newItemSlug);
    });

    // Handle browser back/forward button clicks using the History API
    window.onpopstate = function(event) {
        const params = getQueryParams();
        // If navigating back to the base lore.html (no category/item in URL)
        if (!params.category && !params.item) {
            loreCategoriesSection.show();
            dynamicLoreContentWrapper.hide();
        } else {
            // If navigating back to a category-only URL, find the first item
            if (params.category && !params.item) {
                // Asynchronously fetch items to get the first one for the category
                (async () => {
                    const items = await fetchLoreItems(params.category);
                    if (items.length > 0) {
                        displayLoreContent(params.category, items[0].slug);
                    } else {
                        displayLoreContent(params.category); // Show "no items" if category is empty
                    }
                })();
            } else {
                // Navigate back to a specific item
                displayLoreContent(params.category, params.item);
            }
        }
    };
});