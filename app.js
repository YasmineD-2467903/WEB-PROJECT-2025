import express from "express";
import session from "express-session";
import { db, InitializeDatabase } from "./db.js";

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

    const groups = db
      .prepare(
        `
        SELECT g.id, g.name, g.description
        FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?
      `
      )
      .all(userId);

    response.json(groups);
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

    const stmt = db.prepare("SELECT id, name, description FROM groups WHERE id = ?");
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

    const members = db.prepare(`
      SELECT u.username, gm.role
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
    `).all(groupId);

    response.json(members);
  } catch (err) {
    console.error("Error fetching group members:", err);
    response.status(500).json({ error: "Internal server error" });
  }
});

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
      const insertUser = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
      insertUser.run(username, password)
      response.json({ success: true, message: `Registration successful. Welcome, ${username}!` });
    }
  } catch (err) {
    console.error("Database error:", err);
    response.status(500).json({ message: "Server error. Please try again later." });
  }
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

