document.addEventListener("DOMContentLoaded", async () => {
  await loadGroups();});

async function loadGroups() {
  const container = document.getElementById("groupList");
  if (!container) return;

  try {
    const res = await fetch("/groups");
    if (!res.ok) throw new Error("Failed to fetch groups");
    const groups = await res.json();

    container.innerHTML = "";

    if (!groups || groups.length === 0) {
      container.innerHTML = `<p class="text-center text-muted">You’re not in any groups yet!</p>`;
      return;
    }

    for (const group of groups) {
      const div = document.createElement("div");
      div.className = "col-md-4";
      div.innerHTML = `
        <div class="card shadow-sm h-100 border-0">
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