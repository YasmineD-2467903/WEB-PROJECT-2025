//function for popup when inviting person in settings secttion
//neeeds tto be  here, idk why. any other places it doesnt work and i wasted 7 dayas already xd
function initInvitePopup() {
    const btn = document.getElementById("inv-btn");
    const popupHTML = document.getElementById("invitePopup");

    if (!btn || !popupHTML) 
        return;

    btn.addEventListener("click", () => {
        const popup = new bootstrap.Modal(popupHTML);
        popup.show();
    })
}


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
        document.getElementById("startEnd").textContent =
            `${toDDMMYYYY(group.startDate)} - ${toDDMMYYYY(group.endDate)}`;
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

// load section code ->  basically loads in each section   with whateever theey need
function toDDMMYYYY(dateStr) {
    const [month, day, year] = dateStr.split("-");
    return `${day}/${month}/${year}`;
}

    async function loadSection(section) {
    try {
        const res = await fetch(`/group/${groupId}/section/${section}`);
        if (!res.ok) throw new Error("Failed to load section");

        const html = await res.text();
        contentDiv.innerHTML = html;

        //INVITE POPUP MOET NA SECTION-HTML INGELADEN WORDEN
        initInvitePopup();

        // If members section, fetch members and populate
        if (section === "members") {
            try {
                const module = await import("/js/group-partials/members.js");
                await module.loadMembers(groupId);
            } catch (err) {
                console.error("Failed to load members.js", err);
            }
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
            try {
                const module = await import("/js/group-partials/map.js");
                await module.initMap();
            } catch (err) {
                console.error("Failed to load map.js", err);
            }
        }

    } catch (err) {
        console.error(err);
        contentDiv.innerHTML = `<p class="text-danger">Error loading section.</p>`;
    }
    }