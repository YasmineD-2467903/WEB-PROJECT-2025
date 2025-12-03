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
      password TEXT,
      display_name TEXT,
      bio TEXT,
      bannerColor TEXT DEFAULT '#cccccc',
      profilePicture TEXT,
      friend_code TEXT UNIQUE
    ) STRICT;
  `).run();

  // FRIENDS
  db.prepare(`
    CREATE TABLE IF NOT EXISTS friend_requests (
        requester_id INTEGER,
        requested_id INTEGER,
        PRIMARY KEY (requester_id, requested_id),
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (requested_id) REFERENCES users(id) ON DELETE CASCADE
    ) STRICT;
  `).run();

  // GROUPS - DATES AS STRINGS: "MM-DD-YYYY"
  db.prepare(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      startDate TEXT, 
      endDate TEXT
    ) STRICT;
  `).run();

  // INVITES
  db.prepare(`
    CREATE TABLE IF NOT EXISTS invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        inviter_id INTEGER,
        invited_id INTEGER,
        role TEXT CHECK(role IN ('admin','member','viewer')) NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(group_id, invited_id)
    ) STRICT;
  `).run();

  // GROUP MEMBERSHIP
  db.prepare(`
    CREATE TABLE IF NOT EXISTS group_members (
      user_id INTEGER,
      group_id INTEGER,
      role TEXT CHECK(role IN ('admin','member', 'viewer')),
      PRIMARY KEY (user_id, group_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
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
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
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
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    ) STRICT;
  `).run();

  // GROUP CHAT MESSAGES
  db.prepare(`
    CREATE TABLE IF NOT EXISTS group_messages (
      message_id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      sender_id INTEGER REFERENCES users(id),
      contents TEXT,
      attachment TEXT  -- URL or NULL
    );
  `).run();

  // GROUP POLLS - integer 0/1 false/true
  db.prepare(`
    CREATE TABLE IF NOT EXISTS group_polls (
      poll_id INTEGER PRIMARY KEY,  
      group_id INTEGER,
      title TEXT,
      creator_id INTEGER,
      allow_multiple INTEGER,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
  `).run();

  // POLL OPTIONS
  db.prepare(`
    CREATE TABLE IF NOT EXISTS poll_options (
      poll_id INTEGER,
      vote_amounts INTEGER,
      contents TEXT,
      FOREIGN KEY (poll_id) REFERENCES group_polls(poll_id) ON DELETE CASCADE
    )
  `).run();

  // --- DEMO USERS ---
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;

  if (userCount === 0) {
    console.log("Database empty: inserting example users...");
    const exampleUsers = [
      {
        username: "Peter",
        password: "pass",
        friend_code: "ABCD-ABCD-ABCD-EEEE",
        display_name: "Peter Parker",
        bio: "Friendly neighborhood explorer.",
        bannerColor: "#1e90ff",
        profilePicture: "default.png"
      },
      {
        username: "Jori",
        password: "bug",
        friend_code: "ABCD-ABCD-DDDD",
        display_name: "Jori Smith",
        bio: "Love traveling and coffee.",
        bannerColor: "#ff6347",
        profilePicture: "default.png"
      },
      {
        username: "Joris",
        password: "letmein",
        friend_code: "ABCD-ABCD-CCCC",
        display_name: "Joris Van Dam",
        bio: "Hiking enthusiast.",
        bannerColor: "#32cd32",
        profilePicture: "default.png"
      },
      {
        username: "Mike",
        password: "yip",
        friend_code: "ABCD-ABCD-BBBB",
        display_name: "Mike Johnson",
        bio: "Adventure seeker.",
        bannerColor: "#ff1493",
        profilePicture: "default.png"
      },
      {
        username: "Keti",
        password: "123",
        friend_code: "ABCD-ABCD-AAAA",
        display_name: "Keti V.",
        bio: "Travel blogger and chocolate lover.",
        bannerColor: "#ffa500",
        profilePicture: "default.png"
      },
      {
        username: "Pew",
        password: "000",
        friend_code: "ABCD-ABCD-ABCD",
        display_name: "Pew Pew",
        bio: "Just here for the fun.",
        bannerColor: "#8a2be2",
        profilePicture: "default.png"
      }
    ];

    const insertUser = db.prepare(`
      INSERT INTO users (username, password, friend_code, display_name, bio, bannerColor, profilePicture)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((users) => {
      for (const user of users) {
        insertUser.run(
          user.username,
          user.password,
          user.friend_code,
          user.display_name,
          user.bio,
          user.bannerColor,
          user.profilePicture
        );
      }
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
        startDate: "10-10-2025",
        endDate: "10-20-2025"
      },
      {
        name: "Summer Road Trip 2025",
        description: "Friends + car + sun = perfect vacation.",
        startDate: "10-10-2025",
        endDate: "10-20-2025"
      },
      {
        name: "Mountain Lovers",
        description: "Hiking, camping, and nature photography group.",
        startDate: "10-10-2025",
        endDate: "10-20-2025"
      },
    ];

    const insertGroup = db.prepare(
      "INSERT INTO groups (name, description, startDate, endDate) VALUES (?, ?, ?, ?)"
    );
    const insertGroupsTx = db.transaction((groups) => {
      for (const group of groups)
        insertGroup.run(group.name, group.description, group.startDate, group.endDate);
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
        group_id: 2,
        contents: "Testing testing hello"
      },
      {
        sender_id: 4,
        timestamp: "2025-09-27 18:02:00.000",
        group_id: 2,
        contents: "Testing received"
      },
      {
        sender_id: 5,
        timestamp: "2025-09-27 18:03:00.000",
        group_id: 2,
        contents: "can you see the messages?"
      },
      {
        sender_id: 5,
        timestamp: "2025-09-27 18:09:00.000",
        group_id: 2,
        contents: "hello?"
      },
      {
        sender_id: 4,
        timestamp: "2025-09-27 18:10:00.000",
        group_id: 2,
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

  // --- DEMO FRIENDSHIPS ---
  const friendshipCount = db.prepare("SELECT COUNT(*) AS count FROM friend_requests").get().count;

  if (friendshipCount === 0) {
    console.log("No friend requests found — inserting demo friendships...");

    const users = db.prepare("SELECT id, username FROM users").all();
    const userByName = Object.fromEntries(users.map((u) => [u.username, u.id]));

    const friendships = [
      { requester_id: userByName["Keti"], requested_id: userByName["Mike"] },
      { requester_id: userByName["Mike"], requested_id: userByName["Keti"] },

      { requester_id: userByName["Keti"], requested_id: userByName["Jori"] },
      { requester_id: userByName["Jori"], requested_id: userByName["Keti"] },

      { requester_id: userByName["Peter"], requested_id: userByName["Joris"] },
      { requester_id: userByName["Joris"], requested_id: userByName["Peter"] },

      { requester_id: userByName["Pew"], requested_id: userByName["Keti"] },
      { requester_id: userByName["Keti"], requested_id: userByName["Pew"] },
    ];

    const insertFriendship = db.prepare(
      "INSERT INTO friend_requests (requester_id, requested_id) VALUES (?, ?)"
    );

    const insertFriendshipsTx = db.transaction((requests) => {
      for (const fr of requests) insertFriendship.run(fr.requester_id, fr.requested_id);
    });

    insertFriendshipsTx(friendships);
  } else {
    console.log("Friendships already present — skipping demo inserts.");
  }

  // --- DEMO POLLS ---
  const pollCount = db.prepare("SELECT COUNT(*) AS count FROM group_polls").get().count;

  if (pollCount === 0) {
    console.log("No polls found — inserting demo polls...");

    const groups = db.prepare("SELECT id, name FROM groups").all();
    const users = db.prepare("SELECT id, username FROM users").all();

    const groupByName = Object.fromEntries(groups.map(g => [g.name, g.id]));
    const userByName = Object.fromEntries(users.map(u => [u.username, u.id]));

    const examplePolls = [
      {
        poll_id: 1,
        group_id: groupByName["UHasselt Adventure Buddies"],
        title: "Where should our next trip be?",
        creator_id: userByName["Keti"],
        allow_multiple: 0,
        options: [
          "Paris",
          "Rome",
          "Barcelona",
          "Berlin"
        ]
      },
      {
        poll_id: 2,
        group_id: groupByName["UHasselt Adventure Buddies"],
        title: "Preferred hiking difficulty?",
        creator_id: userByName["Jori"],
        allow_multiple: 1,
        options: [
          "Beginner",
          "Intermediate",
          "Advanced",
          "Extreme"
        ]
      },
      {
        poll_id: 3,
        group_id: groupByName["Summer Road Trip 2025"],
        title: "Which snacks should we bring?",
        creator_id: userByName["Mike"],
        allow_multiple: 1,
        options: [
          "Chips",
          "Chocolate",
          "Fruit",
          "Nuts",
          "Energy Bars"
        ]
      },
      {
        poll_id: 4,
        group_id: groupByName["Mountain Lovers"],
        title: "Best time to start hiking?",
        creator_id: userByName["Joris"],
        allow_multiple: 0,
        options: [
          "6:00 AM",
          "7:00 AM",
          "8:00 AM",
          "9:00 AM"
        ]
      }
    ];

    const insertPoll = db.prepare(`
      INSERT INTO group_polls (poll_id, group_id, title, creator_id, allow_multiple)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertOption = db.prepare(`
      INSERT INTO poll_options (poll_id, vote_amounts, contents)
      VALUES (?, ?, ?)
    `);

    const pollTx = db.transaction((polls) => {
      for (const poll of polls) {
        insertPoll.run(
          poll.poll_id,
          poll.group_id,
          poll.title,
          poll.creator_id,
          poll.allow_multiple
        );

        for (const opt of poll.options) {
          insertOption.run(poll.poll_id, 0, opt);
        }
      }
    });

    pollTx(examplePolls);

    console.log("Demo polls inserted.");
  } else {
    console.log("Polls already present — skipping demo inserts.");
  }


}

