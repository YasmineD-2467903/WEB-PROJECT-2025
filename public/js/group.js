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

    } catch (err) {
        console.error(err);
        contentDiv.innerHTML = `<p class="text-danger">Error loading section.</p>`;
    }
    }