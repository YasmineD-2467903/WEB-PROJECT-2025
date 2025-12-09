// map.js

let infoWindow;
let marker;

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
    // Set map options.
    innerMap.setOptions({
        mapTypeControl: false,
    });

    const marker = new AdvancedMarkerElement({
        map: innerMap,
        position: mapElement.center,
        title: "something",
        gmpClickable: true,
    });
    mapElement.append(marker);

    // it works now its okay

    infoWindow = new InfoWindow();

    marker.addListener("click", (ev) => {
        infoWindow.setContent("test...");
        infoWindow.setHeaderDisabled(false);
        infoWindow.setHeaderContent(marker.title);
        infoWindow.open(innerMap, marker);
    });

    initAutocomplete(innerMap);
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

            const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&z=15&query_place_id=${placeId}`;

            infoWindow.setContent(`
                <div>
                    Type: ${type}<br>
                    ${address} <br>
                    <a href="${url}" target="_blank">
                        View on Google Maps
                    </a>
                </div>
            `);
            infoWindow.setHeaderDisabled(false);
            infoWindow.setHeaderContent(`${marker.title}`);
            infoWindow.open(innerMap, marker);
        }); 

        marker.addListener('closeclick', ()=>{
            infoWindow.close();
        });
    }
});
}

initMap();