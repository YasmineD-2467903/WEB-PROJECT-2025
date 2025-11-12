import Database from "better-sqlite3";

export const db = new Database("database.db", { verbose: console.log });

export function InitializeDatabase() {
  db.pragma("journal_mode = WAL;");
  db.pragma("busy_timeout = 5000;");
  db.pragma("synchronous = NORMAL;");
  db.pragma("cache_size = 1000000000;");
  db.pragma("foreign_keys = true;");
  db.pragma("temp_store = memory;");

  // USERS
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    ) STRICT;
  `).run();

  // GROUPS
  db.prepare(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      invite_code TEXT UNIQUE
    ) STRICT;
  `).run();

  // GROUP MEMBERSHIP
  db.prepare(`
    CREATE TABLE IF NOT EXISTS group_members (
      user_id INTEGER,
      group_id INTEGER,
      role TEXT CHECK(role IN ('admin','member', 'viewer')),
      PRIMARY KEY (user_id, group_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    ) STRICT;
  `).run();

  // TRIPS
  db.prepare(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER,
      name TEXT,
      start_date TEXT,
      end_date TEXT,
      country TEXT,
      cover_photo TEXT,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    ) STRICT;
  `).run();

  // STOPS
  db.prepare(`
    CREATE TABLE IF NOT EXISTS stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER,
      title TEXT,
      description TEXT,
      date TEXT,
      coordinates_lat REAL,
      coordinates_lng REAL,
      tags TEXT,
      FOREIGN KEY (trip_id) REFERENCES trips(id)
    ) STRICT;
  `).run();

  // GROUP CHAT MESSAGES
  db.prepare(`
    CREATE TABLE IF NOT EXISTS group_messages (
      message_id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      group_id INTEGER REFERENCES groups(id),
      sender_id INTEGER REFERENCES users(id),
      contents TEXT,
      attachment TEXT  -- URL or NULL
    );
  `).run();

  // --- DEMO USERS ---
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;

  if (userCount === 0) {
    console.log("Database empty: inserting example users...");
    const exampleUsers = [
      { username: "Peter", password: "pass" },
      { username: "Jori", password: "bug" },
      { username: "Joris", password: "letmein" },
      { username: "Mike", password: "yip" },
      { username: "Keti", password: "123" },
      { username: "Pew", password: "000" }
    ];

    const insertUser = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    const transaction = db.transaction((users) => {
      for (const user of users) insertUser.run(user.username, user.password);
    });
    transaction(exampleUsers);
  } else {
    console.log("Users already present: skipping demo inserts.");
  }

  // --- DEMO GROUPS ---
  const groupCount = db.prepare("SELECT COUNT(*) AS count FROM groups").get().count;

  if (groupCount === 0) {
    console.log("No groups found — inserting demo groups...");

    const exampleGroups = [
      {
        name: "UHasselt Adventure Buddies",
        description: "Exploring Europe one trip at a time!",
        invite_code: "JOIN-UHASS-123",
      },
      {
        name: "Summer Road Trip 2025",
        description: "Friends + car + sun = perfect vacation.",
        invite_code: "SUMMER-ROAD-2025",
      },
      {
        name: "Mountain Lovers",
        description: "Hiking, camping, and nature photography group.",
        invite_code: "MOUNTAIN-LOVE",
      },
    ];

    const insertGroup = db.prepare(
      "INSERT INTO groups (name, description, invite_code) VALUES (?, ?, ?)"
    );
    const insertGroupsTx = db.transaction((groups) => {
      for (const group of groups)
        insertGroup.run(group.name, group.description, group.invite_code);
    });
    insertGroupsTx(exampleGroups);
  } else {
    console.log("Groups already present — skipping demo inserts.");
  }

  // --- DEMO MEMBERSHIPS ---
  const memberCount = db.prepare("SELECT COUNT(*) AS count FROM group_members").get().count;

  if (memberCount === 0) {
    console.log("No group memberships found — inserting demo memberships...");

    const users = db.prepare("SELECT id, username FROM users").all();
    const groups = db.prepare("SELECT id, name FROM groups").all();

    const userByName = Object.fromEntries(users.map((u) => [u.username, u.id]));
    const groupByName = Object.fromEntries(groups.map((g) => [g.name, g.id]));

    const memberships = [
      { user_id: userByName["Keti"], group_id: groupByName["UHasselt Adventure Buddies"], role: "admin" },
      { user_id: userByName["Mike"], group_id: groupByName["UHasselt Adventure Buddies"], role: "member" },
      { user_id: userByName["Jori"], group_id: groupByName["UHasselt Adventure Buddies"], role: "member" },
      { user_id: userByName["Joris"], group_id: groupByName["UHasselt Adventure Buddies"], role: "member" },
      { user_id: userByName["Pew"], group_id: groupByName["UHasselt Adventure Buddies"], role: "member" },
      { user_id: userByName["Peter"], group_id: groupByName["UHasselt Adventure Buddies"], role: "viewer" },
      { user_id: userByName["Keti"], group_id: groupByName["Summer Road Trip 2025"], role: "admin" },
      { user_id: userByName["Keti"], group_id: groupByName["Mountain Lovers"], role: "admin" },
    ];

    const insertMember = db.prepare(
      "INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, ?)"
    );
    const insertMembersTx = db.transaction((members) => {
      for (const m of members)
        insertMember.run(m.user_id, m.group_id, m.role);
    });

    insertMembersTx(memberships);
  } else {
    console.log("Group memberships already present — skipping demo inserts.");
  }

  console.log("Database initialized successfully.");

  // --- DEMO GROUP CHAT MESSAGES ---
  const messageCount = db.prepare("SELECT COUNT(*) AS count FROM group_messages").get().count;

  if (messageCount === 0) {
    console.log("Database empty: inserting example messages...");
    const exampleMessages = [
      {
        sender_id: 5,
        timestamp: "2025-09-27 18:00:00.000",
        group_id: 1,
        contents: "Testing testing hello"
      },
      {
        sender_id: 4,
        timestamp: "2025-09-27 18:02:00.000",
        group_id: 1,
        contents: "Testing received"
      },
      {
        sender_id: 5,
        timestamp: "2025-09-27 18:03:00.000",
        group_id: 1,
        contents: "can you see the messages?"
      },
      {
        sender_id: 5,
        timestamp: "2025-09-27 18:09:00.000",
        group_id: 1,
        contents: "hello?"
      },
      {
        sender_id: 4,
        timestamp: "2025-09-27 18:10:00.000",
        group_id: 1,
        contents: "yep"
      }
    ];

    const insertGroupMsgs = db.prepare("INSERT INTO group_messages (sender_id, timestamp, group_id, contents) VALUES (?, ?, ?, ?)");
    const transaction = db.transaction((groupMessages) => {
      for (const message of groupMessages) insertGroupMsgs.run(message.sender_id, message.timestamp, message.group_id, message.contents);
    });
    transaction(exampleMessages);
  } else {
    console.log("Testing messages already present: skipping demo inserts.");
  }
}

