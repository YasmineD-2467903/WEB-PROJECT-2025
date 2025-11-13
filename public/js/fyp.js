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