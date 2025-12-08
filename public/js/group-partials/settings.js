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
        
        function formatForDatetimeInput(dateStr) {
            const date = new Date(dateStr);
            const pad = (n) => n.toString().padStart(2, "0");
            const year = date.getFullYear();
            const month = pad(date.getMonth() + 1); // months are 0-indexed APPARENTLY
            const day = pad(date.getDate());
            const hours = pad(date.getHours());
            const minutes = pad(date.getMinutes());
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }

        document.getElementById("changeStartDate").value = formatForDatetimeInput(settings.startDate);
        document.getElementById("changeEndDate").value = formatForDatetimeInput(settings.endDate);
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

    cancelBtn.addEventListener("click", () => initSettingsSection(userRole, settings, groupId));
}
