    const groupId = window.groupId;
    document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch(`/group/${groupId}`);
        if (!response.ok) throw new Error("Failed to fetch group data");

        const group = await response.json();
        document.getElementById("groupName").textContent = group.name;
        document.getElementById("groupDescription").textContent =
        group.description || "No description provided.";
    } catch (err) {
        console.error(err);
        document.body.innerHTML =
        "<p class='text-danger text-center'>Error loading group data.</p>";
    }
    });

    const buttons = document.querySelectorAll(".menu button");
    const contentDiv = document.getElementById("dynamicContent");

    buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        const section = btn.getAttribute("data-section");
        loadSection(section);
    });
    });

    async function loadSection(section) {
    try {
        const res = await fetch(`/group/${groupId}/section/${section}`);
        if (!res.ok) throw new Error("Failed to load section");

        const html = await res.text();
        contentDiv.innerHTML = html;

        // If members section, fetch members and populate
        if (section === "members") {
            const membersRes = await fetch(`/group/${groupId}/members`);
            const members = await membersRes.json();

            const admins = members.filter(m => m.role === "admin");
            const regulars = members.filter(m => m.role === "member");
            const viewers = members.filter(m => m.role === "viewer");

            const createList = (list, users) => {
                list.innerHTML = users.length
                ? users.map(u => `<li class="list-group-item">${u.username}</li>`).join("")
                : `<li class="list-group-item text-muted">None</li>`;
            };

            createList(document.getElementById("adminList"), admins);
            createList(document.getElementById("memberList"), regulars);
            createList(document.getElementById("viewerList"), viewers);
        }

        if (section === "map") {
            contentDiv.innerHTML = `
                <div id="map" style="width: 100%; height: 400px;"></div>
            `;

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

    } catch (err) {
        console.error(err);
        contentDiv.innerHTML = `<p class="text-danger">Error loading section.</p>`;
    }
    }