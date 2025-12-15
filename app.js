import express from "express";
import session from "express-session";
import { db, InitializeDatabase } from "./db.js";
import multer from "multer";
import path from "path";
import http from "http";
import { Server } from "socket.io";

import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/");
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `user_${req.session.user_id}${ext}`);
    }
});

const stopStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/stops/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `stop_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, unique);
  }
});

const uploadStopFiles = multer({ storage: stopStorage });

const upload = multer({ storage });
const app = express();

const port = process.env.PORT || 8080; // Set by Docker Entrypoint or use 8080

InitializeDatabase();

// friend code generator function
// TODO FAIRLY certain this should NOT be here, but I have yet to fix it
function generateFriendCode() {
    const segment = () =>
        Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${segment()}-${segment()}-${segment()}`;
    }

    function createUniqueFriendCode() {
    let code;
    let exists;

    do {
        code = generateFriendCode();
        exists = db.prepare("SELECT id FROM users WHERE friend_code = ?").get(code);
    } while (exists);

    return code;
}

app.use(session({
    secret: "IGyUVFukVUKvKVuukivIUVuyVoF9PGFG86FVI", // super duper secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// set the view engine to ejs
app.set("view engine", "ejs");

// process.env.DEPLOYMENT is set by Docker Entrypoint
if (!process.env.DEPLOYMENT) {
    console.info("Development mode");
    // Serve static files from the "public" directory
    app.use(express.static("public"));
}

// Middleware for serving static files
app.use(express.static("public"));

// Middleware for parsing JSON bodies
app.use(express.json());

// Middleware for debug logging
app.use((req, res, next) => {
    console.log(
        `req URL: ${req.url} @ ${new Date().toLocaleString("nl-BE")}`
    );
    
    next();
});


// Your routes here ...

// ========================== ALL GET ROUTES ==========================


// automatically open login page
app.get("/", (req, res) => {
    res.redirect("/login");
});

// login page
app.get("/login", (req, res) => { 
    res.render("pages/login/login");
});

// register page
app.get("/register", (req, res) => {
    res.render("pages/register/register");
});

// fyp
app.get("/fyp", (req, res) => {
    res.render("pages/fyp/fyp");
});

// finds your own friend code to display on friends page (part of fyp)
app.get("/user/friend-code", (req, res) => {
    const userId = req.session.user_id;
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const user = db.prepare("SELECT friend_code FROM users WHERE id = ?").get(userId);
    res.json({ friend_code: user.friend_code });
});

// friends list on friends page (part of fyp)
app.get("/user/friends", (req, res) => {
    const userId = req.session.user_id;
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const friends = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.friend_code
        FROM users u
        WHERE u.id IN (
        SELECT r1.requested_id
        FROM friend_requests r1
        JOIN friend_requests r2
            ON r1.requester_id = r2.requested_id AND r1.requested_id = r2.requester_id
        WHERE r1.requester_id = ?
        )
    `).all(userId);

    res.json({ friends });
});

// profile page
app.get("/user/me", (req, res) => {
    const userId = req.session.user_id;
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const user = db.prepare(`
        SELECT id, username, display_name, bio, bannerColor, profilePicture
        FROM users
        WHERE id = ?
    `).get(userId);

    res.json(user);
});

// other persons profile (friend or not) 
// actually also used to load your own profile, but in a view-only manner, so you don't get the edit button showed
app.get("/user/profile/:id", async (req, res) => {
    const userId = req.params.id;

    try {
        const user = db.prepare(`
            SELECT id, username, display_name, bio, bannerColor, profilePicture
            FROM users
            WHERE id = ?
        `).get(userId);

        if (!user) return res.status(404).json({ error: "User not found" });

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// load group invites
app.get("/groups/invites", (req, res) => {
    const userId = req.session.user_id;

    try {
        const invites = db.prepare(`
            SELECT i.id, g.name AS group_name, u.username AS inviter_name, i.role
            FROM invites i
            JOIN groups g ON g.id = i.group_id
            JOIN users u ON u.id = i.inviter_id
            WHERE i.invited_id = ?
        `).all(userId);

        res.json({ invites });
    } catch (err) {
        console.error("ERROR in /groups/invites:", err);
        res.status(500).json({ error: "Server failed to load invites" });
    }
});

// list of groups you are in
app.get("/groups", (req, res) => {
    try {
        const userId = req.session.user_id;
        if (!userId) return res.status(401).json({ error: "Not logged in" });

        const groups = db.prepare(`
            SELECT g.id, g.name, g.description, gm.role, g.allowMemberInvite
            FROM groups g
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.user_id = ?
        `).all(userId);

        const roles = {};
        const allowInvite = {};
        for (const g of groups) {
            roles[g.id] = g.role;
            allowInvite[g.id] = g.allowMemberInvite === 1;
            delete g.role;
            delete g.allowMemberInvite;
        }

        res.json({ groups, roles, allowInvite });

    } catch (err) {
        console.error("Error fetching groups:", err);
        res.status(500).json({ error: "Failed to load groups" });
    }
});

// group page setup
app.get("/group", (req, res) => {
    const groupId = req.query.id;
    if (!groupId) return res.status(400).send("Group ID missing");
    res.render("pages/group/group", { groupId });
});

// group page with data
app.get("/group/:id", (req, res) => {
    try {
        const groupId = req.params.id;

        console.log(`Fetching data for group ${groupId}`);

        const stmt = db.prepare("SELECT id, name, description, startDate, endDate FROM groups WHERE id = ?");
        const group = stmt.get(groupId);

        if (!group) {
        console.log(`Group ${groupId} not found`);
        return res.status(404).json({ error: "Group not found" });
        }

        res.json(group);
    } catch (err) {
        console.error("Error fetching group:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// dynamically load group page sections
app.get("/group/:id/section/:section", (req, res) => {
    const { id, section } = req.params;
    const validSections = ["members", "settings", "chat", "map", "polls"];
    if (!validSections.includes(section)) return res.status(404).send("Invalid section");
    res.render(`partials/group-${section}.ejs`, { groupId: id });
});

// member list within a group
app.get("/group/:id/members", (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.session.user_id;

        const members = db.prepare(`
            SELECT u.id, u.username, gm.role
            FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?
        `).all(groupId);

        const checkRole = db
        .prepare("SELECT role FROM group_members WHERE user_id = ? AND group_id = ?")
        .get(userId, groupId);

        const userRole = checkRole.role;

        res.json({ members, userRole });
    } catch (err) {
        console.error("Error fetching group members:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// get group settings
app.get("/group/:id/settings", (request, response) => {
    try {
        const userId = request.session.user_id; //userId nodig om de user te identifyen
        if (!userId) return response.status(401).json({ error: "Not logged in" });

        const groupId = request.params.id; //groupId nodig om bepaalde groep te identifyen

        const userRole = db.prepare(`
            SELECT role
            FROM group_members
            WHERE user_id = ? AND group_id = ?
        `).get(userId, groupId);

        const groupSettings = db.prepare(`
            SELECT name, description, startDate, endDate, allowMemberInvite, allowMemberPoll, allowViewerChat
            FROM groups
            WHERE id = ?    
        `).get(groupId);

        return response.json({
            userId: userId,
            role: userRole.role,
            settings: groupSettings
        });

    } catch (err) {
        console.error("Error fetching role of user:", err);
        response.status(500).json({ error: "Internal server error" });
    }
});

// polls within a group
app.get("/group/:id/polls", (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.session.user_id;

        const pollsRaw = db.prepare(`
            SELECT poll_id, creator_id, title, allow_multiple, end_time
            FROM group_polls
            WHERE group_id = ?
        `).all(groupId);

        const polls = pollsRaw.map(poll => {
            const creator = db
                .prepare("SELECT display_name FROM users WHERE id = ?")
                .get(poll.creator_id);
            return {
                ...poll,
                creator_name: creator ? creator.display_name : "Unknown"
            };
        });

        const checkRole = db
            .prepare("SELECT role FROM group_members WHERE user_id = ? AND group_id = ?")
            .get(userId, groupId);
        const userRole = checkRole ? checkRole.role : "viewer";

        const allowMemberPollRow = db
            .prepare("SELECT allowMemberPoll FROM groups WHERE id = ?")
            .get(groupId);
        const allowMemberPoll = allowMemberPollRow ? !!allowMemberPollRow.allowMemberPoll : false;

        const modalData = {};
        
        for (const poll of polls) {
            const pollId = poll.poll_id;

            const pollOptions = db
                .prepare("SELECT option_id, contents, vote_count FROM poll_options WHERE poll_id = ?")
                .all(pollId);

            const userVotesRows = db
                .prepare("SELECT option_id FROM poll_votes WHERE poll_id = ? AND voter_id = ?")
                .all(pollId, userId);
            const userVotes = userVotesRows.map(v => v.option_id);

            modalData[pollId] = {
                pollData: pollOptions,
                allow_multiple: poll.allow_multiple,
                title: poll.title,
                userVotes,
                end_time: poll.end_time
            };
        }

        res.json({ polls, userRole, modalData, allowMemberPoll });
    } catch (err) {
        console.error("Error fetching group polls:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/group/:id/stops", (req, res) => {
    try {
        const userId = req.session.user_id;
        const groupId = req.params.id;

        if (!userId) return res.status(401).json({ error: "Not logged in" });

        const membership = db.prepare(`
            SELECT role FROM group_members WHERE user_id = ? AND group_id = ?
        `).get(userId, groupId);

        if (!membership) return res.status(403).json({ error: "Not a member of this group" });

        const stops = db.prepare(`
            SELECT s.id, s.title, s.description, s.startDate, s.endDate,
                   s.coordinates_lat AS lat, s.coordinates_lng AS lng,
                   u.display_name AS author,
                   (SELECT json_group_array(json_object('file_name', sf.file_name, 'file_path', sf.file_path)) 
                    FROM stop_files sf WHERE sf.stop_id = s.id) AS files
            FROM stops s
            JOIN users u ON s.creator_id = u.id
            WHERE s.group_id = ?
            ORDER BY s.startDate ASC
        `).all(groupId);

        res.json(stops.map(s => ({ ...s, files: s.files ? JSON.parse(s.files) : [] })));
    } catch (err) {
        console.error("Error fetching stops:", err);
        res.status(500).json({ error: "Failed to fetch stops" });
    }
});


app.get("/group/:id/stops/:stopId", (req, res) => {
    try {
        const userId = req.session.user_id;
        const groupId = req.params.id;
        const stopId = req.params.stopId;

        if (!userId) return res.status(401).json({ error: "Not logged in" });

        const stop = db.prepare(`
            SELECT s.id, s.title, s.description, s.startDate, s.endDate,
                   s.coordinates_lat AS lat, s.coordinates_lng AS lng,
                   u.display_name AS author,
                   s.creator_id,
                   (SELECT json_group_array(json_object('file_name', sf.file_name, 'file_path', sf.file_path)) 
                    FROM stop_files sf WHERE sf.stop_id = s.id) AS files
            FROM stops s
            JOIN users u ON s.creator_id = u.id
            WHERE s.id = ? AND s.group_id = ?
        `).get(stopId, groupId);

        if (!stop) return res.status(404).json({ error: "Stop not found" });

        stop.files = stop.files ? JSON.parse(stop.files) : [];
        res.json(stop);
    } catch (err) {
        console.error("Error fetching stop:", err);
        res.status(500).json({ error: "Failed to fetch stop" });
    }
});

app.get("/group/:groupId/stops/:stopId/files", (req, res) => {
  const stopId = req.params.stopId;
  const files = db.prepare("SELECT * FROM stop_files WHERE stop_id = ?").all(stopId);
  res.json(files);
});

// ========================== ALL POST ROUTES ==========================

// ===== LOGIN & REGISTER =====
// login
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // check user in db
    const user = db
        .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
        .get(username, password);

    if (user) {
        req.session.user_id = user.id;
        res.json({ success: true, message: `Welcome, ${user.username}!` });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

// register
app.post("/register", (req, res) => {
    const { username, password } = req.body;

    // check if user already exists
    try {
        const user = db
        .prepare("SELECT * FROM users WHERE username = ?")
        .get(username)

        if (user) {
        res.status(409).json({ success: false, message: `User already exists.`});
        } else {
        const friendCode = createUniqueFriendCode();
        const insertUser = db.prepare("INSERT INTO users (username, password, friend_code) VALUES (?, ?, ?)");
        insertUser.run(username, password, friendCode)
        res.json({ success: true, message: `Registration successful. Welcome, ${username}!` });
        }
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ message: "Server error. Please try again later." });
    }
});


// ===== GROUPS =====
// create group
app.post("/createGroup", (req, res) => {
    const { name, description, startDate, endDate } = req.body;
    const userId = req.session.user_id;

    try {
        if (name && description && (startDate <= endDate)) {
            const insertGroup = db.prepare("INSERT INTO groups (name, description, startDate, endDate) VALUES (?, ?, ?, ?)");
            const result = insertGroup.run(name, description, startDate, endDate);
            const groupId = result.lastInsertRowid;

            const insertMember = db.prepare("INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, ?)");
            insertMember.run(userId, groupId, "admin");

            res.json({ success: true, message: `Greated created & Owner added succesfully!` });

        } else {
            res.status(422).json({ success: false, message: `Start date cannot be after end date.`});
        }

    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ message: "Server error. Please try again later." });
    }
});

// delete group
app.post("/deleteGroup", (req, res) => {
    const userId = req.session.user_id;
    const { groupId } = req.body;

    const isOwner = db.prepare(`
        SELECT 1 FROM group_members
        WHERE user_id = ? AND group_id = ? AND role = 'admin'
    `).get(userId, groupId);

    if (!isOwner) {

        try {
            db.prepare("DELETE FROM group_members WHERE user_id = ? AND group_id = ?").run(userId, groupId);
            return res.json({ success: true });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to delete group." });
        }
    }

    console.log("Deleting group:", groupId);

    try {
        db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
        return res.json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to delete group." });
    }
});

// change member role
app.post("/group/:id/change-role", (req, res) => {
    try {
        const groupId = req.params.id;
        const { username, newRole } = req.body;
    
        const sessionUserId = req.session.user_id;
        const sessionUser = db.prepare(`
            SELECT username FROM users WHERE id = ?
        `).get(sessionUserId);

        // validate role
        if (!["admin", "member", "viewer"].includes(newRole)) {
            return res.json({ success: false, error: "Invalid role" });
        }

        // this should NEVER show up, but it did reveal issues before
        const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
        if (!user) return res.json({ success: false, error: "User not found" });

        const isTargetAdmin = db.prepare(`
            SELECT role FROM group_members
            WHERE user_id = ? AND group_id = ?
        `).get(user.id, groupId);

        const wasAdmin = isTargetAdmin.role === "admin";

        if (username === sessionUser.username && wasAdmin && newRole !== "admin") {
            return res.json({ success: false, error: "You cannot remove your own admin role." });
        }

        // update role in group_members
        const stmt = db.prepare(`
            UPDATE group_members 
            SET role = ? 
            WHERE user_id = ? AND group_id = ?
        `);
        const info = stmt.run(newRole, user.id, groupId);

        if (info.changes === 0) {
            return res.json({ success: false, error: "Member not found in this group" });
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// remove member(s) from group
app.post("/group/:id/remove-members", (req, res) => {
    try {
        const groupId = req.params.id;
        const { usernames } = req.body;

        const sessionUserId = req.session.user_id;
        const sessionUser = db.prepare(`
            SELECT username FROM users WHERE id = ?
        `).get(sessionUserId);

        if (!Array.isArray(usernames) || usernames.length === 0) {
            return res.json({ success: false, error: "No members selected" });
        }

        // dont remove yourself, stupid, i will add a "quit group" option elsewhere
        if (usernames.includes(sessionUser.username)) {
            return res.json({ success: false, error: "You cannot remove yourself from the group." });
        }

        // since you cannot remove yourself, it is unnecessary to add a check to not remove everyone from the group (since you cannot remove yourself), 
        // or a check to not remove the last admin (since that should always be you)

        const users = db.prepare(`
            SELECT id FROM users WHERE username IN (${usernames.map(() => "?").join(",")})
        `).all(...usernames);

        if (users.length === 0) {
            return res.json({ success: false, error: "Users not found" });
        }

        const stmt = db.prepare(`
            DELETE FROM group_members 
            WHERE group_id = ? AND user_id IN (${users.map(() => "?").join(",")})
        `);
        stmt.run(groupId, ...users.map(u => u.id));

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// ===== USER PROFILE ===== 
// profile banner
app.post("/user/banner-color", (req, res) => {
    const userId = req.session.user_id;
    const { color } = req.body;

    try {
        db.prepare("UPDATE users SET bannerColor = ? WHERE id = ?")
        .run(color, userId);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// profile picture
app.post("/user/profile-picture", upload.single("profilePicture"), (req, res) => {
    const userId = req.session.user_id;

    if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
    }

    const filename = req.file.filename;

    try {
        db.prepare("UPDATE users SET profilePicture = ? WHERE id = ?")
            .run(filename, userId);

        res.json({ success: true, filename });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// edit profile
app.post("/user/profile", (req, res) => {
    const userId = req.session.user_id;
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { displayName, bio, bannerColor } = req.body;

    try {
        db.prepare(`
        UPDATE users 
        SET display_name = ?, bio = ?, bannerColor = ?
        WHERE id = ?
        `).run(displayName, bio, bannerColor, userId);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Database error" });
    }
});


// ===== FRIENDS =====
// add friend
app.post("/user/add-friend", (req, res) => {
    const userId = req.session.user_id;
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { username, friend_code } = req.body;

    const user = db.prepare("SELECT id, friend_code FROM users WHERE username = ?").get(username);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.friend_code !== friend_code) return res.status(400).json({ error: "Friend code incorrect" });
    if (user.id === userId) return res.status(400).json({ error: "Cannot add yourself" });

    // check if req already exists
    const exists = db.prepare("SELECT 1 FROM friend_requests WHERE requester_id = ? AND requested_id = ?").get(userId, user.id);
    if (exists) return res.status(400).json({ error: "Friend req already sent" });

    db.prepare("INSERT INTO friend_requests (requester_id, requested_id) VALUES (?, ?)").run(userId, user.id);

    // check if reciprocal req exists -> mutual friendship
    const reciprocal = db.prepare("SELECT 1 FROM friend_requests WHERE requester_id = ? AND requested_id = ?").get(user.id, userId);
    if (reciprocal) {
        res.json({ success: true, message: `Friendship confirmed with ${username}!` });
    } else {
        res.json({ success: true, message: `Friend request sent to ${username}.` });
    }
});

// remove friend
app.post("/user/unfriend", (req, res) => {
    const userId = req.session.user_id;
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: "Missing friendId" });

    try {
        db.prepare(`
            DELETE FROM friend_requests
            WHERE (requester_id = ? AND requested_id = ?)
            OR (requester_id = ? AND requested_id = ?)
        `).run(userId, friendId, friendId, userId);

        res.json({ success: true, message: "Friendship removed." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to unfriend." });
    }
});


// ===== GROUP INVITES =====
// send a group invite
app.post("/user/invite-to-group", (req, res) => {
    const inviterId = req.session.user_id;
    const { friendId, groupId, role: requestedRole } = req.body;

    if (!inviterId)
        return res.status(401).json({ error: "Not logged in" });

    const membership = db.prepare(`
        SELECT gm.role AS inviterRole, g.allowMemberInvite
        FROM group_members gm
        JOIN groups g ON gm.group_id = g.id
        WHERE gm.user_id = ? AND gm.group_id = ?
    `).get(inviterId, groupId);

    if (!membership) return res.status(403).json({ error: "You are not a member of this group." });

    const { inviterRole, allowMemberInvite } = membership;

    // viewers can never invite
    if (inviterRole === "viewer") return res.status(403).json({ error: "Viewers cannot invite members." });

    // members can only invite if allowed
    if (inviterRole === "member" && !allowMemberInvite) {
        return res.status(403).json({ error: "Members are not allowed to invite." });
    }

    // prevent inviting higher than your own role
    const roleHierarchy = { viewer: 1, member: 2, admin: 3 };
    if (roleHierarchy[requestedRole] > roleHierarchy[inviterRole]) {
        return res.status(403).json({ error: "You cannot invite someone to a higher role than your own." });
    }

    // don't invite someone who is already in the group
    const alreadyMember = db.prepare(`
        SELECT 1 FROM group_members
        WHERE user_id = ? AND group_id = ?
    `).get(friendId, groupId);

    if (alreadyMember) return res.json({ error: "This user is already a member of the group." });

    try {
        db.prepare(`
            INSERT INTO invites (group_id, inviter_id, invited_id, role)
            VALUES (?, ?, ?, ?)
        `).run(groupId, inviterId, friendId, requestedRole);

        res.json({ success: true, message: "Invite sent!" });

    } catch (err) {
        if (err.message.includes("UNIQUE")) {
            return res.json({ error: "This user already has a pending invite." });
        }
        console.error(err);
        res.status(500).json({ error: "Database error sending invite." });
    }
});


// accept a group invite
app.post("/groups/accept-invite/:inviteId", (req, res) => {
    const inviteId = req.params.inviteId;
    const userId = req.session.user_id;

    const invite = db.prepare(
        "SELECT group_id, invited_id, role FROM invites WHERE id = ?"
    ).get(inviteId);

    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.invited_id !== userId)
        return res.status(403).json({ error: "Not your invite" });

    // add user to group
    db.prepare(
        `INSERT INTO group_members (user_id, group_id, role)
        VALUES (?, ?, ?)`
    ).run(userId, invite.group_id, invite.role);

    // delete invite
    db.prepare("DELETE FROM invites WHERE id = ?").run(inviteId);

    res.json({ success: true });
});

// decline a group invite
app.post("/groups/decline-invite/:inviteId", (req, res) => {
    const inviteId = req.params.inviteId;
    const userId = req.session.user_id;

    const invite = db.prepare("SELECT invited_id FROM invites WHERE id = ?").get(inviteId);

    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.invited_id !== userId)
        return res.status(403).json({ error: "Not your invite" });

    db.prepare("DELETE FROM invites WHERE id = ?").run(inviteId);

    res.json({ success: true });
});


// ===== POLLS =====
// create a poll
app.post("/group/:id/polls/create", (req, res) => {
    try {
        const groupId = Number(req.params.id);
        const userId = req.session.user_id;
        const { title, allow_multiple, end_time, options } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: "Not logged in" });
        }

        if (!title || !Array.isArray(options) || options.length < 2) {
            return res.status(400).json({ success: false, error: "Invalid poll data" });
        }

        const membership = db.prepare(`
            SELECT role FROM group_members
            WHERE user_id = ? AND group_id = ?
        `).get(userId, groupId);

        if (!membership || membership.role !== "admin") {
            return res.status(403).json({ success: false, error: "Only admins can create polls" });
        }

        const insertPoll = db.prepare(`
            INSERT INTO group_polls (group_id, creator_id, title, allow_multiple, end_time)
            VALUES (?, ?, ?, ?, ?)
        `);

        const pollResult = insertPoll.run(
            groupId,
            userId,
            title,
            allow_multiple ? 1 : 0,
            end_time || null
        );

        const pollId = pollResult.lastInsertRowid;

        const insertOption = db.prepare(`
            INSERT INTO poll_options (poll_id, contents, vote_count)
            VALUES (?, ?, 0)
        `);

        for (const optText of options) {
            insertOption.run(pollId, optText);
        }

        return res.json({ success: true, pollId });

    } catch (err) {
        console.error("Error creating poll:", err);
        res.status(500).json({ success: false, error: "Server error creating poll" });
    }
});

// confirm a vote
app.post("/poll/:id/confirmVote", (req, res) => {
    try {
        const pollId = Number(req.params.id);
        const voterId = req.session.user_id;
        const { vote } = req.body;
        const optionId = Number(vote);

        if (!voterId) return res.status(401).json({ success: false, error: "Not logged in" });
        if (vote === undefined) return res.status(400).json({ success: false, error: "No vote provided" });

        const poll = db.prepare("SELECT allow_multiple FROM group_polls WHERE poll_id = ?").get(pollId);
        if (!poll) return res.status(404).json({ success: false, error: "Poll not found" });

        const option = db.prepare("SELECT option_id FROM poll_options WHERE poll_id = ? AND option_id = ?")
                        .get(pollId, optionId);
        if (!option) return res.status(404).json({ success: false, error: "Option not found" });

        const existingVote = db.prepare("SELECT 1 FROM poll_votes WHERE poll_id = ? AND option_id = ? AND voter_id = ?")
                            .get(pollId, optionId, voterId);
        if (existingVote) return res.json({ success: false, message: "Already voted for this option" });

        if (poll.allow_multiple === 0) {
            const otherVotes = db.prepare("SELECT option_id FROM poll_votes WHERE poll_id = ? AND voter_id = ?")
                                .all(pollId, voterId);
            for (const v of otherVotes) {
                db.prepare("DELETE FROM poll_votes WHERE poll_id = ? AND option_id = ? AND voter_id = ?")
                    .run(pollId, v.option_id, voterId);
                db.prepare("UPDATE poll_options SET vote_count = vote_count - 1 WHERE option_id = ? AND vote_count > 0")
                    .run(v.option_id);
            }
        }

        db.prepare("INSERT INTO poll_votes (poll_id, option_id, voter_id) VALUES (?, ?, ?)")
            .run(pollId, optionId, voterId);
        db.prepare("UPDATE poll_options SET vote_count = vote_count + 1 WHERE option_id = ?")
            .run(optionId);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// remove a vote
app.post("/poll/:id/removeVote", (req, res) => {
    try {
        const pollId = Number(req.params.id);
        const voterId = req.session.user_id;
        const { vote } = req.body; // option id to remove

        if (!voterId) return res.status(401).json({ success: false, error: "Not logged in" });
        if (vote === undefined) return res.status(400).json({ success: false, error: "No vote provided" });

        const optionId = Number(vote);

        db.prepare("DELETE FROM poll_votes WHERE poll_id = ? AND option_id = ? AND voter_id = ?")
            .run(pollId, optionId, voterId);

        db.prepare("UPDATE poll_options SET vote_count = vote_count - 1 WHERE option_id = ? AND vote_count > 0")
            .run(optionId);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// update group settings
app.post("/group/:id/settings/update", (req, res) => {
    try {
        const userId = req.session.user_id;
        if (!userId) return res.status(401).json({ error: "Not logged in" });

        const groupId = req.params.id;
        const { allowMemberInvite, allowMemberPoll, allowViewerChat, bio, title, startDate, endDate } = req.body;

        const settingsDb = db.prepare(`
            UPDATE groups
            SET allowMemberInvite = ?, 
                allowMemberPoll = ?, 
                allowViewerChat = ?,
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                startDate = COALESCE(?, startDate),
                endDate = COALESCE(?, endDate)
            WHERE id = ?
        `);

        settingsDb.run(
            allowMemberInvite ? 1 : 0,
            allowMemberPoll ? 1 : 0,
            allowViewerChat ? 1 : 0,
            title || null,
            bio || null,
            startDate || null,
            endDate || null,
            groupId
        );

        res.json({ success: true, message: "Group settings updated successfully" });

    } catch (err) {
        console.error("Error updating group settings:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/group/:groupId/stops", uploadStopFiles.array("files"), (req, res) => {
    try {
        const userId = req.session.user_id;
        const groupId = Number(req.params.groupId);

        if (!userId) return res.status(401).json({ error: "Not logged in" });

        const membership = db.prepare(`
            SELECT role FROM group_members
            WHERE user_id = ? AND group_id = ?
        `).get(userId, groupId);

        if (!membership || membership.role === "viewer") return res.status(403).json({ error: "Not allowed to add stops" });

        const { title, description, startDate, endDate, lat, lng } = req.body;

        if (!title || !startDate || !endDate || !lat || !lng) return res.status(400).json({ error: "Missing required fields" });

        const stopResult = db.prepare(`
            INSERT INTO stops 
            (group_id, creator_id, title, description, startDate, endDate, coordinates_lat, coordinates_lng)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(groupId, userId, title, description || "", startDate, endDate, lat, lng);

        const stopId = stopResult.lastInsertRowid;

        if (req.files && req.files.length > 0) {
            const insertFile = db.prepare(`
                INSERT INTO stop_files
                (stop_id, group_id, file_name, file_path, file_type, file_size)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            for (const file of req.files) {
                insertFile.run(stopId, groupId, file.originalname, file.filename, file.mimetype, file.size);
            }
        }

        res.json({ success: true, stopId });
    } catch (err) {
        console.error("Error creating stop:", err);
        res.status(500).json({ error: "Failed to create stop" });
    }
});

app.post("/group/:groupId/stops/:stopId/update", uploadStopFiles.array("files"), (req, res) => {
    try {
        const userId = req.session.user_id;
        const groupId = Number(req.params.groupId);
        const stopId = Number(req.params.stopId);

        if (!userId) return res.status(401).json({ error: "Not logged in" });

        const membership = db.prepare(`
            SELECT role FROM group_members WHERE user_id = ? AND group_id = ?
        `).get(userId, groupId);

        if (!membership || membership.role === "viewer") return res.status(403).json({ error: "Not allowed to edit stops" });

        const { title, description, startDate, endDate } = req.body;

        db.prepare(`
            UPDATE stops SET
                title = ?, description = ?, startDate = ?, endDate = ?
            WHERE id = ? AND group_id = ?
        `).run(title, description, startDate, endDate, stopId, groupId);

        if (req.files && req.files.length > 0) {
            const insertFile = db.prepare(`
                INSERT INTO stop_files
                (stop_id, group_id, file_name, file_path, file_type, file_size)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            for (const file of req.files) {
                insertFile.run(stopId, groupId, file.originalname, file.filename, file.mimetype, file.size);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating stop:", err);
        res.status(500).json({ error: "Failed to update stop" });
    }
});

app.post("/group/:groupId/stops/:stopId/delete", (req, res) => {
    try {
        const userId = req.session.user_id;
        const groupId = Number(req.params.groupId);
        const stopId = Number(req.params.stopId);

        if (!userId) return res.status(401).json({ error: "Not logged in" });

        const membership = db.prepare(`
            SELECT role FROM group_members WHERE user_id = ? AND group_id = ?
        `).get(userId, groupId);

        if (!membership || membership.role === "viewer") return res.status(403).json({ error: "Not allowed to delete stops" });

        db.prepare("DELETE FROM stop_files WHERE stop_id = ?").run(stopId);
        db.prepare("DELETE FROM stops WHERE id = ? AND group_id = ?").run(stopId, groupId);

        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting stop:", err);
        res.status(500).json({ error: "Failed to delete stop" });
    }
});

app.post("/group/:groupId/stops/:stopId/files/:fileId/delete", (req, res) => {
    try {
        const userId = req.session.user_id;
        const groupId = Number(req.params.groupId);
        const stopId = Number(req.params.stopId);
        const fileId = Number(req.params.fileId);

        if (!userId) return res.status(401).json({ error: "Not logged in" });

        const membership = db.prepare(`
            SELECT role FROM group_members WHERE user_id = ? AND group_id = ?
        `).get(userId, groupId);

        if (!membership || membership.role === "viewer") 
            return res.status(403).json({ error: "Not allowed to delete files" });

        const file = db.prepare(`
            SELECT file_path FROM stop_files 
            WHERE id = ? AND stop_id = ? AND group_id = ?
        `).get(fileId, stopId, groupId);

        if (!file) return res.status(404).json({ error: "File not found" });

        const filePath = path.join(__dirname, "public", "uploads", "stops", file.file_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        } else {
            console.warn("File already missing:", filePath);
        }

        db.prepare(`DELETE FROM stop_files WHERE id = ?`).run(fileId);

        res.json({ success: true });

    } catch (err) {
        console.error("Error deleting stop file:", err);
        res.status(500).json({ error: "Failed to delete stop file" });
    }
});



// ========================== MIDDLEWARE ==========================

// Middleware for unknown routes
// Must be last in pipeline
app.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!");
});

// Middleware for error handling
app.use((error, req, res, next) => {
    console.error(error.stack);
    res.status(500).send("Something broke!");
});


// ========================== STARTUP ==========================

// App starts here
InitializeDatabase();
const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

const io = new Server(server);

// ========================== SOCKET.IO CHAT ==========================

io.on("connection", (socket) => {
    // joining the group chat
    socket.on("joinGroupChat", (groupId) => {
        socket.join(`group_${groupId}`);
    });

    // loading previous messages in the chat
    socket.on("loadChatHistory", (groupId) => {
        try {
            const messages = db.prepare(`
                SELECT 
                    gm.contents,
                    gm.timestamp,
                    u.display_name
                FROM group_messages gm
                JOIN users u ON gm.user_id = u.id
                WHERE gm.group_id = ?
                ORDER BY gm.timestamp ASC
            `).all(groupId);

            socket.emit("chatHistory", messages);
        } catch (err) {
            console.error("Chat history error:", err);
        }
    });

    // sending a new message in the group chat
    socket.on("sendMessage", (data) => {
        const { groupId, userId, text } = data;
        if (!text || !text.trim()) return;

        db.prepare(`
            INSERT INTO group_messages (group_id, user_id, contents)
            VALUES (?, ?, ?)
        `).run(groupId, userId, text);

        const user = db.prepare("SELECT display_name FROM users WHERE id = ?").get(userId);

        io.to(`group_${groupId}`).emit("newMessage", {
            display_name: user?.display_name || "Unknown",
            contents: text,
            timestamp: new Date().toISOString()
        });
    });
});