import { supabase } from './supabaseClient.js';

function showFormMessage(messageElement, message, type) {
    messageElement.textContent = message;
    messageElement.className = '';
    if (type) {
        messageElement.classList.add('form-message', type);
        messageElement.style.display = 'block';

        if (message) {
            setTimeout(() => {
                messageElement.style.display = 'none';
                messageElement.textContent = '';
            }, 5000);
        }
    } else {
        messageElement.style.display = 'none';
        messageElement.textContent = '';
    }
}


function slugify(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '') 
        .replace(/--+/g, '-');
}


async function populateCategorySelect(selectElement) {
    if (!selectElement) {
        console.warn('Category select element not found. Cannot populate categories.');
        return;
    }
    selectElement.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a category';
    defaultOption.selected = true;
    defaultOption.disabled = true; 
    selectElement.appendChild(defaultOption);

    try {
        const { data, error } = await supabase
            .from('tag_list')
            .select('tag_name')
            .order('tag_name', { ascending: true });

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

    await populateCategorySelect(articleCategorySelect);

    if (articleTitleInput && articleSlugInput) {
        articleTitleInput.addEventListener('input', () => {
            articleSlugInput.value = slugify(articleTitleInput.value);
        });
    }

    if (addNewArticleCategoryButton && addNewArticleCategoryInput && articleCategorySelect) {
        addNewArticleCategoryButton.addEventListener('click', async () => {
            const newCategory = addNewArticleCategoryInput.value.trim();
            if (newCategory) {
                try {
                    const { data, error } = await supabase
                        .from('tag_list')
                        .insert([{ tag_name: newCategory }]);

                    if (error && error.code !== '23505') {
                        console.error('Error adding new article category:', error.message);
                        showFormMessage(addArticleMessage, 'Error adding category: ' + error.message, 'error');
                    } else {
                        if (error && error.code === '23505') {
                            showFormMessage(addArticleMessage, `Category '${newCategory}' already exists.`, 'warning');
                        } else {
                            showFormMessage(addArticleMessage, `Category '${newCategory}' added successfully!`, 'success');
                        }
                        addNewArticleCategoryInput.value = '';
                        await populateCategorySelect(articleCategorySelect);
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

    if (addArticleForm) {
        addArticleForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            showFormMessage(addArticleMessage, '', '');

            const submitButton = addArticleForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting...';
            }

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

            if (!publication_date) {
                publication_date = new Date().toISOString();
            } else {
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

                const { data, error } = await supabase
                    .from('articles')
                    .insert([newArticle])
                    .select();

                if (error) {
                    console.error('Error inserting article:', error);
                    showFormMessage(addArticleMessage, `Error saving article: ${error.message}`, 'error');
                } else {
                    showFormMessage(addArticleMessage, 'Article added successfully!', 'success');
                    // Reset the form after successful submission
                    addArticleForm.reset();
                    await populateCategorySelect(articleCategorySelect); 
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
