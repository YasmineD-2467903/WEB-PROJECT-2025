// DATA

const groupId = window.groupId;
const buttons = document.querySelectorAll(".menu button");
const contentDiv = document.getElementById("dynamicContent");


// EVENT LISTENERS

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

buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        const section = btn.getAttribute("data-section");
        loadSection(section);
    });
});


// FUNCTIONS
function toDDMMYYYY(dateStr) {
    const [month, day, year] = dateStr.split("-");
    return `${day}/${month}/${year}`;
}

function formatDateForInput(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2,'0');
    const day = String(date.getDate()).padStart(2,'0');
    const hours = String(date.getHours()).padStart(2,'0');
    const minutes = String(date.getMinutes()).padStart(2,'0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}


async function loadSection(section) {
    try {
        const res = await fetch(`/group/${groupId}/section/${section}`);
        if (!res.ok) throw new Error("Failed to load section");

        const html = await res.text();
        contentDiv.innerHTML = html;

        // if members section, fetch members and populate
        if (section === "members") {
            try {
                const module = await import("/js/group-partials/members.js");
                await module.loadMembers(groupId);
            } catch (err) {
                console.error("Failed to load members.js", err);
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

        if (section === "polls") {
            try {
                const module = await import("/js/group-partials/polls.js");
                await module.loadPolls(groupId);
            } catch (err) {
                console.error("Failed to load polls.js", err);
            }
        }

        if (section === "settings") {
            const res = await fetch(`/group/${groupId}/settings`);
            const data = await res.json();

            const userRole = data.role;
            const settings = data.settings; 

            const { initSettingsSection } = await import("/js/group-partials/settings.js");
            initSettingsSection(userRole, settings, groupId);
        }

        if (section === "chat") {
            try {
                const module = await import("/js/group-partials/chat.js");
                await module.initChat(groupId);
            } catch (err) {
                console.error("Failed to load chat.js", err);
            }
        }

    } catch (err) {
        console.error(err);
        contentDiv.innerHTML = `<p class="text-danger">Error loading section.</p>`;
    }
}