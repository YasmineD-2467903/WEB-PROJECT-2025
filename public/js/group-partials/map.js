export async function initMap() {
    if (!window.googleMapsLoaded) {
        window.googleMapsLoaded = true;

        const mapsApi = document.createElement("script");
        mapsApi.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyDf8c_RldjfbjhoyNzxzEYMXt3v8rAVToQ&callback=initMap";
        mapsApi.async = true;
        mapsApi.defer = true;
        document.body.appendChild(mapsApi);

        window.initMap = () => {
            const mapOptions = {
                center: { lat: 50, lng: 5 },
                zoom: 15
            };
            new google.maps.Map(document.getElementById("map"), mapOptions);
        };
    } else {
        window.initMap();
    }
}