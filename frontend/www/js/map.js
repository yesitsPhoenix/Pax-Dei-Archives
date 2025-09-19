let map;

async function initMap() {
    try {
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
                    "frontend/www/assets/home.png"
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
            "frontend/www/assets/combined_dark1.jpg", [
                [700, -520],
                [-700, 520],
            ]
        ).addTo(map);
        imageOverlay.getElement().classList.add('image-overlay');

        const mouseCoordinatesDiv = document.getElementById("mouse-coordinates");
        if (mouseCoordinatesDiv) {
            map.on("mousemove", (e) => {
                mouseCoordinatesDiv.textContent = `Map Coordinates\n[${e.latlng.lat.toFixed(3)}], [${e.latlng.lng.toFixed(3)}]`;
            });
        }

        const defaultIcon = L.icon({
            iconUrl: 'frontend/www/assets/default_marker.png',
            iconSize: [72, 72],
            iconAnchor: [36, 72],
            popupAnchor: [-3, -76]
        });

        const tempMarkerIcon = L.icon({
            iconUrl: 'frontend/www/assets/red_marker.png',
            iconSize: [41, 41],
            iconAnchor: [18, 41],
            popupAnchor: [1, -34],
        });

        map.on("click", function(e) {
            const tempMarker = L.marker(e.latlng, {
                icon: tempMarkerIcon
            }).addTo(map);

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

            popupDiv.appendChild(inputField);
            popupDiv.appendChild(coordinatesText);

            popupDiv.appendChild(document.createElement("br"));
            popupDiv.appendChild(copyButton);
            popupDiv.appendChild(document.createTextNode("\u00A0\u00A0"));

            tempMarker.bindPopup(popupDiv).openPopup();

            tempMarker.on("click", function(event) {
                if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
                    tempMarker.remove();
                }
            });

            const copyDataButton = popupDiv.querySelector("#copy-data");
            copyDataButton.addEventListener("click", function() {
                const inputField = document.getElementById("marker-input");
                const enteredText = inputField.value;
                const coordinates = ` ${e.latlng.lat.toFixed(3)},${e.latlng.lng.toFixed(3)}`;

                const combinedText = `${enteredText}${coordinates}`;
                copyToClipboard(combinedText);
            });

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
        console.error("Error initializing map:", error);
    }
}

L.Map.mergeOptions({
    smoothWheelZoom: true,
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