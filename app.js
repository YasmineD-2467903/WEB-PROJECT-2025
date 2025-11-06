import express from "express";
import { db, InitializeDatabase } from "./db.js";

const app = express();
const port = process.env.PORT || 8080; // Set by Docker Entrypoint or use 8080

InitializeDatabase();

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
app.get("/", (request, response) => {           //we willen auto de website redirecten naar de login zodat gebruiker kan inloggen
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

app.get("/chats", (request, response) => {
  response.render("pages/chats/chats");
});

// login

app.post("/login", (request, response) => {
  const { username, password } = request.body;

  // Check user in database
  const user = db
    .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
    .get(username, password);

  if (user) {
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

