// map.js

async function initMap() {
    //  Request the needed libraries.
    const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
        google.maps.importLibrary("maps"),
        google.maps.importLibrary("marker"),
        google.maps.importLibrary("core"),
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

    // this following part doesnt work
    // the infoWindow isn't recognised? I'm missing a lib?
    // but idk which one cause google has horrible documentation

    marker.addListener('click', ({ domEvent, latLng }) => {
    const { target } = domEvent;
    infoWindow.close();
    infoWindow.setContent(marker.title);
    infoWindow.open(marker.map, marker);
});
}

initMap();