// ==================== FETCH DATA ====================

let userRole;
let userId;

let tripStartDate = null;
let tripEndDate = null;
let currentPlannerDate = null;

async function fetchGroupInfo() {
    try {
        const res = await fetch(`/group/${window.groupId}`);
        if (!res.ok) throw new Error("Failed to fetch group info");
        const group = await res.json();

        const userRes = await fetch(`/group/${window.groupId}/settings`);
        if (!res.ok) return alert("Group settings not found");
        const data = await userRes.json();
        userRole = data.role;
        userId = data.userId;

        tripStartDate = group.startDate;
        tripEndDate = group.endDate;
        currentPlannerDate = tripStartDate.split("T")[0];

        if (userRole === 'viewer') {
            document.getElementById("addStopBtn").hidden = true;
            document.getElementById("generateRouteBtn").hidden = false;
        } else if (userRole === 'member') {
            document.getElementById("addStopBtn").hidden = false;
            document.getElementById("generateRouteBtn").hidden = false;
        } else if (userRole === 'admin') {
            document.getElementById("addStopBtn").hidden = false;
            document.getElementById("generateRouteBtn").hidden = false;
        }

        updatePlannerNav();
        loadStopsForDate(currentPlannerDate);
    } catch (err) {
        console.error("Error loading group info:", err);
    }
}

let allStops = [];

async function fetchAllStops() {
    try {
        const res = await fetch(`/group/${window.groupId}/stops`);
        const data = await res.json();

        if (!Array.isArray(data)) {
            console.error("Stops data is not an array:", data);
            allStops = [];
            return;
        }

        allStops = data.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    } catch (err) {
        console.error("Failed to fetch all stops:", err);
        allStops = [];
    }
}

// ==================== MAP ====================

let infoWindow;
let mapInstance = null;
let markersForDay = [];
let directionsService = null;
let directionsRenderer = null;

window.currentDayStops = [];

async function initMap() {
    //  Request the needed libraries.
    const [{ Map, InfoWindow }, { AdvancedMarkerElement }] = await Promise.all([
        google.maps.importLibrary("maps"),
        google.maps.importLibrary("marker"),
        google.maps.importLibrary("places"),
    ]);
    // Get the gmp-map element.
    const mapElement = document.querySelector("gmp-map");
    // Get the inner map.
    const innerMap = mapElement.innerMap;

    mapInstance = innerMap; // save globally
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: innerMap,
        suppressMarkers: true
    });

    // Set map options.
    innerMap.setOptions({
        mapTypeControl: false,
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userPos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };

                // Re-center map
                innerMap.setCenter(userPos);

                // Add a marker for current location
                const userMarker = new google.maps.marker.AdvancedMarkerElement({
                    map: innerMap,
                    position: userPos,
                    title: "Your Location",
                    gmpClickable: false,
                });

                userMarker.addListener("click", () => {
                    infoWindow.setContent("You are here");
                    infoWindow.setHeaderDisabled(false);
                    infoWindow.setHeaderContent("Current Location");
                    infoWindow.open(innerMap, userMarker);
                });
            },
            () => {
                console.warn("Geolocation permission denied or unavailable");
            }
        );
    } else {
        console.warn("Browser does not support geolocation");
    }

    infoWindow = new InfoWindow();

    initAutocomplete(innerMap);
    renderStopsOnMap();
}

function initAutocomplete(map) {
    const input = document.getElementById("pac-input");
    const searchBox = new google.maps.places.SearchBox(input);

    // Get the gmp-map element.
    const mapElement = document.querySelector("gmp-map");
    // Get the inner map.
    const innerMap = mapElement.innerMap;
    // Set map options.
    innerMap.setOptions({
        mapTypeControl: false,
    });

    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
    // Bias the SearchBox results towards current map's viewport.
    map.addListener("bounds_changed", () => {
        searchBox.setBounds(map.getBounds());
    });

    let markers = [];

    // Listen for the event fired when the user selects a prediction and retrieve
    // more details for that place.
    searchBox.addListener("places_changed", () => {
        const places = searchBox.getPlaces();

        if (places.length == 0) {
            return;
        }

        // Clear out the old markers.
        markers.forEach((marker) => {
            marker.setMap(null);
        });
        markers = [];

        // For each place, get the icon, name and location.
        const bounds = new google.maps.LatLngBounds();

        places.forEach((place) => {
            if (!place.geometry || !place.geometry.location) {
                console.log("Returned place contains no geometry");
                return;
            }

            const icon = {
                url: place.icon,
                size: new google.maps.Size(71, 71),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(17, 34),
                scaledSize: new google.maps.Size(25, 25),
            };

            // Create a marker for each place.
            markers.push(
            new google.maps.Marker({
                    map,
                    icon,
                    title: place.name,
                    position: place.geometry.location,
                    placeTypes: place.types,
                    placeAddress: place.formatted_address || "",
                    placeId: place.place_id || null,
                }),
            );

            if (place.geometry.viewport) {
                // Only geocodes have viewport.
                bounds.union(place.geometry.viewport);
            } else {
                bounds.extend(place.geometry.location);
            }
        });

        map.fitBounds(bounds);

        for (const marker of markers) {
            marker.addListener("click", (ev) => {
                const type = marker.placeTypes?.[0] || "Unknown place";
                const address = marker.placeAddress || "";
                const placeId = marker.placeId;

                const lat = ev.latLng.lat();
                const lng = ev.latLng.lng();

                // Save the last selected stop globally
                window.lastSelectedStop = {
                    title: marker.title,
                    lat,
                    lng,
                    address,
                    type,
                    placeId
                };

                const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&z=15&query_place_id=${placeId}`;

                infoWindow.setContent(`
                    <div>
                        Type: ${type}<br>
                        ${address}<br>
                        <a href="${url}" target="_blank">View on Google Maps</a>
                    </div>
                `);
                infoWindow.setHeaderDisabled(false);
                infoWindow.setHeaderContent(`${marker.title}`);
                infoWindow.open(innerMap, marker);
            });

            marker.addListener("closeclick", () => {
                infoWindow.close();
            });
        }

    });
}

function renderStopsOnMap() {
    if (!mapInstance) return;

    markersForDay.forEach(marker => marker.setMap(null));
    markersForDay = [];

    if (directionsRenderer) {
        directionsRenderer.set('directions', null);
    }

    if (!window.currentDayStops || window.currentDayStops.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    window.currentDayStops.forEach(stop => {
        const lat = Number(stop.lat);
        const lng = Number(stop.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.warn("Skipping stop with invalid coordinates:", stop);
            return;
        }

        const position = new google.maps.LatLng(lat, lng);

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: mapInstance,
            position,
            title: stop.title
        });

        markersForDay.push(marker);
        bounds.extend(position);
    });

    if (markersForDay.length > 0) {
        mapInstance.fitBounds(bounds);
    }
}


async function generateRouteForDay() {
    const stops = window.currentDayStops;
    if (!stops || stops.length < 2) {
        alert("Need at least 2 stops to create a route.");
        return;
    }

    const waypoints = stops.slice(1, -1).map(s => ({
        location: { lat: s.lat, lng: s.lng },
        stopover: true
    }));

    const request = {
        origin: { lat: stops[0].lat, lng: stops[0].lng },
        destination: { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng },
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
    };

    directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
        } else {
            console.error("Route error:", status, result);
            alert("Failed to generate route");
        }
    });
}

document.getElementById("generateRouteBtn").addEventListener("click", generateRouteForDay);

// ==================== PLANNER NAV ====================

const prevBtn = document.getElementById("prevDayBtn");
const nextBtn = document.getElementById("nextDayBtn");

function updatePlannerNav() {
    const current = new Date(currentPlannerDate);
    const start = new Date(tripStartDate);
    const end = new Date(tripEndDate);

    prevBtn.style.display = current > start ? 'inline-block' : 'none';
    nextBtn.style.display = current < end ? 'inline-block' : 'none';
}

prevBtn.addEventListener("click", () => {
    const prev = new Date(currentPlannerDate);
    prev.setDate(prev.getDate() - 1);

    if (prev >= new Date(tripStartDate)) {
        currentPlannerDate = prev.toISOString().split("T")[0];
        loadStopsForDate(currentPlannerDate);
    }
});

nextBtn.addEventListener("click", () => {
    const next = new Date(currentPlannerDate);
    next.setDate(next.getDate() + 1);

    if (next <= new Date(tripEndDate)) {
        currentPlannerDate = next.toISOString().split("T")[0];
        loadStopsForDate(currentPlannerDate);
    }
});

// ==================== LOAD STOPS ====================

function loadStopsForDate(dateStr) {
    document.getElementById("plannerDate").innerText = dateStr;

    const stopsForDate = allStops.filter(stop => {
        const stopDate = new Date(stop.startDate);
        const currentDate = new Date(dateStr);
        return stopDate.getFullYear() === currentDate.getFullYear() &&
               stopDate.getMonth() === currentDate.getMonth() &&
               stopDate.getDate() === currentDate.getDate();
    });
    
    window.currentDayStops = [...stopsForDate];

    const container = document.getElementById("stopsContainer");
    container.innerHTML = "";

    if (stopsForDate.length === 0) {
        container.innerHTML = `<div class="text-center">
                                  <h3>No stops for this day</h3>
                                </div>`;
        
        renderStopsOnMap();
        if (directionsRenderer) directionsRenderer.set('directions', null);

        updatePlannerNav();
        return;
    }

    stopsForDate.forEach(stop => {
        const stopEl = document.createElement("div");
        stopEl.className = "stop";

        const filesHtml = stop.files && stop.files.length > 0
            ? `<div class="stop-files">Files:<ul>${stop.files.map(f => 
                `<li><a href="/uploads/stops/${f.file_path}" target="_blank">${f.file_name}</a></li>`).join("")}</ul></div>`
            : "";

        const isOwner = (stop.creator_id && stop.creator_id === userId);
        const canEdit = userRole === 'admin' || (userRole === 'member' && isOwner);
        
        const editButtonHtml = canEdit 
            ? `<button class="btn btn-sm btn-secondary editStopBtn" data-id="${stop.id}">Edit</button>`
            : "";

        stopEl.innerHTML = `
            <h4>${stop.title}</h4>
            <div>${stop.startDate} - ${stop.endDate}</div>
            <div>${stop.description || ""}</div>
            <div>Author: ${stop.author}</div>
            ${filesHtml}
            ${editButtonHtml}
        `;
        container.appendChild(stopEl);
    });

    document.querySelectorAll(".editStopBtn").forEach(btn => {
        btn.addEventListener("click", () => openEditStopModal(btn.dataset.id));
    });

    updatePlannerNav();
    renderStopsOnMap();
    if (directionsRenderer) directionsRenderer.set('directions', null);
}


// ==================== ADD STOP ====================

document.getElementById("addStopBtn").addEventListener("click", () => {
    if (!window.lastSelectedStop) {
        return alert("Please select a location on the map first.");
    }

    document.getElementById("stopTitle").value = window.lastSelectedStop.title || "";
    document.getElementById("stopStart").value = `${currentPlannerDate}T09:00`;
    document.getElementById("stopEnd").value = `${currentPlannerDate}T10:00`;

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("addStopModal"));
    modal.show();
});

document.getElementById("addStopForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const start = document.getElementById("stopStart").value;
    const end = document.getElementById("stopEnd").value;

    if (end < start) return alert("End date/time cannot be before start date/time");
    if (start < tripStartDate || end > tripEndDate) return alert("Stop must be within the trip duration");

    const formData = new FormData(e.target);
    formData.append("lat", window.lastSelectedStop.lat);
    formData.append("lng", window.lastSelectedStop.lng);

    try {
        const res = await fetch(`/group/${window.groupId}/stops`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById("addStopModal")).hide();
            await fetchAllStops(); 
            loadStopsForDate(currentPlannerDate);
        } else {
            alert(data.error || "Failed to add stop");
        }
    } catch (err) {
        console.error("Failed to add stop:", err);
        alert("Failed to add stop. Check console for details.");
    }
});

// ==================== EDIT STOP ====================

async function openEditStopModal(stopId) {
    try {
        // Fetch stop details
        const res = await fetch(`/group/${window.groupId}/stops/${stopId}`);
        if (!res.ok) return alert("Stop not found");
        const stop = await res.json();

        const isOwner = (stop.creator_id && stop.creator_id === userId);
        const canEdit = userRole === 'admin' || (userRole === 'member' && isOwner);
        
        // just in case
        if (!canEdit) {
            alert("You don't have permission to edit this stop");
            return;
        }

        // Fetch existing files for this stop
        const filesRes = await fetch(`/group/${window.groupId}/stops/${stopId}/files`);
        const existingFiles = await filesRes.json();

        // Fill modal fields
        document.getElementById("editStopTitle").value = stop.title;
        document.getElementById("editStopStart").value = stop.startDate;
        document.getElementById("editStopEnd").value = stop.endDate;
        document.getElementById("editStopDescription").value = stop.description || "";

        // Populate existing files
        const filesContainer = document.getElementById("existingFiles");
        filesContainer.innerHTML = "";
        existingFiles.forEach(file => {
            const fileEl = document.createElement("div");
            fileEl.className = "file-item mb-1 d-flex justify-content-between align-items-center";
            fileEl.dataset.id = file.id;
            fileEl.innerHTML = `
                <a href="/uploads/stops/${file.file_path}" target="_blank">${file.file_name}</a>
                <button type="button" class="btn btn-sm btn-danger delete-file-btn">Remove</button>
            `;
            filesContainer.appendChild(fileEl);

            fileEl.querySelector(".delete-file-btn").addEventListener("click", async () => {
                if (!confirm(`Delete file "${file.file_name}"?`)) return;
                try {
                    const delRes = await fetch(`/group/${window.groupId}/stops/${stopId}/files/${file.id}/delete`, {
                        method: "POST"
                    });
                    const data = await delRes.json();
                    if (delRes.ok) {
                        fileEl.remove();
                    } else {
                        alert(data.error || "Failed to delete file");
                    }
                } catch (err) {
                    console.error("Failed to delete file:", err);
                    alert("Failed to delete file. Check console.");
                }
            });
        });

        // Show modal
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("editStopModal"));
        modal.show();

        // clear previous form handlers to avoid duplicates
        const editForm = document.getElementById("editStopForm");
        editForm.onsubmit = null;
        editForm.onsubmit = async (e) => {
            e.preventDefault();

            const start = document.getElementById("editStopStart").value;
            const end = document.getElementById("editStopEnd").value;
            if (end < start) return alert("End date/time cannot be before start date/time");

            const editFormData = new FormData(e.target);

            try {
                const updateRes = await fetch(`/group/${window.groupId}/stops/${stopId}/update`, {
                    method: "POST",
                    body: editFormData
                });
                const data = await updateRes.json();
                if (updateRes.ok) {
                    modal.hide();
                    await fetchAllStops(); 
                    loadStopsForDate(currentPlannerDate);
                } else {
                    alert(data.error || "Failed to update stop");
                }
            } catch (err) {
                console.error("Failed to update stop:", err);
                alert("Failed to update stop. Check console for details.");
            }
        };

        // Delete stop
        const deleteBtn = document.getElementById("deleteStopBtn");
        deleteBtn.onclick = async () => {
            if (!confirm("Are you sure you want to delete this stop?")) return;
            try {
                const deleteRes = await fetch(`/group/${window.groupId}/stops/${stopId}/delete`, {
                    method: 'POST'
                });
                const data = await deleteRes.json();
                if (deleteRes.ok) {
                    modal.hide();
                    await fetchAllStops(); 
                    loadStopsForDate(currentPlannerDate);
                } else {
                    alert(data.error || "Failed to delete stop");
                }
            } catch (err) {
                console.error("Failed to delete stop:", err);
                alert("Failed to delete stop. Check console for details.");
            }
        };

    } catch (err) {
        console.error("Failed to open edit modal:", err);
        alert("Failed to open stop. Check console for details.");
    }
}

// ==================== INIT ====================

export async function init() {
    await fetchGroupInfo();
    await fetchAllStops();
    loadStopsForDate(currentPlannerDate);

    await initMap();
}

init();
