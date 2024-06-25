const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY'


document.addEventListener('DOMContentLoaded', function() {
	const endpointUrls = {
		// Items
		'woods-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/woods?apikey=${supabaseKey}`,
		'fruit-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/fruit?apikey=${supabaseKey}`,
		'fauna-drops-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/fauna_drops?apikey=${supabaseKey}`,
		'flora-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/flora?apikey=${supabaseKey}`,
		'fungi-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/fungi?apikey=${supabaseKey}`,
		'stone-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/stone?apikey=${supabaseKey}`,
		'refined-resources-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/refined_materials?apikey=${supabaseKey}`,
		'crafting-items-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/crafting_items?apikey=${supabaseKey}`,
		'building-items-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/building_items?apikey=${supabaseKey}`,
		'weapons-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/weapons?apikey=${supabaseKey}`,
		'armor-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/armor?apikey=${supabaseKey}`,
		'relics-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/relics?apikey=${supabaseKey}`,
		'spells-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/spells?apikey=${supabaseKey}`,
		'tools-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/tools?apikey=${supabaseKey}`,
		'jewelry-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/jewelry?apikey=${supabaseKey}`,
		
		//Mobs
		'zebians-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/zebians?apikey=${supabaseKey}`,
		'sethians-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/_sethians?apikey=${supabaseKey}`,
		'fauna-mobs-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/fauna_mobs?apikey=${supabaseKey}`,
		'inquisition-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/inquisition?apikey=${supabaseKey}`,

		// Stations
		//'all_ids-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/all_ids?apikey=${supabaseKey}`,
		'all_items-table': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/all_items?apikey=${supabaseKey}`,
		'alchemy-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/alchemy-stations?apikey=${supabaseKey}`,
		'baking-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/baking-stations?apikey=${supabaseKey}`,
		'blacksmith-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/blacksmith-stations?apikey=${supabaseKey}`,
		'builder-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/builder-stations?apikey=${supabaseKey}`,
		'cooking-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/cooking-stations?apikey=${supabaseKey}`,
		'charcuterie-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/charcuterie-stations?apikey=${supabaseKey}`,
		'fletching-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/fletching-stations?apikey=${supabaseKey}`,
		'jewelry-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/jewelcrafting-stations?apikey=${supabaseKey}`,
		'leatherworking-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/leatherworking-stations?apikey=${supabaseKey}`,
		'tailoring-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/tailoring-stations?apikey=${supabaseKey}`,
		'tanning-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/tanning-stations?apikey=${supabaseKey}`,
		'winemaking-brewing-stations': `https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/winemaking-brewing-stations?apikey=${supabaseKey}`,

	};
	
	// Function to fetch data from a specific endpoint URL
	function fetchData(url) {
		return fetch(url).then(response => {
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}
			return response.json();
		});
	}

	function handleListItemClick(event) {
		const menuItem = event.target.closest("li");
		if (!menuItem) return;
		const tableId = menuItem.dataset.tableId;
		// Check if the tableId has a corresponding endpoint URL
		if (endpointUrls[tableId]) {
			const url = endpointUrls[tableId];
			fetchData(url).then(data => {
				const columnDefs = Object.keys(data[0]).map(key => ({
					headerName: key,
					field: key
				}));
				populateGrid(columnDefs, data);
			}).catch(error => console.error(`Error fetching data for ${tableId}:`, error));
		} else {
			console.log(`No endpoint defined for ${tableId}`);
		}
	}
	// Add event listener to all sub menu lists for clicks
	const verticalLists = document.querySelectorAll(".main-menu .sub-menu-item");
	verticalLists.forEach(listItem => {
		listItem.addEventListener("click", handleListItemClick);
	});
});


const quickFilterInput = document.getElementById('quickFilterInput');
let gridApi;
// Hide the quickFilterInput initially
quickFilterInput.style.display = 'none';
// Event listener for input field changes
quickFilterInput.addEventListener('input', function(event) {
	const searchText = event.target.value.toLowerCase();
	if (gridApi) {
		gridApi.updateGridOptions({
			quickFilterText: searchText
		});
	}
});
// Event listener for opening the sidebar and showing the quickFilterInput
document.addEventListener('DOMContentLoaded', function() {
	const menuItems = document.querySelectorAll('.sub-menu-item');
	menuItems.forEach(item => {
		item.addEventListener('click', () => {
			// Show the quickFilterInput when a menu item is clicked
			quickFilterInput.style.display = 'block';
		});
	});
});


function populateGrid(columnDefs, rowData) {
	const gridDiv = document.getElementById('grid-container');
	if (!gridDiv) {
		console.error('Grid container not found.');
		return;
	}
	gridDiv.style.background = '#2C2C2B';
	gridDiv.classList.add('ag-theme-alpine-dark');
	gridDiv.innerHTML = '';

	const modifiedColumnDefs = columnDefs.map(column => {

		const headerName = column.headerName.replace(/_/g, ' ').toLowerCase().replace(/(?:^|\s)\S/g, function(a) {
			return a.toUpperCase();
		});
		return { ...column,
			headerName
		};
	});
	const desiredColumnOrder = [{
			field: 'id',
			headerName: 'Item ID',
			resizable: false,
			flex: 0,
		}, {
			field: 'icon',
			headerName: 'Icon',
			resizable: false,
			flex: 0,
		}, {
			field: 'proper_name',
			headerName: 'Proper Name',
			sortable: true,
		}, {
			field: 'classification',
			headerName: 'Classification',
		}, {
			field: 'sub_class',
			headerName: 'Sub Class'
		}, {
			field: 'regions',
			headerName: 'Regions',
		}, {
			field: 'sources',
			headerName: 'Sources',
		}, {
			field: 'rarity',
			headerName: 'Rarity',
			sortable: true
		}, {
			field: 'tier',
			headerName: 'Tier',
			sortable: true,
			resizable: false,
		}, {
			field: 'stacksize',
			headerName: 'Stack Size',
		}, {
			field: 'stations',
			headerName: 'Station',
		},
		//Fruit, Fungi
		{
			field: 'benefit',
			headerName: 'Benefit'
		}, {
			field: 'benefit_amt',
			headerName: 'Benefit Amount'
		}, {
			field: 'benefit_duration',
			headerName: 'Benefit Duration'
		},
		//Spells
		{
			field: 'damage_type',
			headerName: 'Damage Type',
		},{
			field: 'cast_time',
			headerName: 'Cast Time',
		},{
			field: 'cooldown',
			headerName: 'Cooldown',
		},{
			field: 'stam_cost',
			headerName: 'Stamina Cost',
		}, {
			field: 'required_reagents',
			headerName: 'Required Reagents',
		}, {
			field: 'req_reagent_amt',
			headerName: 'Reagent Amt',
		},
		//Mobs
		{
			field: 'drops',
			headerName: 'Loot Table',
			cellDataType: 'text'
		},
		//Tools, Weapons, Armor, Refined
		{
			field: 'craft_time',
			headerName: 'Craft Time'
		},
		{
			field: 'defenses',
			headerName: 'Defenses',
		}, {
			field: 'def_ratings',
			headerName: 'Def Ratings',
		}, {
			field: 'material_reqs',
			headerName: 'Material Requirements'
		}, {
			field: 'req_amts',
			headerName: 'Required Amounts'
		}, {
			field: 'block_rating',
			headerName: 'Block Rating'
		}, {
			field: 'damage_type',
			headerName: 'Damage Type'
		}, {
			field: 'dmg_amt',
			headerName: 'Damage Amt'
		},
		// Stations
		{
			field: 'source',
			headerName: 'Source'
		},
		{
			field: 'image',
			headerName: 'Station'
		},
		// relics
		{
			field: 'spell_unlock',
			headerName: 'Spell Unlock'
		},
		{
			field: 'used_in',
			headerName: 'Used In'
		},
	];
	
	// Create column definitions with specified order
	const reorderedColumnDefs = desiredColumnOrder.map(col => {
		const existingColumn = modifiedColumnDefs.find(column => column.field === col.field);
		if (existingColumn) {
			existingColumn.headerClass = 'header-center';
		}
		return existingColumn ? existingColumn : null;
	}).filter(Boolean);
	const gridOptions = {
		defaultColDef: {
			sortable: true,
			autoHeight: true,
			
			cellStyle: {
				"wordBreak": "normal",
				"textAlign": "center"
			},
			headerComponentParams: {
				textAlign: "center"
			},
			filter: 'agTextColumnFilter',
			filterParams: {
				buttons: ['reset', 'apply']
			},
			cellDataType: 'text'
		},
		alwaysShowHorizontalScroll: true,
		autoSizeStrategy: 'fitGridWidth',
		columnDefs: reorderedColumnDefs,
		rowData: rowData,
		rowSelection: 'single',
		
	};
	// Create the grid
	gridApi = agGrid.createGrid(gridDiv, gridOptions);
	// Define cell renderer for the 'icon' column
	const iconRenderer = function(params) {
		const cellElement = document.createElement('div');
		cellElement.classList.add('icon-cell');
		const imgElement = document.createElement('img');
		imgElement.src = params.value;
		imgElement.style.width = '45px';
		imgElement.style.height = '45px';
		imgElement.style.objectFit = "contain";
		cellElement.appendChild(imgElement);
		return cellElement;
	};
	
	

		// Define API URL and API key
		const api_url = 'https://jrjgbnopmfovxwvtbivh.supabase.co/rest/v1/all_items?';
		const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

		gridApi.addEventListener('rowClicked', function(event) {
			const rowData = event.data;
			console.log('Clicked Row Data:', rowData);
			const recordId = rowData.id;

			// Fetch data from the API using the record ID and API key
			fetch(`${api_url}id=eq.${recordId}&apikey=${apiKey}`)
				.then(response => response.json())
				.then(data => updateCardContent(data))
				.catch(error => console.error('Error fetching data:', error));
		});

		function updateCardContent(databaseData) {
			console.log('Updating Card Content:', databaseData);
			const data = databaseData[0];
		
			// Update card title and subtitle
			document.getElementById('cardTitle').innerText = data.proper_name || 'Unknown Title';
			document.getElementById('cardSubtitle').innerText = data.classification || 'Unknown Subtitle';
		
			// Update card thumbnail
			const cardThumbnail = document.getElementById('cardThumbnail');
			cardThumbnail.innerHTML = '';
		
			const thumbnailImg = document.createElement('img');
			thumbnailImg.src = data.icon || 'https://example.com/default-icon.png';
			cardThumbnail.appendChild(thumbnailImg);
		
			// Update card content
			const cardContent = document.getElementById('cardContent');
			cardContent.innerText = `${data.item_description || 'No description available'}`;
		
			// Update list content
			const unlockedByContent = document.createElement('ion-item');
			const unlockedByLabel = document.createElement('ion-label');
			unlockedByLabel.innerHTML = `<h2>Source</h2><p>${data.source || 'Unknown'}</p>`;
			unlockedByContent.appendChild(unlockedByLabel);
		
			const unlockedByList = document.getElementById('unlockedByContent');
			unlockedByList.innerHTML = '';
			unlockedByList.appendChild(unlockedByContent);


			const unlockedByThumbnail = document.createElement('ion-thumbnail');
			unlockedByThumbnail.slot = 'start';
			const unlockedByImg = document.createElement('img');
			unlockedByImg.src = data.source_icon || 'https://example.com/default-icon.png';
			unlockedByThumbnail.appendChild(unlockedByImg);
			unlockedByContent.appendChild(unlockedByThumbnail);
		
		}
		

		
	// Define cell renderer for the 'image' column (e.g., stations)
	const imgRenderer = function(params) {
		const cellElement = document.createElement('div');
		cellElement.classList.add('img-cell');
		const imgElement = document.createElement('img');
		imgElement.src = params.value;
		imgElement.style.width = '750px';
		imgElement.style.height = '900px';
		imgElement.style.objectFit = "contain";
		cellElement.appendChild(imgElement);
		return cellElement;
	};
	
	gridApi.updateGridOptions({
		columnDefs: reorderedColumnDefs.map(col => {
			if (col.field === 'icon') {
				return { ...col,
					headerName: 'Icon',
					minWidth: 80,
					maxWidth: 80,
					resizable: false,
					cellRenderer: iconRenderer,
					pinned: 'left',
					lockPinned: true,
					cellClass: 'lock-pinned',
				};
			}
			if (col.field === 'tier') {
				return { ...col,
					headerName: 'Tier',
					minWidth: 120,
					maxWidth: 150,
				};
			}
			if (col.field === 'rarity') {
				return { ...col,
					headerName: 'Rarity',
					minWidth: 120,
					maxWidth: 130
				};
			}
			if (col.field === 'classification') {
				return { ...col,
					headerName: 'Classification',
					minWidth: 150,
					maxWidth: 150
				};
			}
			if (col.field === 'stacksize') {
				return { ...col,
					headerName: 'Stack Size',
					minWidth: 120,
					maxWidth: 130
				};
			}
			if (col.field === 'proper_name') {
				return { ...col,
					headerName: 'Proper Name',
					minWidth: 250,
					maxWidth: 280,
					sort: 'asc',
					pinned: 'left',
					lockPinned: true,
					cellClass: 'lock-pinned',
				};
			}
			if (col.field === 'stations') {
				return { ...col,
					headerName: 'Stations',
					minWidth: 150,
					maxWidth: 250
				};
			}
			if (col.field === 'sub_class') {
				return { ...col,
					headerName: 'Sub Class',
					minWidth: 100,
					maxWidth: 150
				};
			}
			if (col.field === 'sources') {
				return { ...col,
					headerName: 'Sources',
					minWidth: 120,
					maxWidth: 160
				};
			}
			if (col.field === 'benefit') {
				return { ...col,
					headerName: 'Benefit',
					minWidth: 130,
					maxWidth: 150
				};
			}
			if (col.field === 'benefit_amt') {
				return { ...col,
					headerName: 'Benefit Amt',
					minWidth: 140,
					maxWidth: 140
				};
			}
			if (col.field === 'benefit_duration') {
				return { ...col,
					headerName: 'Benefit Duration',
					minWidth: 150,
					maxWidth: 170
				};
			}
			if (col.field === 'stam_cost') {
				return { ...col,
					headerName: 'Stam Cost',
					minWidth: 100,
					maxWidth: 150
				};
			}
			if (col.field === 'required_reagents') {
				return { ...col,
					headerName: 'Required Reagents',
					minWidth: 100,
					maxWidth: 250
				};
			}
			if (col.field === 'craft_time') {
				return { ...col,
					headerName: 'Craft Time',
					minWidth: 100,
					maxWidth: 250
				};
			}
			if (col.field === 'defenses') {
				return { ...col,
					headerName: 'Defenses',
					minWidth: 100,
					maxWidth: 150
				};
			}
			if (col.field === 'def_ratings') {
				return { ...col,
					headerName: 'Def Ratings',
					minWidth: 100,
					maxWidth: 150
				};
			}
			if (col.field === 'drops') {
				return { ...col,
					headerName: 'Loot Table',
					minWidth: 300,
					maxWidth: 480
				};
			}
			if (col.field === 'source') {
				return { ...col,
					headerName: 'Source',
					minWidth: 270,
					maxWidth: 320
				};
			}
			if (col.field === 'id') {
				return { ...col,
					headerName: 'Item ID',
					minWidth: 120,
					maxWidth: 180
				};
			}
			if (col.field === 'image') {
				return { ...col,
					headerName: 'Station',
					minWidth: 750,
					maxWidth: 900,
					cellRenderer: imgRenderer
				};
			}
			
			if (col.field === 'spell_unlock') {
				return { ...col,
					headerName: 'Spell Unlock',
					minWidth: 350,
					maxWidth: 450,
				};
			}
			if (col.field === 'used_in') {
				return { ...col,
					headerName: 'Used In',
					minWidth: 450,
					maxWidth: 650,
				};
			}
			return col;
			
		})
		
	});
	
}

document.addEventListener("DOMContentLoaded", function() {
	// Select the sidebar and menu toggle buttons
	let sidebar = document.querySelector(".sidebar");
	//let sidebarBtn = document.querySelector(".bx-menu");
	let mainMenus = document.querySelectorAll(".sub-menu-item");
	// Function to close the sidebar after 5 seconds of inactivity
	let timeout;

	function closeSidebarAfterDelay() {
		timeout = setTimeout(() => {
			sidebar.classList.add("close");
		}, 2000);
	}
	// Function to reset the timeout for closing the sidebar
	function resetSidebarTimeout() {
		clearTimeout(timeout);
		closeSidebarAfterDelay();
	}
	// Add event listener to mouseover event on the sidebar and main-menu buttons
	sidebar.addEventListener("mouseover", () => {
		resetSidebarTimeout(); // Reset the timeout for closing the sidebar
	});
	mainMenus.forEach(menu => {
		menu.addEventListener("mouseover", () => {
			resetSidebarTimeout(); // Reset the timeout for closing the sidebar
		});
	});
	// Add event listener to mouseout event on the sidebar
	sidebar.addEventListener("mouseout", () => {
		resetSidebarTimeout(); // Reset the timeout for closing the sidebar
	});
	// Add event listener to mouseover event on the main menu buttons
	mainMenus.forEach(menu => {
		menu.addEventListener("mouseover", () => {
			resetSidebarTimeout(); // Reset the timeout for closing the sidebar
		});
	});
	
	// Start the initial timeout to close the sidebar after 5 seconds of inactivity
	closeSidebarAfterDelay();
	// Select all list items in the navigation menu
	let links = document.querySelectorAll(".nav-links li");
	// Iterate over each list item
	for (let link of links) {
		// Select the link text, arrow icon, and submenu for each list item
		let linkName = link.querySelector("span.link_name");
		let arrow = link.querySelector(".arrow");
		let subMenu = link.querySelector(".icon-link");
		// Add click event listener to the arrow icon
		if (arrow) {
			arrow.addEventListener("click", (e) => {
				e.stopPropagation(); 
				let arrowParent = e.target.parentElement.parentElement;
				arrowParent.classList.toggle("showMenu");
			});
		}
		// Add click event listener to the link text
		if (linkName && subMenu) {
			linkName.addEventListener("click", (e) => {
				e.preventDefault(); // Prevent default behavior of link
				let linkParent = e.target.parentElement;
				linkParent.classList.toggle("showMenu");
			});
		}
		// Add click event listener to the parent link as well
		link.addEventListener("click", (e) => {
			// Check if the clicked element is a submenu item or the main menu item itself
			if (e.target.classList.contains("link_name") && e.currentTarget === link) {
				let linkParent = e.currentTarget;
				linkParent.classList.toggle("showMenu");
			}
		});
	}
	// Select all submenu items
	let submenuItems = document.querySelectorAll(".sub-menu-item");
	let submenuMaps = document.querySelectorAll(".sub-menu-map");
	
	// Add click event listener to submenu items
	submenuItems.forEach((item) => {
		item.addEventListener("click", (e) => {
			// Remove 'highlight' class from all submenu items
			submenuItems.forEach((item) => {
				item.classList.remove("highlight");
			});
			// Add 'highlight' class to the clicked submenu item
			e.currentTarget.classList.add("highlight");
			resetSidebarTimeout();
		});
	});
	
	// Add click event listener to submenu maps
	submenuMaps.forEach((item) => {
		item.addEventListener("click", (e) => {
			// Remove 'highlight' class from all submenu items
			submenuMaps.forEach((item) => {
				item.classList.remove("highlight");
			});
			// Add 'highlight' class to the clicked submenu item
			e.currentTarget.classList.add("highlight");
			resetSidebarTimeout();
		});
	});
	
	// Display the banner image initially
	var gridContainer = document.getElementById('grid-container');
	gridContainer.innerHTML = '<img src="assets/banner.jpg" alt="Banner" class="banner-image">'
	const openSidebarLink = document.getElementById("openSidebarLink");
	openSidebarLink.addEventListener("click", function(event) {
		event.preventDefault();
		sidebar.classList.toggle("close");
	});
  
});


document.addEventListener("DOMContentLoaded", function() {
    var mapsMenuItem = document.querySelector('#mapsSubMenu .sub-menu-item-map');
    var mapsSubMenuItems = document.querySelectorAll('#mapsSubMenu .sub-menu-map');
    var mapsSubMenu = document.getElementById('mapsSubMenu');
    var gridContainer = document.getElementById('grid-container');
    var mapIframe = document.getElementById('mapIframe');

    if (mapsMenuItem && mapsSubMenuItems.length > 0 && mapsSubMenu && gridContainer && mapIframe) {
        // Hide the iframe initially
        mapIframe.style.display = 'none';

        // Add click event listener to the Maps main menu item
        mapsMenuItem.addEventListener('click', function(event) {
            event.preventDefault();
            // Show the iframe
            mapIframe.style.display = 'block';
            // Hide the grid container
            gridContainer.style.display = 'none';
            // Hide the Maps sub-menu
            mapsSubMenu.classList.remove('active');
            // Load map.html into the iframe
            mapIframe.src = 'frontend/www/map.html';
        });

        // Add click event listeners to each Maps sub-menu item
        mapsSubMenuItems.forEach(function(item) {
            item.addEventListener('click', function(event) {
                event.preventDefault();
                // Show the iframe
                mapIframe.style.display = 'block';
                // Hide the grid container
                gridContainer.style.display = 'none';
                // Hide the Maps sub-menu
                mapsSubMenu.classList.remove('active');
                // Load map.html into the iframe based on the clicked map
                mapIframe.src = 'frontend/www/' + item.textContent.trim().toLowerCase().replace(/\s/g, '_') + '.html';
            });
        });

        // Add event listener to close the iframe and show the grid container when clicking outside the Maps sub-menu
        document.addEventListener('click', function(event) {
            var isSubMenuClick = false;
            mapsSubMenuItems.forEach(function(item) {
                if (item.contains(event.target)) {
                    isSubMenuClick = true;
                }
            });
            if (!mapsSubMenu.contains(event.target) && !isSubMenuClick && event.target !== mapsMenuItem) {
                // Show the grid container
                gridContainer.style.display = 'block';
                // Hide the iframe
                mapIframe.style.display = 'none';
                // Reset iframe src
                mapIframe.src = '';
            }
        });
    } else {
        console.error('One or more elements not found in the document.');
    }
});
