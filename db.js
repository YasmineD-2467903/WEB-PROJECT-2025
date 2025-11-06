import Database from "better-sqlite3";

export const db = new Database("database.db", { verbose: console.log });

export function InitializeDatabase() {
  db.pragma("journal_mode = WAL;");
  db.pragma("busy_timeout = 5000;");
  db.pragma("synchronous = NORMAL;");
  db.pragma("cache_size = 1000000000;");
  db.pragma("foreign_keys = true;");
  db.pragma("temp_store = memory;");

  db.prepare("CREATE TABLE IF NOT EXISTS users (username TEXT UNIQUE, password TEXT) STRICT").run();

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;

  if (userCount === 0) {
    console.log("Database empty — inserting example users...");
    const exampleUsers = [
      { username: "Peter", password: "password123" },
      { username: "Jori", password: "bugger" },
      { username: "Joris", password: "letmein" },
      { username: "Mike", password: "yippie" },
    ];

    const insertUser = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    const transaction = db.transaction((users) => {
      for (const user of users) insertUser.run(user.username, user.password);
    });
    transaction(exampleUsers);
  } else {
    console.log("Users already present — skipping demo inserts.");
  }
}