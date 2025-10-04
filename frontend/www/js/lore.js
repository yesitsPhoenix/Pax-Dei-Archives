// const QUART_API_BASE_URL = 'https://homecraftlodge.serveminecraft.net';

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

let allLoreData = null;

async function fetchAllLoreData() {
    if (allLoreData) {
        return allLoreData;
    }
    try {
        const response = await fetch('backend/data/lore-index.json');
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status} fetching lore-index.json`);
            return [];
        }
        const data = await response.json();
        allLoreData = data;
        return data;
    } catch (error) {
        console.error('Network or other error fetching lore-index.json:', error);
        return [];
    }
}

async function fetchLoreCategories() {
    const data = await fetchAllLoreData();
    return data.map(cat => cat.category);
}

async function fetchLoreItems(category = null) {
    const data = await fetchAllLoreData();
    if (category) {
        const categoryData = data.find(cat => cat.category === category);
        return categoryData ? categoryData.items : [];
    }
    return data.flatMap(cat => cat.items);
}


async function fetchLoreItemDetail(slug) {
    const data = await fetchAllLoreData();
    let itemPath = null;
    let loreItemMeta = null;
    for (const category of data) {
        const foundItem = category.items.find(item => item.slug === slug);
        if (foundItem) {
            itemPath = foundItem.file;
            loreItemMeta = foundItem;
            break;
        }
    }

    if (!itemPath) {
        console.warn(`Lore item with slug '${slug}' not found in index.`);
        return null;
    }

    try {
        const response = await fetch(`backend/data/${itemPath}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Lore item Markdown file not found: ${itemPath}`);
                return null;
            }
            console.error(`HTTP error! status: ${response.status} fetching ${itemPath}`);
            return null;
        }
        const content = await response.text();
        return { ...loreItemMeta, content: content };
    } catch (error) {
        console.error(`Network or other error fetching lore item detail for ${itemPath}:`, error);
        return null;
    }
}

function getCategoryIcon(category) {
    switch (category) {
        case 'World': return 'fa-earth-americas';
        case 'Creation': return 'fa-scroll';
        case 'Divine': return 'fa-star';
        case 'Factions': return 'fa-users-gear';
        case 'Known Figures': return 'fa-user-tie';
        case 'Ages': return 'fa-hourglass-half';
        case 'Redeemer': return 'fa-hand-holding-heart';
        case 'Writings': return 'fa-pen-nib';
        case 'Magic': return 'fa-wand-magic-sparkles';
        case 'Geography': return 'fa-mountain-sun';
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
                <div class="col-auto">
                    <div class="feature-card small-feature-card ${isActive}">
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
    const loreCategoriesSection = $('#lore-categories-section');
    const dynamicLoreContentWrapper = $('#dynamic-lore-content-wrapper');
    const loreCategoryList = $('#lore-category-list');
    const loreItemList = $('#lore-item-list');
    const dynamicLoreMainContent = $('#dynamic-lore-main-content');
    
    if (!selectedCategory && !selectedItemSlug) {
        loreCategoriesSection.show();
        dynamicLoreContentWrapper.hide();
        $('#small-lore-category-cards').empty();
        return;
    } else {
        loreCategoriesSection.hide();
        dynamicLoreContentWrapper.show();
    }

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
            loreItemList.append('<li>No entries in this category.</li>');
        }
    } else {
        loreItemList.append('<li>Select a category.</li>');
    }
    
    dynamicLoreMainContent.empty();

    if (selectedItemSlug) {
        const loreItem = await fetchLoreItemDetail(selectedItemSlug);
        if (loreItem) {
            const author = loreItem.author || '';
            const date = loreItem.date || '';
            const titles = loreItem.titles || '';
            const association = loreItem.association || '';
            const known_works = loreItem.known_works || '';
            const rawContent = loreItem.content || '';
            const sources = loreItem.sources || '';
            const rawResearch = loreItem.research || '';

            const renderedContent = renderMarkdown(rawContent);

            let sourcesResearchHtml = '';
            if (sources || rawResearch) {
                sourcesResearchHtml = `
                    <div class="lore-item-footer">
                        <h5>Sources & Research Notes</h5>
                        ${sources ? `<p><strong>Source(s):</strong> ${renderMarkdown(sources)}</p>` : ''}
                        ${rawResearch ? `<p><strong>Future Research/Notes/Cross References:</strong> ${renderMarkdown(rawResearch)}</p>` : ''}
                    </div>
                `;
            }

            let metaHtml = '';
            if (author) {
                metaHtml += `<p><strong>Author:</strong> ${author}</p>`;
            }
            if (titles) {
                metaHtml += `<p><strong>Titles:</strong> ${titles}</p>`;
            }
            if (association) {
                metaHtml += `<p><strong>Association:</strong> ${association}</p>`;
            }
            if (date) {
                metaHtml += `<p><strong>Date:</strong> ${date}</p>`;
            }
            if (known_works) {
                metaHtml += `<p><strong>Known Works:</strong> ${known_works}</p>`;
            }

            dynamicLoreMainContent.html(`
                <div class="lore-item-header">
                    <h4>${loreItem.title}</h4>
                    ${metaHtml ? `<div class="lore-meta">${metaHtml}</div>` : ''}
                </div>
                <div class="lore-item-content">
                    ${renderedContent}
                </div>
                ${sourcesResearchHtml}
            `);
        } else {
            dynamicLoreMainContent.html('<div class="lore-no-content-message">Lore entry not found. Please select an entry from the list.</div>');
        }
    } else if (selectedCategory) {
        dynamicLoreMainContent.html(`
            <div class="lore-item-header">
                <h4>${selectedCategory} Archives</h4>
            </div>
            <div class="lore-no-content-message">Select an entry from the "Entries" sidebar to view its content.</div>
        `);
    } else {
        dynamicLoreMainContent.html('<div class="lore-no-content-message"><h3>Welcome to the Lore Archives.</h3><p>Please select a category from the sidebar or one of the cards above to begin exploring the world\'s history.</p></div>');
    }

    await renderSmallCategoryCards(selectedCategory);
}


$(document).ready(async function() {
    const initialParams = getQueryParams();
    const initialCategory = initialParams.category;
    let initialItemSlug = initialParams.item;
    let fetchedInitialItems = null;

    if (initialCategory && !initialItemSlug) {
        const items = await fetchLoreItems(initialCategory);
        fetchedInitialItems = items;
        if (items.length > 0) {
            initialItemSlug = items[0].slug;
            updateUrl(initialCategory, initialItemSlug);
        }
    }
    
    displayLoreContent(initialCategory, initialItemSlug, fetchedInitialItems);



    $(document).on('click', '#lore-categories-section .feature-card a', async function(e) {
        e.preventDefault();
        const href = $(this).attr('href');
        const url = new URL(href, window.location.origin);
        const newCategory = url.searchParams.get('category');
        
        let newItemSlug = null;
        const items = await fetchLoreItems(newCategory);
        if (items.length > 0) {
            newItemSlug = items[0].slug;
        }

        updateUrl(newCategory, newItemSlug);
        displayLoreContent(newCategory, newItemSlug, items);
    });

    $(document).on('click', '#small-lore-category-cards .feature-card a, #lore-category-list a', async function(e) {
        e.preventDefault();
        const href = $(this).attr('href');
        const url = new URL(href, window.location.origin);
        const newCategory = url.searchParams.get('category');
        
        let newItemSlug = null;
        const items = await fetchLoreItems(newCategory);
        if (items.length > 0) {
            newItemSlug = items[0].slug;
        }

        updateUrl(newCategory, newItemSlug);
        displayLoreContent(newCategory, newItemSlug, items);
    });

    $(document).on('click', '#lore-item-list a', async function(e) {
        e.preventDefault();
        const href = $(this).attr('href');
        const url = new URL(href, window.location.origin);
        const newCategory = url.searchParams.get('category');
        const newItemSlug = url.searchParams.get('item');
        
        updateUrl(newCategory, newItemSlug);
        displayLoreContent(newCategory, newItemSlug);
    });


    window.onpopstate = function(event) {
        const params = getQueryParams();
        
        if (!params.category && !params.item) {
            displayLoreContent(null, null, null);
            return;
        }
        
        if (params.category && !params.item) {
            (async () => {
                const items = await fetchLoreItems(params.category);
                if (items.length > 0) {
                    displayLoreContent(params.category, items[0].slug, items);
                } else {
                    displayLoreContent(params.category, null, items);
                }
            })();
        } else {
            displayLoreContent(params.category, params.item);
        }
    };
});