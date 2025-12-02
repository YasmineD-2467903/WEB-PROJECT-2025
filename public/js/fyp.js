document.addEventListener("DOMContentLoaded", async () => {
  await loadGroups();
  await loadFriends();

  const container = document.getElementById("groupList");
  container.addEventListener("click", (event) => {
    if (event.target.classList.contains("open-group")) {
      const groupId = event.target.dataset.id;
      window.location.href = `/group?id=${groupId}`;
      // ` ` interpolates, " " will literally take the string...
      // this sends the group id as a variable to be used
    }
  })
});

document.addEventListener("DOMContentLoaded", () => {
    const createBtn = document.querySelector("#createGroupModal .btn-success");

    createBtn.addEventListener("click", handleGroupCreate);
});

function handleGroupCreate() {

    const modal = document.getElementById("createGroupModal");
    const inputs = modal.querySelectorAll("input");

    const groupName = inputs[0].value.trim();
    const description = inputs[1].value.trim();
    const startDate = inputs[2].value;
    const endDate = inputs[3].value;

    const groupData = {
        name: groupName,
        description: description,
        startDate: startDate,
        endDate: endDate
    };

    console.log("Creating group:", groupData);

    fetch("/createGroup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupData)
    })
    .then(res => res.json())
    .then(data => {
        loadGroups();
    });

    const bsModal = bootstrap.Modal.getInstance(modal);
    bsModal.hide();

    inputs.forEach(i => (i.value = ""));
}

async function loadGroups() {
  const container = document.getElementById("groupList");
  if (!container) return;

  try {
    const response = await fetch("/groups");
    if (!response.ok) throw new Error("Failed to fetch groups");

    const data = await response.json();
    const groups = data.groups;
    const roles = data.roles; // { groupId: role }

    container.innerHTML = "";

    if (!groups || groups.length === 0) {
      container.innerHTML = `<p class="text-center text-muted">You’re not in any groups yet!</p>`;
      return;
    }

    for (const group of groups) {
      const userRole = roles[group.id];

      const div = document.createElement("div");
      div.className = "col-md-4";
      div.innerHTML = `
        <div class="card h-100 border-0 position-relative">
          <button 
            class="btn-close position-absolute top-0 end-0 m-2"
            onclick="handleGroupDelete(${group.id}, '${userRole}')">
          </button>

          <div class="card-body text-center">
            <h5 class="card-title">${group.name}</h5>
            <p class="text-muted">${group.description || "No description."}</p>
            <button class="btn btn-outline-primary w-100" onclick="openGroup(${group.id})">Open</button>
          </div>
        </div>`;
      container.appendChild(div);
    }

  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="text-danger text-center">Error loading groups.</p>`;
  }
}

function openGroup(groupId) {
  window.location.href = `/group?id=${groupId}`;
}

function handleGroupDelete(groupId, userRole) {

  if (userRole === "admin") {
    const confirmDelete = confirm("You are an admin. Do you want to DELETE this group?");
    if (!confirmDelete) return;
  } else {
    const confirmLeave = confirm("You are not an admin. Do you want to LEAVE this group?");
    if (!confirmLeave) return;
  }

  fetch("/deleteGroup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId })
  })
  .then(res => res.json())
  .then(() => loadGroups());
}

function enableProfileEdit() {
    document.getElementById("profileViewMode").classList.add("d-none");
    document.getElementById("profileEditMode").classList.remove("d-none");
}

function cancelProfileEdit() {
    document.getElementById("profileEditMode").classList.add("d-none");
    document.getElementById("profileViewMode").classList.remove("d-none");
}

async function saveProfileChanges() {
    const name = document.getElementById("editDisplayName").value;
    const bio = document.getElementById("editBio").value;
    const color = document.getElementById("editBannerColor").value;
    const pic = document.getElementById("editProfilePic").files[0];

    await fetch("/user/profile", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ displayName: name, bio, bannerColor: color })
    });

    if (pic) {
        const formData = new FormData();
        formData.append("profilePicture", pic);

        await fetch("/user/profile-picture", {
            method: "POST",
            body: formData
        });
    }

    loadProfileModal();
}

async function loadProfileModal() {
    const res = await fetch("/user/me");
    const user = await res.json();

    document.getElementById("displayName").innerText = user.display_name || user.username;
    document.getElementById("username").innerText = "@" + user.username;
    document.getElementById("bio").innerText = user.bio || "";
    document.getElementById("profileBanner").style.background = user.bannerColor || "#cccccc";

    if (user.profilePicture)
        document.getElementById("profilePicture").src = "/uploads/" + user.profilePicture;

    document.getElementById("editDisplayName").value = user.display_name || "";
    document.getElementById("editBio").value = user.bio || "";
    document.getElementById("editBannerColor").value = user.bannerColor || "#cccccc";

    cancelProfileEdit();
}

document.getElementById("profilePageModal").addEventListener("show.bs.modal", loadProfileModal);

async function loadFriends() {
  await loadFriendCode();
  await loadConfirmedFriends();
}

async function loadFriendCode() {
  try {
    const res = await fetch("/user/friend-code");
    const data = await res.json();
    document.getElementById("userFriendCode").value = data.friend_code || "XXXX-XXXX-XXXX";
  } catch (err) {
    console.error(err);
    document.getElementById("userFriendCode").value = "XXXX-XXXX-XXXX";
  }
}

async function loadConfirmedFriends() {
    const container = document.getElementById("friendsList");
    container.innerHTML = "<p class='text-muted'>Loading friends...</p>";

    try {
        const res = await fetch("/user/friends");
        const data = await res.json();
        container.innerHTML = "";

        if (!data.friends || data.friends.length === 0) {
            container.innerHTML = "<p class='text-center text-muted'>No friends yet.</p>";
            return;
        }

        data.friends.forEach(f => {
            const div = document.createElement("div");
            div.className = "friend-item";
            div.textContent = f.display_name || f.username;
            div.style.cursor = "pointer";

            div.addEventListener("click", () => {
                const friendsModalEl = document.getElementById("friendsPageModal");
                const friendsModal = bootstrap.Modal.getInstance(friendsModalEl);
                if (friendsModal) friendsModal.hide();  // close friends modal

                loadOtherProfile(f.id); // open friend profile
            });

            container.appendChild(div);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = "<p class='text-danger text-center'>Error loading friends.</p>";
    }
}

async function loadOtherProfile(userId) {
    try {
        const res = await fetch(`/user/profile/${userId}`);
        if (!res.ok) throw new Error("User not found");
        const user = await res.json();

        const modalEl = document.getElementById("profilePageModal");
        // temp remove your own show.bs.modal listener
        modalEl.removeEventListener("show.bs.modal", loadProfileModal);

        document.getElementById("displayName").innerText = user.display_name || user.username;
        document.getElementById("username").innerText = "@" + user.username;
        document.getElementById("bio").innerText = user.bio || "";
        document.getElementById("profileBanner").style.background = user.bannerColor || "#cccccc";

        document.getElementById("profilePicture").src = user.profilePicture ? "/uploads/" + user.profilePicture : "/uploads/default.png";

        document.getElementById("profileEditMode").classList.add("d-none");
        document.getElementById("profileViewMode").classList.remove("d-none");

        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();

        // restore the original listener 
        setTimeout(() => {
            modalEl.addEventListener("show.bs.modal", loadProfileModal);
        }, 100);
    } catch (err) {
        console.error(err);
        alert("Failed to load user profile.");
    }
}

async function handleAddFriend() {
    const usernameInput = document.getElementById("addFriendUsername").value.trim();
    const codeInput = document.getElementById("addFriendCode").value.trim();

    if (!usernameInput || !codeInput) return alert("Enter both username and friend code.");

    try {
        const res = await fetch("/user/add-friend", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ username: usernameInput, friend_code: codeInput })
        });
        const data = await res.json();

        alert(data.message || "Friend request sent!");
        await loadFriends();

    } catch (err) {
        console.error(err);
        alert("Failed to send friend request.");
    }

    document.getElementById("addFriendUsername").value = "";
    document.getElementById("addFriendCode").value = "";
}

function copyFriendCode() {
    const input = document.getElementById("userFriendCode");
    input.select();
    input.setSelectionRange(0, 99999); // for mobile
    document.execCommand("copy");
    alert("Friend code copied!");
}

async function loadGroupInvites() {
    const list = document.getElementById("groupInviteList");
    list.innerHTML = "<p class='text-muted'>Loading...</p>";

    const res = await fetch("/groups/invites");
    const data = await res.json();

    list.innerHTML = "";

    if (!data.invites.length) {
        list.innerHTML = "<p class='text-muted text-center'>No invites.</p>";
        return;
    }

    data.invites.forEach(inv => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.innerHTML = `
            <div>
                <strong>${inv.group_name}</strong><br>
                Invited by: ${inv.inviter_name}<br>
                Role: <span class="text-capitalize">${inv.role}</span>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-success btn-sm" onclick="acceptInvite(${inv.id})">Accept</button>
                <button class="btn btn-danger btn-sm" onclick="declineInvite(${inv.id})">Decline</button>
            </div>
        `;
        list.appendChild(li);
    });
}

document.getElementById("groupInvitesModal")
    .addEventListener("show.bs.modal", loadGroupInvites);

async function acceptInvite(id) {
    await fetch(`/groups/accept-invite/${id}`, { method: "POST" });
    loadGroupInvites();
    loadGroups();
}

async function declineInvite(id) {
    await fetch(`/groups/decline-invite/${id}`, { method: "POST" });
    loadGroupInvites();
}

document.getElementById("inviteFriendModal").addEventListener("show.bs.modal", loadInviteModal);

async function loadInviteModal() {
    loadInviteFriends();
    loadInviteGroups();
    loadInviteRoles();
}

async function loadInviteFriends() {
    const select = document.getElementById("inviteFriendSelect");
    select.innerHTML = "";

    const res = await fetch("/user/friends");
    const data = await res.json();

    if (!data.friends || data.friends.length === 0) {
        select.innerHTML = `<option disabled>No friends available</option>`;
        return;
    }

    data.friends.forEach(friend => {
        const opt = document.createElement("option");
        opt.value = friend.id;
        opt.textContent = friend.username;
        select.appendChild(opt);
    });
}

async function loadInviteGroups() {
    const select = document.getElementById("inviteGroupSelect");
    select.innerHTML = "";

    const res = await fetch("/groups");
    const data = await res.json();

    select.innerHTML = "";

    if (!data.groups || data.groups.length === 0) {
        select.innerHTML = `<option disabled>No groups available</option>`;
        return;
    }

    data.groups.forEach(group => {
        const role = data.roles[group.id]; // ← use your backend role map

        if (role === "admin") {
            const opt = document.createElement("option");
            opt.value = group.id;
            opt.textContent = group.name;
            select.appendChild(opt);
        }
    });
}

function loadInviteRoles() {
    const select = document.getElementById("inviteRoleSelect");
    select.innerHTML = `
        <option value="viewer">Viewer</option>
        <option value="member">Member</option>
        <option value="admin">Admin</option>
    `;
}

async function inviteFriend() {
    const friendId = document.getElementById("inviteFriendSelect").value;
    const groupId = document.getElementById("inviteGroupSelect").value;
    const role = document.getElementById("inviteRoleSelect").value;

    if (!friendId || !groupId || !role) {
        alert("Please select a friend, group, and role.");
        return;
    }

    const res = await fetch("/user/invite-to-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, groupId, role })
    });

    const data = await res.json();

    if (data.error) {
        alert("Error: " + data.error);
        return;
    }

    alert("Invite sent!");
}

async function confirmInviteFriend() {
    const friendId = document.getElementById("inviteFriendSelect").value;
    const groupId = document.getElementById("inviteGroupSelect").value;
    const role = document.getElementById("inviteRoleSelect").value;

    if (!friendId || !groupId || !role) {
        alert("Please select friend, group, and role.");
        return;
    }

    const res = await fetch("/user/invite-to-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, groupId, role })
    });

    const data = await res.json();

    if (data.error) {
        alert("Error: " + data.error);
        return;
    }

    alert("Invite sent!");
}
