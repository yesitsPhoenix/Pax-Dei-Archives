document.getElementById('searchInput').addEventListener('input', function() {
    const query = this.value.toLowerCase();
    const searchResultsContainer = document.getElementById('searchResults');
    const searchDropdown = document.querySelector('.search-results-dropdown');
    searchResultsContainer.innerHTML = '';

    // Hide the dropdown initially
    searchDropdown.style.display = 'none';

    // Check if there is input and the query is valid
    if (query.length > 0) {
        fetch("backend/data/search-index.json")
            .then(response => response.json())
            .then(data => {
                // Filter the results based on the query
                const results = data.filter(item => 
                    item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
                );
                
                if (results.length > 0) {
                    results.forEach(item => {
                        // Create a div for each result
                        const resultItem = document.createElement('div');
                        resultItem.classList.add('search-result-item');
                        resultItem.innerHTML = `
                            <strong>${item.title}</strong><br>
                            <em>${item.description}</em>
                        `;

                        // Attach a click event to navigate to the clicked page
                        resultItem.addEventListener('click', () => {
                            window.location.href = item.url;
                        });

                        searchResultsContainer.appendChild(resultItem);
                    });

                    // Show the dropdown when there are results
                    searchDropdown.style.display = 'block';
                } else {
                    searchResultsContainer.innerHTML = 'No results found';
                    searchDropdown.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error fetching search index:', error);
            });
    } else {
        searchDropdown.style.display = 'none'; // Hide the dropdown when the input is empty
    }
});
