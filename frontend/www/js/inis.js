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
  
  let map;

  function delayMapLoading() {
    return new Promise(resolve => {
        setTimeout(resolve, 0);
    });
}

  async function initMap() {
    try {
        await new Promise(resolve => setTimeout(resolve, 0));

        map = L.map("map", {
            zoomControl: false,
            maxZoom: 4,
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
  
  
        var imageOverlay = L.imageOverlay(
            "assets/inis_gallia.webp", [
                [480, -480], // North West
                [-480, 480], // South East
            ]
        ).addTo(map);
        imageOverlay.getElement().classList.add('image-overlay');

        
        // Add event listener to update mouse coordinates when the mouse moves over the map
        map.on("mousemove", (e) => {
            const mouseCoordinates = document.getElementById("mouse-coordinates");
            mouseCoordinates.textContent = `[${e.latlng.lat.toFixed(3)}], ${e.latlng.lng.toFixed(3)}]`;
        });
        const mouseCoordinatesDiv = document.getElementById("mouse-coordinates");
        map.on("mousemove", (e) => {
            mouseCoordinatesDiv.textContent = `[${e.latlng.lat.toFixed(3)}], [${e.latlng.lng.toFixed(3)}]`;
        });
  
  
    } catch (error) {
        console.error(error);
    }
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