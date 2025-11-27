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
        // Update DOM
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
    const groups = await response.json();

    container.innerHTML = "";

    if (!groups || groups.length === 0) {
      container.innerHTML = `<p class="text-center text-muted">You’re not in any groups yet!</p>`;
      return;
    }

    for (const group of groups) {
      const div = document.createElement("div");
      div.className = "col-md-4";
      div.innerHTML = `
        <div class="card h-100 border-0">
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