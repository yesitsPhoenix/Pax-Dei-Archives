// lore.js

import { supabase } from './supabaseClient.js';

const renderMarkdown = (markdownText) => {
    if (typeof marked === 'undefined') {
        console.error("marked.js is not loaded. Cannot render Markdown.");
        return `<p>${markdownText}</p>`;
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
        if (error.code !== 'PGRST116') {
            console.error('Error fetching lore item detail:', error.message);
        }
        return null;
    }
    return data;
}

function getCategoryIcon(category) {
    switch (category) {
        case 'World': return 'fa-earth-americas';
        case 'Creation': return 'fa-scroll';
        case 'Divine': return 'fa-star';
        case 'Factions': return 'fa-users-gear';
        case 'Known Figures': return 'fa-user-tie';
        case 'Placeholder 1': return 'fa-book';
        case 'Placeholder 2': return 'fa-dragon';
        case 'Placeholder 3': return 'fa-flask';
        case 'Placeholder 4': return 'fa-gavel';
        case 'Placeholder 5': return 'fa-cloud';
        default: return 'fa-book';
    }
}

async function renderSmallCategoryCards(selectedCategory = null) {
    const categories = await fetchLoreCategories();
    const smallLoreCategoryCards = $('#small-lore-category-cards');
    smallLoreCategoryCards.empty();

    if (categories.length > 0) {
        categories.forEach(cat => {
            const iconClass = getCategoryIcon(cat);
            const isActive = selectedCategory === cat ? 'active-small-card' : '';
            const cardHtml = `
                <div class="col-auto"> <div class="feature-card small-feature-card ${isActive}">
                        <a href="lore.html?category=${encodeURIComponent(cat)}">
                            <i class="fa-solid ${iconClass}"></i>
                            <h5>${cat}</h5>
                        </a>
                    </div>
                </div>
            `;
            smallLoreCategoryCards.append(cardHtml);
        });
    } else {
        smallLoreCategoryCards.append('<div class="col-lg-12"><p>No lore categories found.</p></div>');
    }
}


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

    async function displayLoreContent(selectedCategory, selectedItemSlug = null, itemsData = null) {
        loreCategoriesSection.hide();
        dynamicLoreContentWrapper.show();
        loreSidebar.show();

        dynamicLoreMainContent.empty();


        const categories = await fetchLoreCategories();
        loreCategoryList.empty();
        if (categories.length > 0) {
            categories.forEach(cat => {
                const li = `<li><a href="lore.html?category=${encodeURIComponent(cat)}" class="${selectedCategory === cat ? 'active-lore-category' : ''}">${cat}</a></li>`;
                loreCategoryList.append(li);
            });
        } else {
            loreCategoryList.append('<li>No lore categories found.</li>');
        }

        loreItemList.empty();
        if (selectedCategory) {
            let items;
            if (itemsData) {
                items = itemsData;
            } else {
                items = await fetchLoreItems(selectedCategory);
            }

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
            dynamicLoreMainContent.html('<div class="lore-no-content-message">Select an item from the sidebar to view content.</div>');
        } else {
            dynamicLoreMainContent.html('<div class="lore-no-content-message">Select a lore category or item to view content.</div>');
        }

        await renderSmallCategoryCards(selectedCategory);
    }

    const initialParams = getQueryParams();
    const initialCategory = initialParams.category;
    let initialItemSlug = initialParams.item;
    let fetchedInitialItems = null;

    if (initialCategory || initialItemSlug) {

        if (initialCategory && !initialItemSlug) {
            const items = await fetchLoreItems(initialCategory);
            fetchedInitialItems = items;
            if (items.length > 0) {
                initialItemSlug = items[0].slug;
                updateUrl(initialCategory, initialItemSlug);
            }
        }

        displayLoreContent(initialCategory, initialItemSlug, fetchedInitialItems);
    } else {
        loreCategoriesSection.show();
        dynamicLoreContentWrapper.hide();
        $('#small-lore-category-cards').empty();
    }

    $(document).on('click', '#lore-categories-section .feature-card a', async function(e) {
        e.preventDefault();
        const href = $(this).attr('href');
        const url = new URL(href, window.location.origin);
        const newCategory = url.searchParams.get('category');
        let newItemSlug = null;
        let fetchedItemsForCardClick = null;

        const items = await fetchLoreItems(newCategory);
        fetchedItemsForCardClick = items;
        if (items.length > 0) {
            newItemSlug = items[0].slug;
        }

        updateUrl(newCategory, newItemSlug);
        displayLoreContent(newCategory, newItemSlug, fetchedItemsForCardClick);
    });

    $(document).on('click', '#small-lore-category-cards .feature-card a', async function(e) {
        e.preventDefault();
        const href = $(this).attr('href');
        const url = new URL(href, window.location.origin);
        const newCategory = url.searchParams.get('category');
        let newItemSlug = null;
        let fetchedItemsForSmallCardClick = null;

        const items = await fetchLoreItems(newCategory);
        fetchedItemsForSmallCardClick = items;
        if (items.length > 0) {
            newItemSlug = items[0].slug;
        }

        updateUrl(newCategory, newItemSlug);
        displayLoreContent(newCategory, newItemSlug, fetchedItemsForSmallCardClick);
    });

    $(document).on('click', '#lore-category-list a, #lore-item-list a', async function(e) {
        e.preventDefault();
        const href = $(this).attr('href');
        const url = new URL(href, window.location.origin);
        const newCategory = url.searchParams.get('category');
        let newItemSlug = url.searchParams.get('item');
        let fetchedItemsForSidebarClick = null;

        if (newCategory && !newItemSlug) {
            const items = await fetchLoreItems(newCategory);
            fetchedItemsForSidebarClick = items;
            if (items.length > 0) {
                newItemSlug = items[0].slug;
            }
        }

        updateUrl(newCategory, newItemSlug);
        displayLoreContent(newCategory, newItemSlug, fetchedItemsForSidebarClick);
    });


    window.onpopstate = function(event) {
        const params = getQueryParams();

        if (!params.category && !params.item) {
            loreCategoriesSection.show();
            dynamicLoreContentWrapper.hide();
            $('#small-lore-category-cards').empty();
        } else {
            (async () => {
                let fetchedItemsForPopstate = null;
                if (params.category && !params.item) {
                    const items = await fetchLoreItems(params.category);
                    fetchedItemsForPopstate = items;
                    if (items.length > 0) {
                        displayLoreContent(params.category, items[0].slug, fetchedItemsForPopstate);
                    } else {
                        displayLoreContent(params.category, null, fetchedItemsForPopstate);
                    }
                } else {
                    displayLoreContent(params.category, params.item);
                }
            })();
        }
    };
});