// Initialize map
const map = new ol.Map({
    target: 'map',
    layers: [
        new ol.layer.Tile({
            source: new ol.source.OSM(),
            visible: true,
            name: 'OpenStreetMap',
            title: 'OpenStreetMap'
        }),
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                attributions: '© Esri'
            }),
            visible: false,
            name: 'Satellite',
            title: 'Satellite'
        }),
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
                attributions: '© Esri'
            }),
            visible: false,
            name: 'Terrain',
            title: 'Terrain'
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

// Initialize UI components
function initUI() {
    // Mobile panel toggle
    const leftPanel = document.getElementById('leftPanel');
    const leftPanelToggle = document.getElementById('leftPanelToggle');
    const closeLeftPanel = document.getElementById('closeLeftPanel');
    const overlay = document.getElementById('overlay');


    leftPanelToggle.addEventListener('click', function () {
        leftPanel.classList.add('active');
        overlay.classList.add('active');

    });

    closeLeftPanel.addEventListener('click', function () {
        leftPanel.classList.remove('active');
        overlay.classList.remove('active');
    });

    overlay.addEventListener('click', function () {
        leftPanel.classList.remove('active');
        overlay.classList.remove('active');
    });

    // Base layer switching
    document.querySelectorAll('input[name="baseLayer"]').forEach(radio => {
        radio.addEventListener('change', function () {
            switchBaseLayer(this.id);
        });
    });

    // Fetch layers button
    document.getElementById('fetchLayersBtn').addEventListener('click', fetchLayers);

    // Server selection change
    document.getElementById('serverSelect').addEventListener('change', function () {
        // Clear previous layers when server changes
        document.getElementById('layersTableBody').innerHTML =
            '<tr><td colspan="3" class="text-center py-4">Select a server and click "Fetch Available Layers"</td></tr>';
        document.getElementById('layerCount').textContent = '0';

        if (layersDataTable) {
            layersDataTable.destroy();
            layersDataTable = null;
        }
    });
}

// Switch base layer
function switchBaseLayer(layerId) {
    const layers = map.getLayers();
    layers.forEach((layer, index) => {
        if (index < 3) { // First three layers are base layers
            layer.setVisible(false);
        }
    });

    if (layerId === 'osmLayer') {
        layers.item(0).setVisible(true);
    } else if (layerId === 'satelliteLayer') {
        layers.item(1).setVisible(true);
    } else if (layerId === 'terrainLayer') {
        layers.item(2).setVisible(true);
    }
}


// // Fetch layers from GetCapabilities
function fetchLayers() {
    currentServerUrl = document.getElementById('serverSelect').value;
    const capabilitiesUrl = `${currentServerUrl}?service=WMS&request=GetCapabilities&version=1.3.0`;

    // Show loading indicator
    document.getElementById('loading').style.display = 'flex';
    // Clear previous results
    document.getElementById('layersTableBody').innerHTML = '';
    const proxyUrl = "https://vedas-wms-layer-explorer.onrender.com/proxy/getcapabilities?url=" + encodeURIComponent(currentServerUrl);

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
                    row.className = 'layer-row';
                    row.setAttribute('data-layer-name', layerName);

                    const cellTitle = row.insertCell(0);
                    const cellStatus = row.insertCell(1);
                    const cellActions = row.insertCell(2);

                    cellTitle.textContent = layerTitle;
                    cellTitle.className = 'layer-title';

                    // Status cell
                    cellStatus.innerHTML = '<span class="badge bg-secondary status-badge">Not Added</span>';
                    cellStatus.className = 'text-center';

                    // Add action buttons
                    cellActions.innerHTML = `
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-outline-primary zoom-layer" data-layer="${layerName}" title="Zoom to Layer">
                                <i class="bi bi-zoom-in"></i>
                            </button>
                            <button class="btn btn-outline-success toggle-layer" 
                                    data-layer="${layerName}" 
                                    data-title="${layerTitle}"
                                    title="Toggle Layer Visibility">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-info info-layer" data-layer="${layerName}" title="Layer Info">
                                <i class="bi bi-info-circle"></i>
                            </button>
                        </div>
                    `;

                    layerCount++;
                }
            }

            document.getElementById('layerCount').textContent = layerCount;

            if (layerCount === 0) {
                layersTableBody.innerHTML = `
                    <tr>
                        <td colspan="3" class="text-center py-4">
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
                    { title: "Status", width: "100px", className: "text-center" },
                    { title: "Actions", orderable: false, searchable: false, width: "160px" }
                ],
                language: {
                    search: "Filter layers:",
                    lengthMenu: "Show _MENU_ layers",
                    info: "Showing _START_ to _END_ of _TOTAL_ layers",
                    infoEmpty: "No layers available",
                    infoFiltered: "(filtered from _MAX_ total layers)"
                }
            });

            // Use event delegation for dynamically created elements
            $('#layersTableBody').on('click', '.zoom-layer', function () {
                const layerName = $(this).data('layer');
                zoomToLayer(layerName);
            });

            $('#layersTableBody').on('click', '.toggle-layer', function () {
                const layerName = $(this).data('layer');
                const layerTitle = $(this).data('title');
                const row = $(this).closest('tr');

                // Check if layer is already added
                const layerIndex = activeLayers.findIndex(layer => layer.get('name') === layerName);

                if (layerIndex === -1) {
                    // Layer not added yet, add it
                    addWmsLayer(currentServerUrl, layerName, layerTitle, row);
                } else {
                    // Layer already added, toggle visibility
                    const layer = activeLayers[layerIndex];
                    const isVisible = layer.getVisible();
                    layer.setVisible(!isVisible);

                    // Update button appearance
                    const icon = $(this).find('i');
                    if (!isVisible) {
                        icon.removeClass('bi-eye').addClass('bi-eye-slash');
                        row.find('.status-badge').removeClass('bg-success').addClass('bg-secondary').text('Hidden');
                    } else {
                        icon.removeClass('bi-eye-slash').addClass('bi-eye');
                        row.find('.status-badge').removeClass('bg-secondary').addClass('bg-success').text('Visible');
                    }

                    // Update row styling
                    row.toggleClass('table-active', !isVisible);
                }
            });

            $('#layersTableBody').on('click', '.info-layer', function () {
                const layerName = $(this).data('layer');
                showLayerInfo(layerName);
            });

            // Show layers panel on mobile after fetching
            if (window.innerWidth <= 991.98) {
                document.getElementById('leftPanel').classList.add('active');
                document.getElementById('overlay').classList.add('active');
            }
        })
        .catch(error => {
            document.getElementById('loading').style.display = 'none';
            console.error('Error fetching GetCapabilities:', error);

            document.getElementById('layersTableBody').innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle"></i> Error: ${error.message}
                    </td>
                </tr>
            `;
        });
}

document.getElementById('addServerBtn').addEventListener('click', function () {
    const customUrlInput = document.getElementById('customServerUrl');
    const url = customUrlInput.value.trim();

    if (!url) {
        alert('Please enter a valid WMS server URL.');
        return;
    }

    const serverSelect = document.getElementById('serverSelect');

    // Check if the URL already exists
    for (let i = 0; i < serverSelect.options.length; i++) {
        if (serverSelect.options[i].value === url) {
            alert('This server is already added.');
            return;
        }
    }

    // Create new option dynamically
    const option = document.createElement('option');
    option.value = url;

    // Label: "Local GeoServer" if localhost, otherwise show URL
    option.textContent = url

    serverSelect.appendChild(option);
    serverSelect.value = url;  // Select the newly added server
    customUrlInput.value = ''; // Clear input

    // Automatically fetch layers for the new server
    fetchLayers();
});


// Function to show layer information
function showLayerInfo(layerName) {
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

    // Extract layer information
    const titleElem = targetLayer.getElementsByTagName("Title")[0];
    const abstractElem = targetLayer.getElementsByTagName("Abstract")[0];
    const bboxElem = targetLayer.getElementsByTagName("BoundingBox")[0];

    const title = titleElem ? titleElem.textContent : 'No title available';
    const abstract = abstractElem ? abstractElem.textContent : 'No description available';
    let bboxInfo = 'No bounding box information';

    if (bboxElem) {
        const minx = bboxElem.getAttribute('minx');
        const miny = bboxElem.getAttribute('miny');
        const maxx = bboxElem.getAttribute('maxx');
        const maxy = bboxElem.getAttribute('maxy');
        const crs = bboxElem.getAttribute('CRS') || bboxElem.getAttribute('crs') || 'Unknown CRS';

        bboxInfo = `CRS: ${crs}, BBOX: [${minx}, ${miny}, ${maxx}, ${maxy}]`;
    }

    // Show in a modal or alert
    alert(`Layer Information:\n\nTitle: ${title}\n\nDescription: ${abstract}\n\n${bboxInfo}`);
}

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

    // Switch to map view on mobile after zooming
    if (window.innerWidth <= 991.98) {
        document.getElementById('leftPanel').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    }
}

// Function to add WMS layer to map
function addWmsLayer(serverUrl, layerName, layerTitle, row) {
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

    // Update the row status
    row.find('.status-badge').removeClass('bg-secondary').addClass('bg-success').text('Visible');
    row.addClass('table-active');

    // Update the button icon
    row.find('.toggle-layer i').removeClass('bi-eye').addClass('bi-eye-slash');

    // Update legend
    updateLegend(serverUrl, layerName, layerTitle);

    // Show map view on mobile after adding layer
    if (window.innerWidth <= 991.98) {
        document.getElementById('leftPanel').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    }
}

// Update legend for a layer
function updateLegend(serverUrl, layerName, layerTitle) {
    const legendUrl = `${serverUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=${layerName}`;
    document.getElementById('legend').innerHTML = `
        <h6 class="mb-2">${layerTitle}</h6>
        <div class="text-center">
            <img src="${legendUrl}" alt="${layerName} Legend" class="img-fluid" onerror="this.style.display='none'">
        </div>
        <div class="mt-2 small text-muted text-center">Legend for ${layerName}</div>
    `;
}

// Feature info on map click
map.on('singleclick', function (evt) {
    const view = map.getView();
    const viewResolution = view.getResolution();
    const size = map.getSize();
    const projection = view.getProjection();

    // Get the map extent (bounding box)
    const extent = view.calculateExtent(size);

    // Check all active WMS layers for feature info
    const featureInfoPromises = activeLayers.map(layer => {
        if (!layer.getVisible()) return Promise.resolve(null);

        const source = layer.getSource();
        if (!source || !(source instanceof ol.source.TileWMS)) return Promise.resolve(null);

        // Calculate pixel coordinates for the click
        const coordinate = evt.coordinate;
        const pixel = map.getPixelFromCoordinate(coordinate);

        // Build the proxy URL
        const proxyUrl = "https://vedas-wms-layer-explorer.onrender.com/proxy/getfeatureinfo?" +
            `url=${encodeURIComponent(currentServerUrl)}` +
            `&bbox=${extent.join(',')}` +
            `&width=${size[0]}` +
            `&height=${size[1]}` +
            `&x=${Math.round(pixel[0])}` +
            `&y=${Math.round(pixel[1])}` +
            `&layers=${layer.get('name')}` +
            `&crs=${projection.getCode()}`;

        return fetch(proxyUrl)
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
            content.innerHTML = '<p class="text-muted text-center mb-0">No feature information found at this location</p>';
            overlay.setPosition(evt.coordinate);
            return;
        }

        let featureInfoHtml = '';
        validResults.forEach(result => {
            featureInfoHtml += `<h6 class="border-bottom pb-2 mb-2">${result.layer}</h6>`;

            result.features.forEach((feature, index) => {
                featureInfoHtml += `<div class="mb-3"><strong>Feature ${index + 1}:</strong><table class="table table-sm table-bordered mt-1">`;

                for (const key in feature.properties) {
                    if (feature.properties.hasOwnProperty(key)) {
                        featureInfoHtml += `<tr><td class="fw-bold">${key}</td><td>${feature.properties[key] || 'N/A'}</td></tr>`;
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

// Initialize the UI when the document is ready
document.addEventListener('DOMContentLoaded', function () {
    initUI();
});
