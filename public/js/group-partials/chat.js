let socket;
let listenersAttached = false;

// TODO: add check for group settings, to see if viewers are allowed to use chat, according to that -> make input field hidden or not

export async function initChat(groupId) {
    try {
        // fetch current user info
        const res = await fetch(`/user/me`);
        if (!res.ok) throw new Error("Failed to fetch user info");
        const user = await res.json();

        // now initialize socket with user info
        setupSocket(groupId, user.id, user.display_name);
    } catch (err) {
        console.error("Error fetching current user:", err);
    }
}

function setupSocket(groupId, userId, displayName) {
    if (!socket) socket = io();

    // join room + load messages
    socket.emit("joinGroupChat", groupId);
    socket.emit("loadChatHistory", groupId);

    const messagesDiv = document.getElementById("chatMessages");
    const input = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendChatBtn");

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
        <strong>${escapeHtml(msg.display_name)}</strong><br>
        <span>${escapeHtml(msg.contents)}</span>
        <div class="text-muted small">
            ${new Date(msg.timestamp).toLocaleString()}
        </div>
    `;

    messagesDiv.appendChild(msgDiv);
}

function scrollBottom() {
    const messagesDiv = document.getElementById("chatMessages");
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
