//section codeeeeee -> basically loads in a sectttion dependent on which button u click
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

    // popup code, fully inspireed by an awesome video:  https://www.youtube.com/watch?v=MBaw_6cPmAw
    const openPopupButtons =  document.querySelectorAll("[data-popup-target]");
    const closePopupButtons =  document.querySelectorAll("[data-close-button]");
    const overlay = document.getElementById("overlay");

    openPopupButtons.forEach(button => {
        button.addEventListener("click", () => {
            const popup = document.querySelector("button.dataset.modelTarget"); //apparently leest JS  dit in  camelcasee??   want zo  is hett in     onze html en de  video zei dat dit prima  was xdd
            openPopup(popup);
        })
    })

    overlay.addEventListener("click", () => {
        const popups = document.querySelectorAll(".modal.active") //select all   activee popups
        popups.forEach(popup => {
            closePopup(popup)
        })
    })

    closePopupButtons.forEach(button => {
        button.addEventListener("click", () => {
            const popup = button.closest(".popup");   //looks for closest parent with class popup!
            closePopup(popup);
        })
    })

    function openPopup(popup) {
        if (popup == null) return;
        popup.classList.add("active");
        overlay.classList.add("active");
    }

    function closePopup(popup) {
        if (popup == null) return;
        popup.classList.remove("active");
        overlay.classList.remove("active");
    }

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

        // If settings section, dependent on user role show specific settings
        if (section === "settings") {
           const userRoleRes = await fetch(`/group/${groupId}/settings`);
           const userRole = (await userRoleRes.json()).role; //forces het om te wachten promise klaara is en dann result returnen, aandeers returned het een onafgewerkte iets en dan caan hett niet de ids opppiken en werkt ditt niet xd
            
           const adminSec = document.getElementById("admin");
           const memberSec = document.getElementById("member");
           const viewerSec = document.getElementById("viewer");

           if (userRole === "admin") {
            viewerSec.style.display = 'none';
           }

           if (userRole === "member") {
            adminSec.style.display = 'none';
            viewerSec.style.display = 'none';
           }

           if (userRole === "viewer") {
            adminSec.style.display = 'none';
            memberSec.style.display = 'none';
           }
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