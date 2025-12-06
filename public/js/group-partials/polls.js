// load poll list

export async function loadPolls(groupId) {
    window.CURRENT_GROUP_ID = groupId;
    try {
        const res = await fetch(`/group/${groupId}/polls`);
        const data = await res.json();

        const polls = data.polls || [];
        const currentUserRole = data.userRole;
        const allowMemberPoll = data.allowMemberPoll;

        const createBtn = document.getElementById("createPollButton");
        createBtn.hidden = !(currentUserRole === "admin" || (currentUserRole === "member" && allowMemberPoll));

        const pollList = document.getElementById("pollList");

        if (!polls.length) {
            pollList.innerHTML = `<li class="list-group-item text-muted">None</li>`;
            return;
        }

        pollList.innerHTML = polls
            .map(poll => {
                const endTime = poll.end_time ? new Date(poll.end_time) : null;
                const now = new Date();
                const ended = endTime && endTime <= now;

                return `
                    <li 
                        class="list-group-item poll-item" 
                        style="cursor:pointer"
                        data-poll-id="${poll.poll_id}"
                    >
                        ${poll.title}
                        <small class="text-muted">
                            Creator: ${poll.creator_name}
                            ${endTime ? ` | Ends: ${endTime.toLocaleString()}` : ""}
                            ${ended ? ` | <strong>Poll ended!</strong>` : ""}
                        </small>
                    </li>
                `;
            })
            .join("");

        pollList.querySelectorAll(".poll-item").forEach(li => {
            li.addEventListener("click", () => {
                const pollId = Number(li.dataset.pollId);
                openPollModal(groupId, pollId); 
            });
        });

    } catch (err) {
        console.error("Error loading polls:", err);
    }
}


// open poll

async function openPollModal(groupId, pollId) {
    try {
        const res = await fetch(`/group/${groupId}/polls`);
        const data = await res.json();

        const pollModalDataRaw = data.modalData[pollId];
        const pollInfo = data.polls.find(p => p.poll_id === pollId);

        if (!pollModalDataRaw || !pollInfo) {
            console.error("Poll data not found for pollId:", pollId);
            return;
        }

        setupGroupPollModal(data.userRole, pollId, { 
            ...pollModalDataRaw, 
            title: pollInfo.title, 
            end_time: pollInfo.end_time 
        });
    } catch (err) {
        console.error("Error fetching poll data:", err);
    }
}


// poll modal

function setupGroupPollModal(userRole, pollId, pollModalData) {
    const modalEl = document.getElementById("pollModal");
    const div = document.getElementById("pollDetails");

    const options = pollModalData.pollData;
    const allowMulti = pollModalData.allow_multiple === 1;
    const canVote = userRole !== "viewer";
    const userVotes = pollModalData.userVotes || [];

    modalEl.querySelector(".modal-title").textContent = pollModalData.title || "Poll";

    div.innerHTML = options.map(option => {
        const hasVoted = userVotes.includes(option.option_id);
        return `
            <div class="poll-option-wrapper" style="position: relative; margin-bottom: 10px;">
                <div class="poll-option ${hasVoted ? 'voted' : ''}" data-option-id="${option.option_id}" style="display: inline-block; cursor: pointer;">
                    ${option.contents} (<span class="vote-count">${option.vote_count || 0}</span> votes)
                </div>
                <button class="btn btn-sm btn-danger remove-vote-btn" 
                        data-option-id="${option.option_id}" 
                        style="display: ${hasVoted ? 'inline-block' : 'none'}; margin-left: 10px;">
                    Remove Vote
                </button>
            </div>
        `;
    }).join("");

    const endTime = pollModalData.end_time ? new Date(pollModalData.end_time) : null;
    const now = new Date();
    const ended = endTime && endTime <= now;

    const optionWrappers = div.querySelectorAll(".poll-option-wrapper");

    let winningOptionId = null;
    if (ended) {
        winningOptionId = options.reduce((maxId, opt) => {
            if (!maxId || (opt.vote_count || 0) > (options.find(o => o.option_id === maxId)?.vote_count || 0)) {
                return opt.option_id;
            }
            return maxId;
        }, null);
    }

    optionWrappers.forEach(wrapper => {
        const optionDiv = wrapper.querySelector(".poll-option");
        const removeBtn = wrapper.querySelector(".remove-vote-btn");
        const voteCountEl = optionDiv.querySelector(".vote-count");
        const optionId = Number(optionDiv.dataset.optionId);

        if (optionId === winningOptionId) optionDiv.classList.add("winner"); // this is for css later on

        if (ended) {
            optionDiv.classList.add("disabled");
            removeBtn.style.display = "none";
            return;
        }

        optionDiv.addEventListener("click", async () => {
            if (!canVote) return;
            if (!allowMulti && optionDiv.classList.contains("disabled")) return;
            if (optionDiv.classList.contains("voted")) return;

            await fetch(`/poll/${pollId}/confirmVote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vote: optionId })
            });

            optionDiv.classList.add("voted");
            removeBtn.style.display = "inline-block";

            voteCountEl.textContent = Number(voteCountEl.textContent) + 1;

            if (!userVotes.includes(optionId)) userVotes.push(optionId);

            if (!allowMulti) {
                optionWrappers.forEach(w => {
                    if (w !== wrapper) w.querySelector(".poll-option").classList.add("disabled");
                });
            }
        });

        removeBtn.addEventListener("click", async () => {
            if (!canVote) return;

            await fetch(`/poll/${pollId}/removeVote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vote: optionId })
            });

            optionDiv.classList.remove("voted", "disabled");
            removeBtn.style.display = "none";

            voteCountEl.textContent = Math.max(Number(voteCountEl.textContent) - 1, 0);

            const index = userVotes.indexOf(optionId);
            if (index > -1) userVotes.splice(index, 1);

            if (!allowMulti) {
                optionWrappers.forEach(w => w.querySelector(".poll-option").classList.remove("disabled"));
            }
        });
    });

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}



// create poll

const optionContainer = document.getElementById("pollOptionInputs");
const addOptionBtn = document.getElementById("addPollOptionBtn");
const submitPollBtn = document.getElementById("submitPollCreateBtn");
const noEndTimeCheck = document.getElementById("noEndTimeCheck");
const endTimeInput = document.getElementById("pollEndTimeInput");

let maxOptions = 6;


noEndTimeCheck.addEventListener("change", () => {
    endTimeInput.disabled = noEndTimeCheck.checked;
});


addOptionBtn.addEventListener("click", () => {
    const currentOptions = optionContainer.querySelectorAll(".poll-option").length;

    if (currentOptions >= maxOptions) return;

    const newOptionIndex = currentOptions + 1;

    const div = document.createElement("div");
    div.classList.add("input-group", "mb-2", "poll-option");
    div.innerHTML = `
        <input type="text" class="form-control" placeholder="Option ${newOptionIndex}">
    `;

    optionContainer.appendChild(div);

    if (currentOptions + 1 >= maxOptions) {
        addOptionBtn.disabled = true;
    }
});


submitPollBtn.addEventListener("click", async () => {
    const groupId = window.CURRENT_GROUP_ID;

    const title = document.getElementById("pollTitleInput").value.trim();
    const allowMultiple = document.getElementById("pollAllowMultiple").checked;

    let endTime = endTimeInput.value || null;
    if (noEndTimeCheck.checked) endTime = null;

    const optionInputs = Array.from(
        optionContainer.querySelectorAll(".poll-option input")
    );

    const options = optionInputs
        .map(inp => inp.value.trim())
        .filter(text => text.length > 0);

    if (!title) {
        alert("Poll needs a title.");
        return;
    }

    if (options.length < 2) {
        alert("Poll must have at least 2 options.");
        return;
    }

    try {
        const res = await fetch(`/group/${groupId}/polls/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title,
                allow_multiple: allowMultiple ? 1 : 0,
                end_time: endTime,
                options
            })
        });

        const data = await res.json();

        if (!data.success) {
            alert("Failed to create poll: " + (data.error || "Unknown error"));
            return;
        }

        const modal = bootstrap.Modal.getInstance(
            document.getElementById("createPollModal")
        );
        modal.hide();

        resetPollCreateForm();

        loadPolls(groupId);

    } catch (err) {
        console.error("Error submitting poll:", err);
        alert("Server error creating poll.");
    }
});


function resetPollCreateForm() {
    document.getElementById("pollTitleInput").value = "";
    document.getElementById("pollAllowMultiple").checked = false;

    endTimeInput.value = "";
    endTimeInput.disabled = false;
    noEndTimeCheck.checked = false;

    optionContainer.innerHTML = `
        <label class="form-label">Options</label>

        <div class="input-group mb-2 poll-option">
            <input type="text" class="form-control" placeholder="Option 1">
        </div>

        <div class="input-group mb-2 poll-option">
            <input type="text" class="form-control" placeholder="Option 2">
        </div>
    `;

    addOptionBtn.disabled = false;
}
