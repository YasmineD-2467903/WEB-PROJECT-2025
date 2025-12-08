let socket;
let listenersAttached = false;

// TODO: add check for group settings, to see if viewers are allowed to use chat, according to that -> make input field hidden or not

export async function initChat(groupId) {
    try {
        // fetch current user info
        const res1 = await fetch(`/user/me`);
        if (!res1.ok) throw new Error("Failed to fetch user info");
        const user = await res1.json();

        // fetch group settings info
        const res2 = await fetch(`/group/${groupId}/settings`);
        if (!res2.ok) throw new Error("Failed to fetch settings info");
        const settings = await res2.json();

        // init socket with user info & settings
        setupSocket(groupId, settings, user.id, user.display_name);
    } catch (err) {
        console.error("Error fetching current user:", err);
    }
}

function setupSocket(groupId, groupSettings, userId, displayName) {
    if (!socket) socket = io();

    // join room + load messages
    socket.emit("joinGroupChat", groupId);
    socket.emit("loadChatHistory", groupId);

    const messagesDiv = document.getElementById("chatMessages");
    const input = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendChatBtn");

    if ((groupSettings.role == "viewer") && (groupSettings.settings.allowViewerChat == 0)) { 
        input.hidden = true;
        sendBtn.hidden = true;
    }

    if (!listenersAttached) {
        socket.on("chatHistory", (messages) => {
            messagesDiv.innerHTML = "";
            messages.forEach(renderMessage);
            scrollBottom();
        });

        socket.on("newMessage", (msg) => {
            renderMessage(msg);
            scrollBottom();
        });

        listenersAttached = true;
    }

    sendBtn.onclick = () => sendMessage(groupId, userId);
    input.onkeydown = (e) => {
        if (e.key === "Enter") sendMessage(groupId, userId);
    };
}

function sendMessage(groupId, userId) {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;

    socket.emit("sendMessage", {
        groupId,
        userId,
        text
    });

    input.value = "";
}

function renderMessage(msg) {
    const messagesDiv = document.getElementById("chatMessages");

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("mb-2");

    msgDiv.innerHTML = `
        <strong>${createInnerHtml(msg.display_name)} ${new Date(msg.timestamp).toLocaleString()}</strong><br>
        <span>${createInnerHtml(msg.contents)}</span>
    `;

    messagesDiv.appendChild(msgDiv);
}

function scrollBottom() {
    const messagesDiv = document.getElementById("chatMessages");
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function createInnerHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
