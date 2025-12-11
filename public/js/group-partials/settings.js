export function initSettingsSection(userRole, settings, groupId) {
    setupVisibility(userRole);

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

function setupVisibility(userRole) {
    if (userRole !== "admin") {
        // Disable buttons (gestolen van https://www.webdevtutor.net/blog/javascript-button-click-by-class)
        const forms = document.querySelectorAll(".form-control")
        forms.forEach(form => {
            form.disable = true
            form.style.opacity = "0.7"; //change the opacity of it to indicate u cant click
            form.style.cursor = "not-allowed";
            console.log("-- Disabled buttons in settings");

            form.addEventListener("click", () => {
                alert("Only admin can change settings! Ask for a role swap or forever hold your peace...");
            })
        })

        //Disable checkboxes (based on forms lol)
        const checkboxes = document.querySelectorAll(".form-check-input")
        checkboxes.forEach(checkbox => {
            checkbox.disabled = true;
            checkbox.style.opacity = "0.7"; //change the opacity of it to indicate u cant click
            console.log("-- Disabled checkboxes in settings");
        })

        //Not-allowed cursor doesn't add on the checkboxes so  we add on top of labels for the  same effect as the above
        const labels = document.querySelectorAll(".form-check-label");
        labels.forEach(label => {
            label.style.cursor = "not-allowed"
            console.log("-- stupid cursor for checkboxes xd");

            label.addEventListener("click", () => {
                alert("Only admin can change settings! Ask for a role swap or forever hold your peace...");
            })
        })
    }
}