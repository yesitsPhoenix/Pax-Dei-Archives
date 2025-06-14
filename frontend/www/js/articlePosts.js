import { supabase } from './supabaseClient.js';

/**
 * Displays a message on a given HTML element, applying a specific style type (e.g., 'success', 'error', 'info').
 * The message will automatically disappear after 5 seconds if a message is provided.
 * @param {HTMLElement} messageElement - The HTML element where the message will be displayed.
 * @param {string} message - The message text to display.
 * @param {string} [type] - The type of message ('success', 'error', 'info', 'warning'). Optional.
 */
function showFormMessage(messageElement, message, type) {
    messageElement.textContent = message;
    messageElement.className = ''; // Clear existing classes
    if (type) {
        messageElement.classList.add('form-message', type); // Add base class and type class
        messageElement.style.display = 'block';

        if (message) {
            setTimeout(() => {
                messageElement.style.display = 'none';
                messageElement.textContent = '';
            }, 5000); // Hide message after 5 seconds
        }
    } else {
        // If no type or message, hide the element and clear text
        messageElement.style.display = 'none';
        messageElement.textContent = '';
    }
}

/**
 * Converts a string into a URL-friendly slug.
 * @param {string} text - The input string to slugify.
 * @returns {string} The slugified string.
 */
function slugify(text) {
    return text
        .toString()
        .normalize('NFD') // Normalize Unicode characters
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .toLowerCase()
        .trim() // Trim whitespace from both ends
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(/[^\w-]+/g, '') // Remove all non-word chars
        .replace(/--+/g, '-'); // Replace multiple - with single -
}

/**
 * Populates a select element with tags from the 'tag_list' table in Supabase.
 * @param {HTMLElement} selectElement - The HTML select element to populate.
 */
async function populateCategorySelect(selectElement) {
    if (!selectElement) {
        console.warn('Category select element not found. Cannot populate categories.');
        return;
    }
    selectElement.innerHTML = ''; // Clear existing options

    // Add a default "Select a category" option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a category';
    defaultOption.selected = true;
    defaultOption.disabled = true; // Make it non-selectable
    selectElement.appendChild(defaultOption);

    try {
        const { data, error } = await supabase
            .from('tag_list')
            .select('tag_name')
            .order('tag_name', { ascending: true }); // Order alphabetically

        if (error) {
            console.error('Error fetching categories for article form:', error.message);
            return;
        }

        if (data && data.length > 0) {
            data.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag.tag_name;
                option.textContent = tag.tag_name;
                selectElement.appendChild(option);
            });
        }
    } catch (e) {
        console.error('Unexpected error populating categories for article form:', e);
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const addArticleForm = document.getElementById('addArticleForm');
    const articleTitleInput = document.getElementById('articleTitle');
    const articleContentInput = document.getElementById('articleContent');
    const articleSummaryInput = document.getElementById('articleSummary');
    const articleAuthorInput = document.getElementById('articleAuthor');
    const articleCategorySelect = document.getElementById('articleCategory');
    const articleSlugInput = document.getElementById('articleSlug');
    const articlePublicationDateInput = document.getElementById('articlePublicationDate');
    const addArticleMessage = document.getElementById('addArticleMessage');
    const addNewArticleCategoryInput = document.getElementById('addNewArticleCategoryInput');
    const addNewArticleCategoryButton = document.getElementById('addNewArticleCategoryButton');

    // Populate the category dropdown on page load
    await populateCategorySelect(articleCategorySelect);

    // Automatically generate slug from title
    if (articleTitleInput && articleSlugInput) {
        articleTitleInput.addEventListener('input', () => {
            articleSlugInput.value = slugify(articleTitleInput.value);
        });
    }

    // Add new article category functionality
    if (addNewArticleCategoryButton && addNewArticleCategoryInput && articleCategorySelect) {
        addNewArticleCategoryButton.addEventListener('click', async () => {
            const newCategory = addNewArticleCategoryInput.value.trim();
            if (newCategory) {
                try {
                    const { data, error } = await supabase
                        .from('tag_list')
                        .insert([{ tag_name: newCategory }]);

                    if (error && error.code !== '23505') { // 23505 is unique violation code
                        console.error('Error adding new article category:', error.message);
                        showFormMessage(addArticleMessage, 'Error adding category: ' + error.message, 'error');
                    } else {
                        if (error && error.code === '23505') {
                            showFormMessage(addArticleMessage, `Category '${newCategory}' already exists.`, 'warning');
                        } else {
                            showFormMessage(addArticleMessage, `Category '${newCategory}' added successfully!`, 'success');
                        }
                        addNewArticleCategoryInput.value = ''; // Clear input field
                        await populateCategorySelect(articleCategorySelect); // Repopulate dropdown
                    }
                } catch (e) {
                    console.error('Unexpected error adding new article category:', e);
                    showFormMessage(addArticleMessage, 'An unexpected error occurred while adding category.', 'error');
                }
            } else {
                showFormMessage(addArticleMessage, 'Please enter a category name.', 'warning');
            }
        });
    }

    // Handle article form submission
    if (addArticleForm) {
        addArticleForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission
            showFormMessage(addArticleMessage, '', ''); // Clear previous messages

            const submitButton = addArticleForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting...';
            }

            // Get form values
            const title = articleTitleInput.value.trim();
            const content = articleContentInput.value.trim();
            const summary = articleSummaryInput.value.trim();
            const author = articleAuthorInput.value.trim();
            const category = articleCategorySelect.value;
            const slug = articleSlugInput.value.trim();
            let publication_date = articlePublicationDateInput.value;

            // Validate required fields
            if (!title || !content || !summary || !author || !category || !slug) {
                showFormMessage(addArticleMessage, 'Please fill in all required fields.', 'error');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Add Article to DB';
                }
                return;
            }

            // If publication date is not provided, use current UTC date
            if (!publication_date) {
                publication_date = new Date().toISOString();
            } else {
                // Ensure the provided date is in ISO format
                publication_date = new Date(publication_date).toISOString();
            }

            const newArticle = {
                title: title,
                content: content,
                summary: summary,
                author: author,
                category: category,
                slug: slug,
                publication_date: publication_date
            };

            showFormMessage(addArticleMessage, 'Submitting article...', 'info');

            try {
                // Check user authentication and authorization (similar to admin.html's checkAuth)
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    console.error("Auth Error before article insert:", authError);
                    showFormMessage(addArticleMessage, 'Please log in to submit articles.', 'error');
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Add Article to DB';
                    }
                    return;
                }

                // Insert data into the 'articles' table
                const { data, error } = await supabase
                    .from('articles')
                    .insert([newArticle])
                    .select(); // Use .select() to get the inserted data back if needed

                if (error) {
                    console.error('Error inserting article:', error);
                    showFormMessage(addArticleMessage, `Error saving article: ${error.message}`, 'error');
                } else {
                    showFormMessage(addArticleMessage, 'Article added successfully!', 'success');
                    // Reset the form after successful submission
                    addArticleForm.reset();
                    await populateCategorySelect(articleCategorySelect); // Re-select default option
                    // Potentially trigger a dashboard stats refresh if articles are included in stats
                    // if (typeof fetchDashboardStats === 'function') {
                    //     fetchDashboardStats();
                    // }
                }
            } catch (err) {
                console.error('Unexpected error submitting article:', err);
                showFormMessage(addArticleMessage, 'An unexpected error occurred. Please try again.', 'error');
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Add Article to DB';
                }
            }
        });
    }
});
