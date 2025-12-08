// --- Load Members ---
export async function loadMembers(groupId) {
    try {
        const res = await fetch(`/group/${groupId}/members`);
        const data = await res.json();

        const members = data.members;
        const currentUserRole = data.userRole;

        const manageBtns = document.getElementById("manageBtns");
        manageBtns.hidden = currentUserRole !== "admin";

        const admins = members.filter(m => m.role === "admin");
        const regulars = members.filter(m => m.role === "member");
        const viewers = members.filter(m => m.role === "viewer");

        const createList = (list, users) => {
            list.innerHTML = ""; // clear old items

            if (!users.length) {
                const li = document.createElement("li");
                li.className = "list-group-item text-muted";
                li.textContent = "None";
                list.appendChild(li);
                return;
            }

            users.forEach(u => {
                const li = document.createElement("li");
                li.className = "list-group-item";

                const span = document.createElement("span");
                span.textContent = u.username;
                span.style.cursor = "pointer";
                span.addEventListener("click", () => loadOtherProfile(u.id));

                li.appendChild(span);
                list.appendChild(li);
            });
        };

        createList(document.getElementById("adminList"), admins);
        createList(document.getElementById("memberList"), regulars);
        createList(document.getElementById("viewerList"), viewers);

        setupManageRolesModal(members, groupId);
        setupManageMembersModal(members, groupId);

    } catch (err) {
        console.error("Error loading members:", err);
    }
}

// --- Manage Roles Modal ---

function setupManageRolesModal(members, groupId) {
    const modalEl = document.getElementById("manageRolesModal");
    const modal = new bootstrap.Modal(modalEl);

    const memberSelect = document.createElement("select");
    memberSelect.multiple = true;
    memberSelect.id = "roleMemberSelect";
    memberSelect.className = "form-select mb-2";

    const roleSelect = document.createElement("select");
    roleSelect.id = "roleAssignSelect";
    roleSelect.className = "form-select mb-2";
    ["admin","member","viewer"].forEach(role => {
        const opt = document.createElement("option");
        opt.value = role;
        opt.textContent = role.charAt(0).toUpperCase() + role.slice(1);
        roleSelect.appendChild(opt);
    });

    const modalBody = modalEl.querySelector(".modal-body");
    modalBody.innerHTML = "";
    modalBody.appendChild(memberSelect);
    modalBody.appendChild(roleSelect);

    members.forEach(m => {
        const option = document.createElement("option");
        option.value = m.username;
        option.textContent = `${m.username} (${m.role})`;
        memberSelect.appendChild(option);
    });

    memberSelect.addEventListener("change", () => {
        const selected = members.find(m => m.username === memberSelect.value);
        if (selected) roleSelect.value = selected.role;
    });

    // --- Save Role Changes ---
    const saveBtn = modalEl.querySelector(".btn-success");
    saveBtn.onclick = async () => {
        const username = memberSelect.value;
        const newRole = roleSelect.value;

        try {
            const res = await fetch(`/group/${groupId}/change-role`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, newRole })
            });
            const data = await res.json();
            if (data.success) {
                modal.hide();
                loadMembers(groupId);
            } else {
                alert(data.error || "Failed to change role");
            }
        } catch (err) {
            console.error(err);
            alert("Error changing role");
        }
    };

    document.getElementById("manageRoles").onclick = () => {
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        modal.show();
    };

}

// --- Manage Members Modal ---

/* 
    NOTE: must add a check so that I don't remove myself from the group, and so that there remains at least one person (myself) on the group
*/

function setupManageMembersModal(members, groupId) {
    const modalEl = document.getElementById("manageMembersModal");
    const modal = new bootstrap.Modal(modalEl);

    const selectEl = document.createElement("select");
    selectEl.id = "membersSelect";
    selectEl.className = "form-select";
    selectEl.multiple = true;

    members.forEach(m => {
        const option = document.createElement("option");
        option.value = m.username;
        option.textContent = `${m.username} (${m.role})`;
        selectEl.appendChild(option);
    });

    const modalBody = modalEl.querySelector(".modal-body");
    modalBody.innerHTML = "";
    modalBody.appendChild(selectEl);

    const removeBtn = modalEl.querySelector(".btn-primary");
    removeBtn.onclick = async () => {
        const selected = Array.from(selectEl.selectedOptions).map(opt => opt.value);
        // if (!selected.length) return alert("Select at least one member");

        try {
            const res = await fetch(`/group/${groupId}/remove-members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usernames: selected })
            });
            const data = await res.json();
            if (data.success) {
                modal.hide();
                loadMembers(groupId); 
            } else {
                alert(data.error || "Failed to remove members");
            }
        } catch (err) {
            console.error(err);
            alert("Error removing members");
        }
    };

    document.getElementById("manageMembers").onclick = () => {
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        modal.show();
    };
}

// it sometimes doesnt close properly??? this is just an extra precaution cause im tired of it
window.addEventListener("hidden.bs.modal", () => {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
});

async function loadOtherProfile(userId) {
    try {
        const res = await fetch(`/user/profile/${userId}`);
        if (!res.ok) throw new Error("User not found");

        const user = await res.json();

        document.getElementById("displayName").innerText = user.display_name || user.username;
        document.getElementById("username").innerText = "@" + user.username;
        document.getElementById("bio").innerText = user.bio || "";
        document.getElementById("profileBanner").style.background = user.bannerColor || "#cccccc";
        document.getElementById("profilePicture").src = user.profilePicture ? "/uploads/" + user.profilePicture : "/uploads/default.png";

        const friendBtnContainer = document.getElementById("friendActionContainer");
        friendBtnContainer.innerHTML = ""; // reset

        const friendsRes = await fetch("/user/friends");
        const friendsData = await friendsRes.json();
        const isFriend = friendsData.friends.some(f => f.id === user.id);

        if (isFriend) {
            const unfriendBtn = document.createElement("button");
            unfriendBtn.className = "btn btn-danger";
            unfriendBtn.textContent = "UNFRIEND";
            unfriendBtn.onclick = async () => {
                if (!confirm(`Are you sure you want to unfriend ${user.display_name || user.username}?`)) return;

                try {
                    const res = await fetch("/user/unfriend", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ friendId: user.id })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert("Friendship removed.");
                        friendBtnContainer.innerHTML = "";
                    } else {
                        alert("Error: " + (data.error || "Failed to unfriend."));
                    }
                } catch (err) {
                    console.error(err);
                    alert("Failed to unfriend.");
                }
            };
            friendBtnContainer.appendChild(unfriendBtn);
        }

        const modalEl = document.getElementById("profilePageModal");
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();

    } catch (err) {
        console.error("Failed to load user profile:", err);
        alert("Failed to load user profile.");
    }
}