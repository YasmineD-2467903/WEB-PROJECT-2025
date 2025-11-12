function myMap() {
const mapOptions = {
    center: { lat: 50.925093085784084, lng: 5.353779743653817 },
    zoom: 15,
};
new google.maps.Map(document.getElementById("map"), mapOptions);
}