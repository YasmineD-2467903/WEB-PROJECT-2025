import express from "express";
import session from "express-session";
import { db, InitializeDatabase } from "./db.js";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/"); // Create this folder
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.session.user_id}${ext}`);
  }
});

const upload = multer({ storage });


// final test

const app = express();
const port = process.env.PORT || 8080; // Set by Docker Entrypoint or use 8080

InitializeDatabase();

app.use(session({
  secret: "IGyUVFukVUKvKVuukivIUVuyVoF9PGFG86FVI", // super duper secret key
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// DEBUGGING
// const CURRENT_USER_ID = 1;

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
app.use((request, response, next) => {
  console.log(
    `Request URL: ${request.url} @ ${new Date().toLocaleString("nl-BE")}`
  );
  next();
});


// Your routes here ...
app.get("/", (request, response) => {
  response.redirect("/login");
});

app.get("/login", (request, response) => { 
  response.render("pages/login/login");
});

app.get("/register", (request, response) => {
  response.render("pages/register/register");
});

app.get("/fyp", (request, response) => {
  response.render("pages/fyp/fyp");
});

app.get("/groups", (request, response) => {
  try {
    const userId = request.session.user_id;
    if (!userId) return response.status(401).json({ error: "Not logged in" });

    const groups = db.prepare(`
      SELECT g.id, g.name, g.description, gm.role
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ?
    `).all(userId);

    const roles = {};
    for (const g of groups) {
      roles[g.id] = g.role;
      delete g.role;
    }

    response.json({ groups, roles });

  } catch (err) {
    console.error("Error fetching groups:", err);
    response.status(500).json({ error: "Failed to load groups" });
  }
});

// page

app.get("/group", (request, response) => {
  const groupId = request.query.id;
  if (!groupId) return response.status(400).send("Group ID missing");
  response.render("pages/group/group", { groupId });
});

// data

app.get("/group/:id", (request, response) => {
  try {
    const groupId = request.params.id;

    console.log(`Fetching data for group ${groupId}`);

    const stmt = db.prepare("SELECT id, name, description, startDate, endDate FROM groups WHERE id = ?");
    const group = stmt.get(groupId);

    if (!group) {
      console.log(`Group ${groupId} not found`);
      return response.status(404).json({ error: "Group not found" });
    }

    response.json(group);
  } catch (err) {
    console.error("Error fetching group:", err);
    response.status(500).json({ error: "Internal server error" });
  }
});

// member list

app.get("/group/:id/members", (request, response) => {
  try {
    const groupId = request.params.id;
    const userId = request.session.user_id;

    const members = db.prepare(`
      SELECT u.username, gm.role
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
    `).all(groupId);

    const checkRole = db
      .prepare("SELECT role FROM group_members WHERE user_id = ? AND group_id = ?")
      .get(userId, groupId);

    const userRole = checkRole.role;

    response.json({ members, userRole });
  } catch (err) {
    console.error("Error fetching group members:", err);
    response.status(500).json({ error: "Internal server error" });
  }
});

// profile page

app.get("/user/me", (req, res) => {
  const userId = req.session.user_id;
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  const user = db.prepare(`
    SELECT username, display_name, bio, bannerColor, profilePicture
    FROM users
    WHERE id = ?
  `).get(userId);

  res.json(user);
});

// friend page

app.get("/user/friend-code", (req, res) => {
  const userId = req.session.user_id;
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  const user = db.prepare("SELECT friend_code FROM users WHERE id = ?").get(userId);
  res.json({ friend_code: user.friend_code });
});

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


app.get("/user/friend-requests", (req, res) => {
  const userId = req.session.user_id;
  const requests = db.prepare(`
    SELECT u.username, u.display_name
    FROM friend_requests fr
    JOIN users u ON fr.requester_id = u.id
    WHERE fr.requested_id = ?
  `).all(userId);

  res.json({ requests });
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

        const memberCount = db.prepare(`
          SELECT COUNT(*) AS cnt
          FROM group_members
          WHERE group_id = ?
        `).get(groupId).cnt;

        const adminCount = db.prepare(`
          SELECT COUNT(*) AS cnt
          FROM group_members
          WHERE group_id = ? AND role = 'admin'
        `).get(groupId).cnt;


        if (!Array.isArray(usernames) || usernames.length === 0) {
            return res.json({ success: false, error: "No members selected" });
        }

        // dont remove yourself, stupid, i will add a "quit group" option elsewhere
        if (usernames.includes(sessionUser.username)) {
            return res.json({ success: false, error: "You cannot remove yourself from the group." });
        }

        // since you cannot remove yourself, it is unnecessary to add a check to not remove everyone from the group (since you cannot remove yourself), 
        // or a check to not remove the last admin (since that should always be you)

        const adminsBeingRemoved = db.prepare(`
            SELECT username
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ? AND gm.role = 'admin' AND u.username IN (${usernames.map(() => "?").join(",")})
        `).all(groupId, ...usernames);

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


// group page

app.get("/group/:id/section/:section", (request, response) => {
  const { id, section } = request.params;
  const validSections = ["members", "settings", "chat", "map", "polls"];
  if (!validSections.includes(section)) return response.status(404).send("Invalid section");
  response.render(`partials/group-${section}.ejs`, { groupId: id });
});

// login

app.post("/login", (request, response) => {
  const { username, password } = request.body;

  // Check user in database
  const user = db
    .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
    .get(username, password);

  if (user) {
    request.session.user_id = user.id;
    response.json({ success: true, message: `Welcome, ${user.username}!` });
  } else {
    response.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// register

app.post("/register", (request, response) => {
  const { username, password } = request.body;

  // Check if user already exists
  try {
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username)

    if (user) {
      response.status(409).json({ success: false, message: `User already exists.`});
    } else {
      const friendCode = createUniqueFriendCode();
      const insertUser = db.prepare("INSERT INTO users (username, password, friend_code) VALUES (?, ?, ?)");
      insertUser.run(username, password, friendCode)
      response.json({ success: true, message: `Registration successful. Welcome, ${username}!` });
    }
  } catch (err) {
    console.error("Database error:", err);
    response.status(500).json({ message: "Server error. Please try again later." });
  }
});

// create group

app.post("/createGroup", (request, response) => {
  const { name, description, startDate, endDate } = request.body;
  const userId = request.session.user_id;

  try {
    if (name && description && (startDate <= endDate)) {
      const insertGroup = db.prepare("INSERT INTO groups (name, description, startDate, endDate) VALUES (?, ?, ?, ?)");
      const result = insertGroup.run(name, description, startDate, endDate);
      const groupId = result.lastInsertRowid;

      const insertMember = db.prepare("INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, ?)");
      insertMember.run(userId, groupId, "admin");

      response.json({ success: true, message: `Greated created & Owner added succesfully!` });

    } else {
      response.status(422).json({ success: false, message: `Start date cannot be after end date.`});
    }

  } catch (err) {
    console.error("Database error:", err);
    response.status(500).json({ message: "Server error. Please try again later." });
  }
});

// delete group

app.post("/deleteGroup", (request, response) => {
  const userId = request.session.user_id;
  const { groupId } = request.body;

  const isOwner = db.prepare(`
    SELECT 1 FROM group_members
    WHERE user_id = ? AND group_id = ? AND role = 'admin'
  `).get(userId, groupId);

  if (!isOwner) {

    try {
      db.prepare("DELETE FROM group_members WHERE user_id = ? AND group_id = ?").run(userId, groupId);
      return response.json({ success: true });
    } catch (err) {
      console.error(err);
      return response.status(500).json({ error: "Failed to delete group." });
    }
  }

  console.log("Deleting group:", groupId);

  try {
    db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
    return response.json({ success: true });
  } catch (err) {
    console.error(err);
    return response.status(500).json({ error: "Failed to delete group." });
  }
});

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

// profile (your own or a friends profile)

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


// friend code thing

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

// add friend

app.post("/user/add-friend", (req, res) => {
  const userId = req.session.user_id;
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  const { username, friend_code } = req.body;

  const user = db.prepare("SELECT id, friend_code FROM users WHERE username = ?").get(username);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.friend_code !== friend_code) return res.status(400).json({ error: "Friend code incorrect" });
  if (user.id === userId) return res.status(400).json({ error: "Cannot add yourself" });

  // check if request already exists
  const exists = db.prepare("SELECT 1 FROM friend_requests WHERE requester_id = ? AND requested_id = ?").get(userId, user.id);
  if (exists) return res.status(400).json({ error: "Friend request already sent" });

  db.prepare("INSERT INTO friend_requests (requester_id, requested_id) VALUES (?, ?)").run(userId, user.id);

  // check if reciprocal request exists -> mutual friendship
  const reciprocal = db.prepare("SELECT 1 FROM friend_requests WHERE requester_id = ? AND requested_id = ?").get(user.id, userId);
  if (reciprocal) {
    res.json({ success: true, message: `Friendship confirmed with ${username}!` });
  } else {
    res.json({ success: true, message: `Friend request sent to ${username}.` });
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

// send invite

app.post("/user/invite-to-group", (req, res) => {
    const inviterId = req.session.user_id;
    const { friendId, groupId, role } = req.body;

    if (!inviterId)
        return res.status(401).json({ error: "Not logged in" });

    // later on groups will have the setting that can allow members to invite others (only as member or viewer), i will implement that later, when I actually do the settings
    const membership = db.prepare(`
        SELECT role FROM group_members
        WHERE user_id = ? AND group_id = ?
    `).get(inviterId, groupId);

    if (!membership || membership.role !== "admin") {
        return res.status(403).json({ error: "Only admins can invite." });
    }

    // dont invite someone who is alr in the group
    const alreadyMember = db.prepare(`
        SELECT 1 FROM group_members
        WHERE user_id = ? AND group_id = ?
    `).get(friendId, groupId);

    if (alreadyMember) {
        return res.json({ error: "This user is already a member of the group." });
    }

    try {
        db.prepare(`
            INSERT INTO invites (group_id, inviter_id, invited_id, role)
            VALUES (?, ?, ?, ?)
        `).run(groupId, inviterId, friendId, role);

        res.json({ success: true, message: "Invite sent!" });

    } catch (err) {
        if (err.message.includes("UNIQUE")) {
            return res.json({ error: "This user already has a pending invite." });
        }

        console.error(err);
        res.status(500).json({ error: "Database error sending invite." });
    }
});

// accept / decline invites

app.post("/groups/accept-invite/:inviteId", (req, res) => {
    const inviteId = req.params.inviteId;
    const userId = req.session.user_id;

    const invite = db.prepare(
        "SELECT group_id, invited_id, role FROM invites WHERE id = ?"
    ).get(inviteId);

    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.invited_id !== userId)
        return res.status(403).json({ error: "Not your invite" });

    // Add user to group
    db.prepare(
        `INSERT INTO group_members (user_id, group_id, role)
         VALUES (?, ?, ?)`
    ).run(userId, invite.group_id, invite.role);

    // Delete invite
    db.prepare("DELETE FROM invites WHERE id = ?").run(inviteId);

    res.json({ success: true });
});

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

// Middleware for unknown routes
// Must be last in pipeline
app.use((request, response, next) => {
  response.status(404).send("Sorry can't find that!");
});

// Middleware for error handling
app.use((error, request, response, next) => {
  console.error(error.stack);
  response.status(500).send("Something broke!");
});

// App starts here
// InitializeDatabase();
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

 