document.addEventListener("DOMContentLoaded", async () => {
  await loadGroups();

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

    // Update text + color first
    await fetch("/user/profile", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ displayName: name, bio, bannerColor: color })
    });

    // Upload image if chosen
    if (pic) {
        const formData = new FormData();
        formData.append("profilePicture", pic);

        await fetch("/user/profile-picture", {
            method: "POST",
            body: formData
        });
    }

    // Reload modal data
    loadProfileModal();
}

// Load user data when modal opens
async function loadProfileModal() {
    const res = await fetch("/user/me");
    const user = await res.json();

    // View mode
    document.getElementById("displayName").innerText = user.display_name || user.username;
    document.getElementById("username").innerText = "@" + user.username;
    document.getElementById("bio").innerText = user.bio || "";
    document.getElementById("profileBanner").style.background = user.bannerColor || "#cccccc";

    if (user.profilePicture)
        document.getElementById("profilePicture").src = "/uploads/" + user.profilePicture;

    // Edit mode fields
    document.getElementById("editDisplayName").value = user.display_name || "";
    document.getElementById("editBio").value = user.bio || "";
    document.getElementById("editBannerColor").value = user.bannerColor || "#cccccc";

    // Reset edit mode view
    cancelProfileEdit();
}

// Attach event listener to modal
document.getElementById("profilePageModal").addEventListener("show.bs.modal", loadProfileModal);
