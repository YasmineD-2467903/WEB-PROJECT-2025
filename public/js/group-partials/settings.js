// --- Load settings ---
export async function loadSettings(groupId) {
    try {
        const res = await fetch(`/group/${groupId}/settings`);
        const data = await res.json();

        const userRole = data.role
        console.log(userRole);
        setupSettings(userRole);

    } catch (err) {
        console.error("Error loading settings:", err);
    }
}


// --- Setup settings based on role (if non-admin -> disable!) ---
function setupSettings(userRole) {
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