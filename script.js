    // Initialize map
    const map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM(),
                visible: true,
                name: 'OpenStreetMap'
            }),
            new ol.layer.Tile({
                source: new ol.source.XYZ({
                    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                    attributions: '© Esri'
                }),
                visible: false,
                name: 'Satellite'
            }),
            new ol.layer.Tile({
                source: new ol.source.XYZ({
                    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
                    attributions: '© Esri'
                }),
                visible: false,
                name: 'Terrain'
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([80.1514, 17.2473]),
            zoom: 5
        })
    });
    // Create popup overlay
    const container = document.getElementById('popup');
    const content = document.getElementById('popup-content');
    const closer = document.getElementById('popup-closer');

    const overlay = new ol.Overlay({
        element: container,
        autoPan: {
            animation: {
                duration: 250,
            },
        },
    });
    map.addOverlay(overlay);

    // Close popup
    closer.onclick = function () {
        overlay.setPosition(undefined);
        closer.blur();
        return false;
    };

    // Store active WMS layers
    const activeLayers = [];

    // Store the parsed XML document globally
    let capabilitiesXmlDoc = null;

    // Store DataTable instance
    let layersDataTable = null;

    // Store the current server URL
    let currentServerUrl = '';

    // Base layer switcher
    document.querySelectorAll('input[name="baseLayer"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const layers = map.getLayers();
            layers.forEach((layer, index) => {
                if (index < 3) { // First three layers are base layers
                    layer.setVisible(false);
                }
            });

            if (radio.id === 'osmLayer') {
                layers.item(0).setVisible(true);
            } else if (radio.id === 'satelliteLayer') {
                layers.item(1).setVisible(true);
            } else if (radio.id === 'terrainLayer') {
                layers.item(2).setVisible(true);
            }
        });
    });

    // Fetch layers from GetCapabilities
    document.getElementById('fetchLayersBtn').addEventListener('click', function () {
        currentServerUrl = document.getElementById('serverSelect').value;
        const capabilitiesUrl = `${currentServerUrl}?service=WMS&request=GetCapabilities&version=1.3.0`;

        // Show loading indicator
        document.getElementById('loading').style.display = 'block';
        // Clear previous results
        document.getElementById('layersTableBody').innerHTML = '';
        const proxyUrl = "https://vedas-wms-layer-explorer-1.onrender.com/proxy/getcapabilities?url=" + encodeURIComponent(currentServerUrl);

        fetch(proxyUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(xmlText => {
                // Hide loading indicator
                document.getElementById('loading').style.display = 'none';

                // Parse XML
                const parser = new DOMParser();
                capabilitiesXmlDoc = parser.parseFromString(xmlText, "text/xml");

                // Check for XML errors
                const parseError = capabilitiesXmlDoc.getElementsByTagName("parsererror");
                if (parseError.length > 0) {
                    throw new Error("Failed to parse XML response");
                }

                // Extract server info
                const service = capabilitiesXmlDoc.getElementsByTagName('Service')[0];
                if (!service) {
                    throw new Error("No Service information found in response");
                }

                const serviceTitle = service.getElementsByTagName('Title')[0]?.textContent || 'Unknown Service';
                const serviceAbstract = service.getElementsByTagName('Abstract')[0]?.textContent || 'No description available';


                // Extract layers
                const layerElements = capabilitiesXmlDoc.getElementsByTagName("Layer");
                const layersTableBody = document.getElementById('layersTableBody');
                layersTableBody.innerHTML = ''; // Clear previous results

                let layerCount = 0;

                for (let i = 0; i < layerElements.length; i++) {
                    const nameElem = layerElements[i].getElementsByTagName("Name")[0];
                    const titleElem = layerElements[i].getElementsByTagName("Title")[0];

                    if (nameElem && titleElem) {
                        const layerName = nameElem.textContent;
                        const layerTitle = titleElem.textContent;

                        // Skip the root layer which often has the service title
                        if (layerTitle === serviceTitle) continue;

                        const row = layersTableBody.insertRow();
                        const cellTitle = row.insertCell(0);
                        const cellActions = row.insertCell(1);

                        cellTitle.textContent = layerTitle;

                        // Add action buttons
                        cellActions.innerHTML = `
                            <button class="btn btn-sm btn-outline-primary btn-action zoom-layer" data-layer="${layerName}" title="Zoom to Layer">
                                <i class="bi bi-zoom-in"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-success btn-action add-layer" 
                                    data-layer="${layerName}" 
                                    data-title="${layerTitle}"
                                    title="Add Layer to Map">
                                <i class="bi bi-plus-circle"></i>
                            </button>
                        `;

                        layerCount++;
                    }
                }

                document.getElementById('layerCount').textContent = layerCount;

                if (layerCount === 0) {
                    layersTableBody.innerHTML = `
                        <tr>
                            <td colspan="2" class="text-center py-4">
                                No layers found in the GetCapabilities response
                            </td>
                        </tr>
                    `;
                }

                // Initialize or reinitialize DataTable
                if (layersDataTable) {
                    layersDataTable.destroy();
                }

                layersDataTable = $('#layersTable').DataTable({
                    pageLength: 5,
                    lengthMenu: [5, 10, 25, 50],
                    ordering: true,
                    searching: true,
                    responsive: true,
                    autoWidth: false,
                    columns: [
                        { title: "Title" },
                        { title: "Actions", orderable: false, searchable: false }
                    ]
                });

                // Use event delegation for dynamically created elements
                $('#layersTableBody').on('click', '.zoom-layer', function () {
                    const layerName = $(this).data('layer');
                    zoomToLayer(layerName);
                });

                $('#layersTableBody').on('click', '.add-layer', function () {
                    const layerName = $(this).data('layer');
                    const layerTitle = $(this).data('title');
                    addWmsLayer(currentServerUrl, layerName, layerTitle);
                });
            })
            .catch(error => {
                document.getElementById('loading').style.display = 'none';
                console.error('Error fetching GetCapabilities:', error);

                document.getElementById('layersTableBody').innerHTML = `
                    <tr>
                        <td colspan="2" class="text-center py-4 text-danger">
                            Error: ${error.message}
                        </td>
                    </tr>
                `;
            });
    });

    // Function to zoom to a specific layer's extent
    function zoomToLayer(layerName) {
        if (!capabilitiesXmlDoc) {
            alert('No capabilities data available. Please fetch layers first.');
            return;
        }

        // Find the layer element in the XML
        const layerElements = capabilitiesXmlDoc.getElementsByTagName("Layer");
        let targetLayer = null;

        for (let i = 0; i < layerElements.length; i++) {
            const nameElem = layerElements[i].getElementsByTagName("Name")[0];
            if (nameElem && nameElem.textContent === layerName) {
                targetLayer = layerElements[i];
                break;
            }
        }

        if (!targetLayer) {
            alert('Layer information not found');
            return;
        }

        // Try to get bounding box in CRS:84 (standard lon/lat)
        let bboxElem = targetLayer.getElementsByTagName("BoundingBox")[0];
        if (!bboxElem) {
            alert('No bounding box information available for this layer');
            return;
        }

        // Check if we have a CRS:84 bounding box
        let crs84Bbox = null;
        for (let i = 0; i < targetLayer.getElementsByTagName("BoundingBox").length; i++) {
            const bbox = targetLayer.getElementsByTagName("BoundingBox")[i];
            if (bbox.getAttribute('CRS') === 'CRS:84') {
                crs84Bbox = bbox;
                break;
            }
        }

        // If no CRS:84, use the first available bounding box
        if (!crs84Bbox) {
            crs84Bbox = bboxElem;
        }

        const minx = parseFloat(crs84Bbox.getAttribute('minx'));
        const miny = parseFloat(crs84Bbox.getAttribute('miny'));
        const maxx = parseFloat(crs84Bbox.getAttribute('maxx'));
        const maxy = parseFloat(crs84Bbox.getAttribute('maxy'));

        // Convert to map projection (assuming map is using EPSG:3857)
        const bottomLeft = ol.proj.fromLonLat([minx, miny]);
        const topRight = ol.proj.fromLonLat([maxx, maxy]);

        // Calculate extent
        const extent = [
            bottomLeft[0],
            bottomLeft[1],
            topRight[0],
            topRight[1]
        ];

        // Zoom to extent with padding
        map.getView().fit(extent, {
            padding: [50, 50, 50, 50], // Add some padding
            duration: 1000 // Animation duration in ms
        });
    }

    // Function to add WMS layer to map
    function addWmsLayer(serverUrl, layerName, layerTitle) {
        // Check if layer is already added
        if (activeLayers.some(layer => layer.get('name') === layerName)) {
            alert('Layer is already added to the map');
            return;
        }

        // Show loading indicator
        document.getElementById('mapLoader').style.display = 'flex';

        // Create WMS layer
        const wmsLayer = new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: serverUrl,
                params: {
                    'LAYERS': layerName,
                    'TILED': true
                },
                serverType: 'geoserver',
                transition: 0
            }),
            visible: true,
            name: layerName,
            title: layerTitle
        });

        // Add layer to map
        map.addLayer(wmsLayer);
        activeLayers.push(wmsLayer);

        // Hide loading indicator when layer is loaded
        wmsLayer.getSource().on('tileloadend', function () {
            document.getElementById('mapLoader').style.display = 'none';
        });

        // Also hide loader after a timeout as a fallback
        setTimeout(() => {
            document.getElementById('mapLoader').style.display = 'none';
        }, 5000);

        // Update active layers list
        updateActiveLayersList();

        // Update legend
        updateLegend(serverUrl, layerName);
    }

    // Function to update active layers list with zoom buttons
    function updateActiveLayersList() {
        const activeLayersList = document.getElementById('activeLayersList');
        activeLayersList.innerHTML = '';

        if (activeLayers.length === 0) {
            activeLayersList.innerHTML = '<li class="list-group-item text-center py-4">No active layers</li>';
            document.getElementById('activeLayerCount').textContent = '0';
            return;
        }

        document.getElementById('activeLayerCount').textContent = activeLayers.length;

        activeLayers.forEach((layer, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item active-layer-item';
            li.innerHTML = `
                <div>
                    <strong>${layer.get('title')}</strong>
                    <br>
                    <small class="text-muted">${layer.get('name')}</small>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-info toggle-layer" data-index="${index}" title="Toggle Visibility">
                        <i class="bi ${layer.getVisible() ? 'bi-eye' : 'bi-eye-slash'}"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary zoom-active-layer" data-layer="${layer.get('name')}" title="Zoom to Layer">
                        <i class="bi bi-zoom-in"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger remove-layer" data-index="${index}" title="Remove Layer">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
            activeLayersList.appendChild(li);
        });

        // Add event listeners for toggle, zoom and remove buttons
        document.querySelectorAll('.toggle-layer').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                const layer = activeLayers[index];
                layer.setVisible(!layer.getVisible());

                // Update button icon
                const icon = this.querySelector('i');
                icon.className = layer.getVisible() ? 'bi bi-eye' : 'bi bi-eye-slash';
                this.classList.toggle('btn-outline-secondary', !layer.getVisible());
            });
        });

        // Add event listeners for zoom buttons in active layers
        document.querySelectorAll('.zoom-active-layer').forEach(btn => {
            btn.addEventListener('click', function () {
                const layerName = this.getAttribute('data-layer');
                zoomToLayer(layerName);
            });
        });

        document.querySelectorAll('.remove-layer').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                const layer = activeLayers[index];
                map.removeLayer(layer);
                activeLayers.splice(index, 1);
                updateActiveLayersList();

                // Clear legend if no layers are active
                if (activeLayers.length === 0) {
                    document.getElementById('legend').innerHTML = '<p class="text-muted text-center mb-0">No active layer selected</p>';
                }
            });
        });
    }


    // Update legend for a layer
    function updateLegend(serverUrl, layerName) {
        const legendUrl = `${serverUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=${layerName}`;
        document.getElementById('legend').innerHTML = `
            <strong>Legend for ${layerName}:</strong><br>
            <img src="${legendUrl}" alt="${layerName} Legend" style="max-width: 100%">
        `;
    }

    // Feature info on map click
    map.on('singleclick', function (evt) {
        const view = map.getView();
        const viewResolution = view.getResolution();

        // Check all active WMS layers for feature info
        const featureInfoPromises = activeLayers.map(layer => {
            if (!layer.getVisible()) return Promise.resolve(null);

            const source = layer.getSource();
            if (!source || !(source instanceof ol.source.TileWMS)) return Promise.resolve(null);

            const url = source.getFeatureInfoUrl(
                evt.coordinate,
                viewResolution,
                view.getProjection(),
                { 'INFO_FORMAT': 'application/json' }
            );

            if (!url) return Promise.resolve(null);

            return fetch(url)
                .then(response => response.json())
                .then(json => {
                    if (json.features && json.features.length > 0) {
                        return {
                            layer: layer.get('title'),
                            features: json.features
                        };
                    }
                    return null;
                })
                .catch(error => {
                    console.error('Error fetching feature info:', error);
                    return null;
                });
        });

        // Process all promises
        Promise.all(featureInfoPromises).then(results => {
            const validResults = results.filter(result => result !== null);

            if (validResults.length === 0) {
                document.getElementById('featureInfo').innerHTML = '<p class="text-muted text-center mb-0">No feature information found at this location</p>';
                return;
            }

            let featureInfoHtml = '';
            validResults.forEach(result => {
                featureInfoHtml += `<h6>${result.layer}</h6>`;

                result.features.forEach((feature, index) => {
                    featureInfoHtml += `<div class="mb-3"><strong>Feature ${index + 1}:</strong><table class="table table-sm table-bordered">`;

                    for (const key in feature.properties) {
                        if (feature.properties.hasOwnProperty(key)) {
                            featureInfoHtml += `<tr><td>${key}</td><td>${feature.properties[key]}</td></tr>`;
                        }
                    }

                    featureInfoHtml += '</table></div>';
                });
            });

            if (featureInfoHtml) {
                content.innerHTML = featureInfoHtml;
                overlay.setPosition(evt.coordinate);
            } else {
                overlay.setPosition(undefined);
            }

        });
    });
