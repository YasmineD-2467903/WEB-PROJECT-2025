export async function loadMembers(groupId) {
    const membersRes = await fetch(`/group/${groupId}/members`);
    const members = await membersRes.json();

    const admins = members.filter(m => m.role === "admin");
    const regulars = members.filter(m => m.role === "member");
    const viewers = members.filter(m => m.role === "viewer");

    const createList = (list, users) => {
        list.innerHTML = users.length
            ? users.map(u => `<li class="list-group-item">${u.username}</li>`).join("")
            : `<li class="list-group-item text-muted">None</li>`;
    };

    createList(document.getElementById("adminList"), admins);
    createList(document.getElementById("memberList"), regulars);
    createList(document.getElementById("viewerList"), viewers);
}
