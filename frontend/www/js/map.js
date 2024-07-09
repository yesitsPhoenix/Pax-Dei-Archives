async function fetchData(fileName) {
    try {
        const response = await fetch(fileName);
        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${fileName}.`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        return [];
    }
  }
  async function fetchResourceLocations() {
    return fetchData("https://yesitsphoenix.github.io/Pax-Dei-Archives/backend/data/resources.json");
}
  

let map;
let selectedFruits = [];
let selectedAnimals = [];
let selectedPlants = [];
let selectedMushrooms = [];
let selectedFlowers = [];
let selectedPlayers = [];
let selectedStone = [];
let selectedSpecial = [];
const markersByName = {};
let markers = [];
let temporaryMarkers = [];
const temporaryMarkersWithData = [];


// Function to update the markers
function updateMarkers() {
    // Remove all existing markers from the map
    markers.forEach((marker) => marker.remove());
    markers = [];
  
    // Add markers for selected options
    selectedFruits.forEach((selectedOption) => {
        const locationData = resourceLocations.find(
            (location) => location.name === selectedOption
        );
        if (locationData) {
            locationData.locations.forEach((location) => {
                const marker = addMarker(
                    locationData.name,
                    location.lat,
                    location.lng,
                    locationData.rarity
                );
                markers.push(marker);
            });
        }
    });
  
    markers.forEach((marker) => marker.addTo(map));
  }
  

//Icons and formatting
const commonIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/6pCx4K70/blue.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const uncommonIcon = L.icon({
  iconUrl: 'https://cdn.discordapp.com/attachments/885950046506450955/1133845956056588399/2.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const rareIcon = L.icon({
  iconUrl: 'https://cdn.discordapp.com/attachments/885950046506450955/1133845955804942548/1.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const defaultIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/6pCx4K70/blue.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const blueberryIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/d3D2HJRm/blueberry.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const boarIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/mrYNfzD2/boar.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const daisyIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/t4qNWtJM/daisy.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const daturaIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/dtb26Phr/datura-fruit.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const deathcapIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/3JHBJHT7/deathcap.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const deerIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/Wz3Mk57h/deer.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const amanitaIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/RZdGDp2m/amanita.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const batflowerIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/C134q3nG/batflower.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const bearIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/50mhc238/a-gray-bear.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const garlicIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/T1jnWp6x/garlic.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const greywolfIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/Nf41s9D7/grey-wolf.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const loiostearsIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/XJdCTpX5/loios-tears.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const mustardIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/FK2SW-jFm/mustard.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const nightshadeIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/XvSmpC1w/deadly-nightshades-leaves.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const periwinkleIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/Kj5g8wPv/periwinkle.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const divineIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/VN59Hfj9/divine.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const flaxIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/vBZfTGKF/flax.png',
  iconSize: [72, 72],
  iconAnchor: [48, 64],
  popupAnchor: [-3, -76]
});

const rabbitIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/zfZScSqc/rabbit.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const rainlilyIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/qBtQxGmf/rain-lily.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const raspberryIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/Dft6jbDS/raspberry.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const sageIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/25BbZVQt/sage.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const reedsIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/SNCrwxFD/reed.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});

const clayIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/MKM01Kpz/clay.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});

const grapesIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/rFc12C1w/grapes.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});
const tempMarkerIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/5t1dwrLM/red.png',
  iconSize: [41, 41],
  iconAnchor: [18, 41],
  popupAnchor: [1, -34],
});
const impureIronDepositIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/6pbnZkD8/impure-iron-deposit.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});
const copperDepositIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/BvvN9cGK/copper-deposit.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});

const graniteDepositIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/Z556CbDk/granite-deposit.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});

const ironDepositIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/43KtQ8gB/iron-deposit.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});
const gneissDepositIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/fWYcPg0P/gneiss-deposit.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});
const flintStoneIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/9M7dCLgr/flint-stones.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});
const tinDepositIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/G2KRMXxd/tin_ore.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});
const limestoneDepositIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/QC8rVTt6/limestone.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});
const badgerIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/RhVjvxsy/badger.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});
const foxIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/Bbfx62RN/fox.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});
const pennybunIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/6pk6PnW8/penny_bun.png',
  iconSize: [64, 64],
  iconAnchor: [32, 64],
  popupAnchor: [-3, -76]
});
const wolfElderIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/Nf41s9D7/grey-wolf.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});
const corruptedWolfIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/Nf41s9D7/grey-wolf.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});
const corruptedBoarIcon = L.icon({
  iconUrl: 'https://i.postimg.cc/mrYNfzD2/boar.png',
  iconSize: [72, 72],
  iconAnchor: [36, 72],
  popupAnchor: [-3, -76]
});



  function delayMapLoading() {
    return new Promise(resolve => {
        setTimeout(resolve, 0);
    });
}

  async function initMap() {
    try {
        resourceLocations = await fetchResourceLocations();
        await new Promise(resolve => setTimeout(resolve, 0));

        map = L.map("map", {
            zoomControl: false,
            maxZoom: 5,
            scrollWheelZoom: false,
            smoothWheelZoom: true,
            smoothSensitivity: 1,
            wheelDebounceTime: 100,
            zoomSnap: 0.1,
            crs: L.CRS.Simple
        }).setView(
            [0, 0], 0);
        map.on("zoomend", function() {
            if (map.getZoom() > map.options.maxZoom) {
                map.setZoom(map.options.maxZoom);
            }
        });
  
        L.Control.zoomHome = L.Control.extend({
            options: {
                position: "topright",
                zoomInText: "+",
                zoomInTitle: "Zoom in",
                zoomOutText: "-",
                zoomOutTitle: "Zoom out",
                zoom: 0,
            },
  
            onAdd: function(map) {
                var controlName = "gin-control-zoom",
                    container = L.DomUtil.create("div", controlName + " leaflet-bar"),
                    options = this.options;
  
                this._zoomInButton = this._createButton(
                    options.zoomInText,
                    options.zoomInTitle,
                    controlName + "-in",
                    container,
                    this._zoomIn
                );
  
                this._zoomHomeButton = this._createButton(
                    "",
                    "Zoom home",
                    controlName + "-home",
                    container,
                    this._zoomHome,
                    "map_assets/home.png"
                );
  
                this._zoomOutButton = this._createButton(
                    options.zoomOutText,
                    options.zoomOutTitle,
                    controlName + "-out",
                    container,
                    this._zoomOut
                );
  
                this._updateDisabled();
                map.on("zoomend zoomlevelschange", this._updateDisabled, this);
  
                return container;
            },
  
            _zoomHome: function(e) {
                this._map.setView([0, 0], 0, {
                    animate: true
                });
            },
  
            onRemove: function(map) {
                map.off("zoomend zoomlevelschange", this._updateDisabled, this);
            },
  
            _zoomIn: function(e) {
                this._map.zoomIn(e.shiftKey ? 3 : 1);
            },
  
            _zoomOut: function(e) {
                this._map.zoomOut(e.shiftKey ? 3 : 1);
            },
  
            _createButton: function(html, title, className, container, fn, iconUrl) {
                var link = L.DomUtil.create("a", className, container);
                link.innerHTML = html;
                link.href = "#";
                link.title = title;
  
                if (iconUrl) {
                    link.style.backgroundImage = `url(${iconUrl})`;
                    link.style.backgroundSize = "contain";
                    link.style.width = "30px";
                    link.style.height = "30px";
                }
  
                L.DomEvent.on(link, "mousedown dblclick", L.DomEvent.stopPropagation)
                    .on(link, "click", L.DomEvent.stop)
                    .on(link, "click", fn, this)
                    .on(link, "click", this._refocusOnMap, this);
  
                return link;
            },
  
            _updateDisabled: function() {
                var map = this._map,
                    className = "leaflet-disabled";
  
                L.DomUtil.removeClass(this._zoomInButton, className);
                L.DomUtil.removeClass(this._zoomOutButton, className);
  
                if (map._zoom === map.getMinZoom()) {
                    L.DomUtil.addClass(this._zoomOutButton, className);
                }
                if (map._zoom === map.getMaxZoom()) {
                    L.DomUtil.addClass(this._zoomInButton, className);
                }
            },
  
  
        });
  
        var zoomHome = new L.Control.zoomHome();
        zoomHome.addTo(map);
        
        const clearResourcesButton = document.querySelector(".clear-resources-button");
        clearResourcesButton.addEventListener("click", clearAllMarkers,);

        var imageOverlay = L.imageOverlay(
            "map_assets/map.webp", [
                [680, -480], // North West
                [-680, 480], // South East
            ]
        ).addTo(map);
        imageOverlay.getElement().classList.add('image-overlay');

    // Generate options for the "Fruit" dropdown menu
      const fruitDropdown = document.getElementById("fruit-dropdown");
      const uniqueFruitLocations = filterUniqueLocations(resourceLocations, "Fruit");
      uniqueFruitLocations.forEach((location) => {
          const option = document.createElement("div");
          option.className = "option";
          option.textContent = location.name;
          fruitDropdown.appendChild(option);
          option.addEventListener("click", (event) => {
              onOptionSelect(event, location.name, location.lat, location.lng);
          });
      });

      // Generate options for the "Animals" dropdown menu
      const animalsDropdown = document.getElementById("animals-dropdown");
      const uniqueAnimalLocations = filterUniqueLocations(resourceLocations, "Animals");
      uniqueAnimalLocations.forEach((location) => {
          const option = document.createElement("div");
          option.className = "option";
          option.textContent = location.name;
          animalsDropdown.appendChild(option);
          option.addEventListener("click", (event) => {
              onOptionSelect(event, location.name, location.lat, location.lng);
          });
      });
      // Generate options for the "Plants" dropdown menu
      const plantsDropdown = document.getElementById("plants-dropdown");
      const uniquePlantLocations = filterUniqueLocations(resourceLocations, "Plants");
      uniquePlantLocations.forEach((location) => {
          const option = document.createElement("div");
          option.className = "option";
          option.textContent = location.name;
          plantsDropdown.appendChild(option);
          option.addEventListener("click", (event) => {
              onOptionSelect(event, "Plants", location.name, location.lat, location.lng);
          });
      });

      // Generate options for the "Mushrooms" dropdown menu
      const mushroomsDropdown = document.getElementById("mushrooms-dropdown");
      const uniqueMushroomLocations = filterUniqueLocations(resourceLocations, "Mushrooms");
      uniqueMushroomLocations.forEach((location) => {
          const option = document.createElement("div");
          option.className = "option";
          option.textContent = location.name;
          mushroomsDropdown.appendChild(option);
          option.addEventListener("click", (event) => {
              onOptionSelect(event, "Mushrooms", location.name, location.lat, location.lng);
          });
      });
      //Generate options for the "Players" dropdown menu
    //   const playersDropdown = document.getElementById("players-dropdown");
    //   const uniquePlayerLocations = filterUniqueLocations(playerLocations, "Players");
    //   uniquePlayerLocations.forEach((location) => {
    //       const option = document.createElement("div");
    //       option.className = "option";
    //       option.textContent = location.name;
    //       playersDropdown.appendChild(option);
    //       option.addEventListener("click", (event) => {
    //           onOptionSelect(event, "Players", location.lat, location.lng);
    //       });
    //   });

      // Generate options for the "Flowers" dropdown menu
      const flowersDropdown = document.getElementById("flowers-dropdown");
      const uniqueFlowerLocations = filterUniqueLocations(resourceLocations, "Flowers");
      uniqueFlowerLocations.forEach((location) => {
          const option = document.createElement("div");
          option.className = "option";
          option.textContent = location.name;
          flowersDropdown.appendChild(option);
          option.addEventListener("click", (event) => {
              onOptionSelect(event, "Flowers", location.lat, location.lng);
          });
      });

      // Generate options for the "Stone" dropdown menu
      const stoneDropdown = document.getElementById("stone-dropdown");
      const uniqueStoneLocations = filterUniqueLocations(resourceLocations, "Stone");
      uniqueStoneLocations.forEach((location) => {
          const option = document.createElement("div");
          option.className = "option";
          option.textContent = location.name;
          stoneDropdown.appendChild(option);
          option.addEventListener("click", (event) => {
              onOptionSelect(event, "Stone", location.lat, location.lng);
          });
      });

      // Generate options for the "Stone" dropdown menu
      const specialDropdown = document.getElementById("special-dropdown");
      const uniqueSpecialLocations = filterUniqueLocations(resourceLocations, "Special");
      uniqueSpecialLocations.forEach((location) => {
          const option = document.createElement("div");
          option.className = "option";
          option.textContent = location.name;
          specialDropdown.appendChild(option);
          option.addEventListener("click", (event) => {
              onOptionSelect(event, "Stone", location.lat, location.lng);
          });

      });

      

        
        // Add event listener to update mouse coordinates when the mouse moves over the map
        map.on("mousemove", (e) => {
            const mouseCoordinates = document.getElementById("mouse-coordinates");
            mouseCoordinates.textContent = `[${e.latlng.lat.toFixed(3)}], ${e.latlng.lng.toFixed(3)}]`;
        });
        const mouseCoordinatesDiv = document.getElementById("mouse-coordinates");
        map.on("mousemove", (e) => {
            mouseCoordinatesDiv.textContent = `Work-in-Progress\n[${e.latlng.lat.toFixed(3)}], [${e.latlng.lng.toFixed(3)}]`;
        });
  
        // Event listener for the map's click event
        map.on("click", function(e) {
        // Create a temporary marker
        const tempMarker = L.marker(e.latlng, {
            icon: tempMarkerIcon
        }).addTo(map);

        // Create a custom popup-like behavior
        const popupDiv = document.createElement("div");
        const inputField = document.createElement("input");
        inputField.type = "text";
        inputField.id = "marker-input";
        inputField.placeholder = "Enter text";

        const coordinatesText = document.createElement("p");
        coordinatesText.textContent = `Coordinates: [${e.latlng.lat.toFixed(3)}, ${e.latlng.lng.toFixed(3)}]`;

        const copyButton = document.createElement("button");
        copyButton.id = "copy-data";
        copyButton.textContent = "Copy Data";

        // const saveButton = document.createElement("button");
        // saveButton.id = "save-location";
        // saveButton.textContent = "Save Location";

        popupDiv.appendChild(inputField);
        popupDiv.appendChild(coordinatesText);

        // Add spacing between the Copy and Save buttons
        popupDiv.appendChild(document.createElement("br"));
        popupDiv.appendChild(copyButton);
        popupDiv.appendChild(document.createTextNode("\u00A0\u00A0"));
        //popupDiv.appendChild(saveButton);

        // Bind the custom popup to the temporary marker
        tempMarker.bindPopup(popupDiv).openPopup();

        // Event listener for the marker's click event
        tempMarker.on("click", function(event) {
            // Check if the Ctrl key (Windows/Linux) or Command key (Mac) is pressed
            if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
                // Remove the temporary marker
                tempMarker.remove();
            }
        });

        // Event listener for copying data (text and coordinates)
        const copyDataButton = popupDiv.querySelector("#copy-data");
        copyDataButton.addEventListener("click", function() {
            // Get the text and coordinates entered by the user
            const inputField = document.getElementById("marker-input");
            const enteredText = inputField.value;
            const coordinates = ` ${e.latlng.lat.toFixed(3)},${e.latlng.lng.toFixed(3)}`;

            // Combine text and coordinates without brackets and copy to clipboard
            const combinedText = `${enteredText}${coordinates}`;
            copyToClipboard(combinedText);
        });

        // Function to copy text to the clipboard
        function copyToClipboard(text) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
        }
    });

    } catch (error) {
        console.error(error);
    }
  }
  

  function createOptionElement(name, category) {
    const option = document.createElement("div");
    option.className = "option";
    option.textContent = name;
    option.addEventListener("click", (event) => {
        onOptionSelect(event, category, name);
    });
    return option;
  }
  
  // Function to filter unique locations based on category
  function filterUniqueLocations(locations, category) {
    const uniqueLocations = [];
    const namesSet = new Set();
    locations.forEach((location) => {
        if (location.category === category && !namesSet.has(location.name)) {
            uniqueLocations.push(location);
            namesSet.add(location.name);
        }
    });
    return uniqueLocations;
  }

  
  L.Map.mergeOptions({
    // @section Mousewheel options
    // @option smoothWheelZoom: Boolean|String = true
    // Whether the map can be zoomed by using the mouse wheel. If passed `'center'`,
    // it will zoom to the center of the view regardless of where the mouse was.
    smoothWheelZoom: true,
  
    // @option smoothWheelZoom: number = 1
    // setting zoom speed
    smoothSensitivity: 1
  
  });
  
  
  L.Map.SmoothWheelZoom = L.Handler.extend({
  
    addHooks: function() {
        L.DomEvent.on(this._map._container, 'wheel', this._onWheelScroll, this);
    },
  
    removeHooks: function() {
        L.DomEvent.off(this._map._container, 'wheel', this._onWheelScroll, this);
    },
  
    _onWheelScroll: function(e) {
        if (!this._isWheeling) {
            this._onWheelStart(e);
        }
        this._onWheeling(e);
    },
  
    _onWheelStart: function(e) {
        var map = this._map;
        this._isWheeling = true;
        this._wheelMousePosition = map.mouseEventToContainerPoint(e);
        this._centerPoint = map.getSize()._divideBy(2);
        this._startLatLng = map.containerPointToLatLng(this._centerPoint);
        this._wheelStartLatLng = map.containerPointToLatLng(this._wheelMousePosition);
        this._startZoom = map.getZoom();
        this._moved = false;
        this._zooming = true;
  
        map._stop();
        if (map._panAnim) map._panAnim.stop();
  
        this._goalZoom = map.getZoom();
        this._prevCenter = map.getCenter();
        this._prevZoom = map.getZoom();
  
        this._zoomAnimationId = requestAnimationFrame(this._updateWheelZoom.bind(this));
    },
  
    _onWheeling: function(e) {
        var map = this._map;
  
        this._goalZoom = this._goalZoom + L.DomEvent.getWheelDelta(e) * 0.003 * map.options.smoothSensitivity;
        if (this._goalZoom < map.getMinZoom() || this._goalZoom > map.getMaxZoom()) {
            this._goalZoom = map._limitZoom(this._goalZoom);
        }
        this._wheelMousePosition = this._map.mouseEventToContainerPoint(e);
  
        clearTimeout(this._timeoutId);
        this._timeoutId = setTimeout(this._onWheelEnd.bind(this), 200);
  
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
    },
  
    _onWheelEnd: function(e) {
        this._isWheeling = false;
        cancelAnimationFrame(this._zoomAnimationId);
        this._map._moveEnd(true);
    },
  
    _updateWheelZoom: function() {
        var map = this._map;
  
        if ((!map.getCenter().equals(this._prevCenter)) || map.getZoom() != this._prevZoom)
            return;
  
        this._zoom = map.getZoom() + (this._goalZoom - map.getZoom()) * 0.3;
        this._zoom = Math.floor(this._zoom * 100) / 100;
  
        var delta = this._wheelMousePosition.subtract(this._centerPoint);
        if (delta.x === 0 && delta.y === 0)
            return;
  
        if (map.options.smoothWheelZoom === 'center') {
            this._center = this._startLatLng;
        } else {
            this._center = map.unproject(map.project(this._wheelStartLatLng, this._zoom).subtract(delta), this._zoom);
        }
  
        if (!this._moved) {
            map._moveStart(true, false);
            this._moved = true;
        }
  
        map._move(this._center, this._zoom);
        this._prevCenter = map.getCenter();
        this._prevZoom = map.getZoom();
  
        this._zoomAnimationId = requestAnimationFrame(this._updateWheelZoom.bind(this));
    }
  
  });
  
  L.Map.addInitHook('addHandler', 'smoothWheelZoom', L.Map.SmoothWheelZoom);
  
  
  document.addEventListener("DOMContentLoaded", function() {
    initMap();

  });

  
function toggleAndCloseSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const resourcesButton = document.getElementById('resources-button');
    const clearResourcesButton = document.querySelector('.clear-resources-button');
    // const loginButton = document.querySelector('.login-button');
    // const loadMarkersButton = document.querySelector('.load-markers-button');
  
    if (sidebar.classList.contains('open')) {
        // Sidebar is open, close it
        sidebar.classList.remove('open');
  
        // Reset the left positions to their default values
        resourcesButton.style.left = '90px';
        clearResourcesButton.style.left = '220px';
        // loginButton.style.left = '70px';
        // loadMarkersButton.style.left = '460px';
    } else {
        // Sidebar is closed, open it
        sidebar.classList.add('open');
  
        // Calculate new left positions if sidebar is open based on initial positions in CSS
        const initialPositions = {
            resources: 90,
            clearAll: 220,
            // login: 70,
            // loadMarkersButton: 460,
        };
  
        resourcesButton.style.left = `${initialPositions.resources + 275}px`;
  
        if (clearResourcesButton) {
            clearResourcesButton.style.left = `${initialPositions.clearAll + 275}px`;
        }
        // loginButton.style.left = `${initialPositions.login + 275}px`;
  
        // loadMarkersButton.style.left = `${initialPositions.loadMarkersButton + 275}px`;
    }
  }
  
  
  function closeSidebar() {
    const sidebar = document.querySelector('.sidebar.open');
    if (sidebar) {
        sidebar.classList.remove('open');
  
        // Reset the left positions to their default values
        document.getElementById('resources-button').style.left = '90px';
  
        const clearResourcesButton = document.querySelector('.clear-resources-button');
        if (clearResourcesButton) {
            clearResourcesButton.style.left = '220px';
        }
  
        // const loginButton = document.querySelector('.login-button');
        // if (loginButton) {
        //     loginButton.style.left = '70px';
        // }
        // const loadMarkersButton = document.querySelector('.load-markers-button');
        // if (loadMarkersButton) {
        //     loadMarkersButton.style.left = '460px';
        // }
    }
  }
  
  const clearResourcesButton = document.querySelector('.clear-resources-button');
  
  if (clearResourcesButton) {
    clearResourcesButton.addEventListener('click', closeSidebar);
  
  }
  
  const closeButton = document.querySelector('.close-button');
  
  if (closeButton) {
    closeButton.addEventListener('click', toggleSidebar);
  
  }

  
function toggleDropdown(category) {
    const dropdownOptions = document.getElementById(`${category}-dropdown`);
  
    if (dropdownOptions) {
        dropdownOptions.classList.toggle("open");
    } else {
        console.error(`Dropdown options with ID '${category}' not found.`);
    }
  }
  
  function toggleDropdown(category) {
    const dropdownOptions = document.getElementById(`${category}-dropdown`);
  
    // Check if dropdownOptions is not null before accessing its style property
    if (dropdownOptions) {
        dropdownOptions.style.display = dropdownOptions.style.display === "block" ? "none" : "block";
    } else {
        console.error(`Dropdown options with ID '${category}' not found.`);
    }
  }
  
  // Function to add Orange color to selected menu options
  function updateDropdownAppearance() {
    const dropdownOptions = document.querySelectorAll(".option");
    const dropdownTitle = document.querySelector(".dropdown-title");

    dropdownOptions.forEach((option) => {
        const name = option.textContent;

        if (selectedFruits.includes(name) || 
            selectedAnimals.includes(name) ||
            selectedPlants.includes(name) ||
            selectedMushrooms.includes(name) ||
            selectedFlowers.includes(name) ||
            selectedStone.includes(name) ||
            selectedSpecial.includes(name)) {
            option.style.backgroundColor = "orange";
            option.style.color = "black";
        } else {
            option.style.backgroundColor = "white";
            option.style.color = "initial";
        }
    });


  
    // Check if selectedPlayers array is empty to remove orange highlight from menu
    const allDeselected = dropdownOptions.length === selectedPlayers.length;
    if (allDeselected) {
        dropdownTitle.style.backgroundColor = category === "fruit" ? "green" : "blue";
        dropdownTitle.style.color = "transparent";
    }
  }
  
// Function to handle dropdown menu selection
function onOptionSelect(event, category, name, lat, lng, rarity, iconUrl) {
    const selectedOption = event.target.textContent;
    const dropdownTitle = document.querySelector(`.${category}-dropdown .dropdown-title`);
  
    // Toggle the option selection
    if (selectedFruits.includes(selectedOption)) {
        // If the option is already selected, remove it from the selectedFruits array
        const index = selectedFruits.indexOf(selectedOption);
        if (index > -1) {
            selectedFruits.splice(index, 1);
        }
    } else {
        // If the option is not selected, add it to the selectedFruits array
        selectedFruits.push(selectedOption);
    }
  
    //Toggle the option selection for players
    if (selectedPlayers.includes(selectedOption)) {
        // If the option is already selected, remove it from the selectedPlayers array
        const index = selectedPlayers.indexOf(selectedOption);
        if (index > -1) {
            selectedPlayers.splice(index, 1);
        }
    } else {
        // If the option is not selected, add it to the selectedPlayers array
        selectedPlayers.push(selectedOption);
    }
  
    updateMarkers();
    updateDropdownAppearance();
  }
  
  // Function to add a marker for a specific location
  function addMarker(name, lat, lng, rarity, iconUrl) {
    let icon;
  
    if (iconUrl) {
        icon = L.icon({
            iconUrl: iconUrl,
            iconSize: [128, 128],
        });
    } else {
        // Icon logic
        if (name.toLowerCase() === "blueberry") {
            icon = blueberryIcon;
        } else if (name.toLowerCase() === "boar") {
            icon = boarIcon;
        } else if (name.toLowerCase() === "daisy") {
            icon = daisyIcon;
        } else if (name.toLowerCase() === "datura") {
            icon = daturaIcon;
        } else if (name.toLowerCase() === "deathcap") {
            icon = deathcapIcon;
        } else if (name.toLowerCase() === "deer") {
            icon = deerIcon;
        } else if (name.toLowerCase() === "amanita") {
            icon = amanitaIcon;
        } else if (name.toLowerCase() === "batflower") {
            icon = batflowerIcon;
        } else if (name.toLowerCase() === "bear") {
            icon = bearIcon;
        } else if (name.toLowerCase() === "grey wolf") {
            icon = greywolfIcon;
        } else if (name.toLowerCase() === "loios tears") {
            icon = loiostearsIcon;
        } else if (name.toLowerCase() === "mustard") {
            icon = mustardIcon;
        } else if (name.toLowerCase() === "nightshade") {
            icon = nightshadeIcon;
        } else if (name.toLowerCase() === "periwinkle") {
            icon = periwinkleIcon;
        } else if (name.toLowerCase() === "divine") {
            icon = divineIcon;
        } else if (name.toLowerCase() === "flax") {
            icon = flaxIcon;
        } else if (name.toLowerCase() === "rabbit") {
            icon = rabbitIcon;
        } else if (name.toLowerCase() === "rain lily") {
            icon = rainlilyIcon;
        } else if (name.toLowerCase() === "raspberry") {
            icon = raspberryIcon;
        } else if (name.toLowerCase() === "sage") {
            icon = sageIcon;
        } else if (name.toLowerCase() === "reeds") {
            icon = reedsIcon;
        } else if (name.toLowerCase() === "silver fir branch") {
            icon = silverfirIcon;
        } else if (name.toLowerCase() === "garlic") {
            icon = garlicIcon;
        } else if (name.toLowerCase() === "clay") {
            icon = clayIcon;
        } else if (name.toLowerCase() === "grapes") {
            icon = grapesIcon;
        } else if (name.toLowerCase() === "copper deposit") {
            icon = copperDepositIcon;
        } else if (name.toLowerCase() === "impure iron deposit") {
            icon = impureIronDepositIcon;
        } else if (name.toLowerCase() === "granite deposit") {
            icon = graniteDepositIcon;
        } else if (name.toLowerCase() === "iron deposit") {
            icon = ironDepositIcon;
        } else if (name.toLowerCase() === "gneiss deposit") {
            icon = gneissDepositIcon;
        } else if (name.toLowerCase() === "flint stones") {
            icon = flintStoneIcon;
        } else if (name.toLowerCase() === "tin deposit") {
            icon = tinDepositIcon;
        } else if (name.toLowerCase() === "limestone deposit") {
            icon = limestoneDepositIcon;
        } else if (name.toLowerCase() === "badger") {
            icon = badgerIcon;
        } else if (name.toLowerCase() === "fox") {
            icon = foxIcon;
        } else if (name.toLowerCase() === "pennybun") {
            icon = pennybunIcon;
        } else if (name.toLowerCase() === "corrupted boar") {
            icon = corruptedBoarIcon;
        } else if (name.toLowerCase() === "corrupted wolf") {
            icon = corruptedWolfIcon;
        } else if (name.toLowerCase() === "wolf elder") {
            icon = wolfElderIcon;
  
        } else if (rarity === "common") {
            icon = commonIcon;
        } else if (rarity === "uncommon") {
            icon = uncommonIcon;
        } else if (rarity === "rare") {
            icon = rareIcon;
        } else {
            icon = defaultIcon;
        }
    }
  
    const marker = L.marker([lat, lng], {
        icon: icon,
    }).bindPopup(`${name}, (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
  
    return marker;
  
  }
  
  function clearAllMarkers() {
    markers.forEach((marker) => marker.remove());
    markers = [];
    selectedFruits = [];
    selectedAnimals = [];
    selectedPlants = [];
    selectedMushrooms = [];
    selectedFlowers = [];
    selectedStone = [];
    selectedSpecial = [];
    tempMarkers = [];
    updateDropdownAppearance();
    map.setView([0, 0], 0, {
        animate: true
    });
}
  
  
document.addEventListener("DOMContentLoaded", function() {
    // Add mouseleave event listener to the sidebar
    const sidebar = document.querySelector('.sidebar');
  
    if (sidebar) {
        sidebar.addEventListener("mouseleave", function() {
            closeSidebar();
        });
    }
  
    function closeSidebar() {
        const openSidebar = document.querySelector('.sidebar.open');
        if (openSidebar) {
            openSidebar.classList.remove('open');
  
            // Reset the left positions to their default values
            document.getElementById('resources-button').style.left = '90px';
  
            const clearResourcesButton = document.querySelector('.clear-resources-button');
            if (clearResourcesButton) {
                clearResourcesButton.style.left = '220px';
            }
  
            // const loginButton = document.querySelector('.login-button');
            // if (loginButton) {
            //     loginButton.style.left = '70px';
            // }
  
            // const loadMarkersButton = document.querySelector('.load-markers-button');
            // if (loadMarkersButton) {
            //     loadMarkersButton.style.left = '460px';
            // }
        }
    }
  });