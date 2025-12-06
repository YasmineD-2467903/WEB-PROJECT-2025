export function initSettingsSection(userRole, settings, groupId) {
    const adminSec = document.getElementById("admin");
    const memberSec = document.getElementById("member");
    const viewerSec = document.getElementById("viewer");

    if (userRole === "admin") {
        viewerSec.style.display = 'none';
        memberSec.style.display = 'none';
    }

    if (userRole === "member") {
        adminSec.style.display = 'none';
        viewerSec.style.display = 'none';
    }

    if (userRole === "viewer") {
        adminSec.style.display = 'none';
        memberSec.style.display = 'none';
    }

    if (settings) {
        document.getElementById("memberInvitationCheck").checked = !!settings.allowMemberInvite;
        document.getElementById("memberPollCheck").checked = !!settings.allowMemberPoll;
        document.getElementById("viewerChatCheck").checked = !!settings.allowViewerChat;
        document.getElementById("changeBio").value = settings.description || "";
        document.getElementById("changeTitle").value = settings.name || "";
        document.getElementById("changeStartDate").value = formatDateForInput(settings.startDate);
        document.getElementById("changeEndDate").value = formatDateForInput(settings.endDate);
    }

    const saveBtn = document.getElementById("saveSettings");
    const cancelBtn = document.getElementById("cancelSettings");

    function validateDates(start, end) {
        if (!start || !end) return true;
        return new Date(start) <= new Date(end);
    }

    saveBtn.addEventListener("click", async () => {
        const settingsToSave = {
            allowMemberInvite: document.getElementById("memberInvitationCheck").checked,
            allowMemberPoll: document.getElementById("memberPollCheck").checked,
            allowViewerChat: document.getElementById("viewerChatCheck").checked,
            bio: document.getElementById("changeBio").value.trim() || null,
            title: document.getElementById("changeTitle").value.trim() || null,
            startDate: document.getElementById("changeStartDate").value || null,
            endDate: document.getElementById("changeEndDate").value || null
        };

        if (!validateDates(settingsToSave.startDate, settingsToSave.endDate)) {
            alert("Start date cannot be later than end date.");
            return;
        }

        try {
            const res = await fetch(`/group/${groupId}/settings/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settingsToSave)
            });
            if (!res.ok) throw new Error("Failed to save settings");
            alert("Settings saved successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to save settings.");
        }
    });

    cancelBtn.addEventListener("click", () => window.location.reload());
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
