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
        );
    `).run();

    // FRIENDS
    db.prepare(`
        CREATE TABLE IF NOT EXISTS friend_requests (
            requester_id INTEGER,
            requested_id INTEGER,
            PRIMARY KEY (requester_id, requested_id),
            FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (requested_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `).run();

    // GROUPS
    // groups and trips are essentially the same thing, as we decided to make each group have one trip.
    db.prepare(`
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            description TEXT,
            startDate DATETIME DEFAULT CURRENT_TIMESTAMP, 
            endDate DATETIME DEFAULT CURRENT_TIMESTAMP,
            allowMemberInvite INTEGER DEFAULT 0,
            allowMemberPoll INTEGER DEFAULT 0,
            allowViewerChat INTEGER DEFAULT 0
        );
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
        );
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
        );
    `).run();

    // STOPS
    db.prepare(`
        CREATE TABLE IF NOT EXISTS stops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
            creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            title TEXT,
            description TEXT,
            startDate DATETIME,
            endDate DATETIME,
            coordinates_lat REAL,
            coordinates_lng REAL
        );
    `).run();

    // STOP UPLOADS
    db.prepare(`
        CREATE TABLE IF NOT EXISTS stop_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stop_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        );
    `).run();

    // GROUP CHAT MESSAGES
    db.prepare(`
        CREATE TABLE IF NOT EXISTS group_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id),
            contents TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `).run();

    // GROUP POLLS
    // the allow_multiple int is supposed to act as a boolean, so 0 = false, 1 = true
    db.prepare(`
        CREATE TABLE IF NOT EXISTS group_polls (
            poll_id INTEGER PRIMARY KEY AUTOINCREMENT,  
            group_id INTEGER,
            title TEXT,
            creator_id INTEGER,
            allow_multiple INTEGER,
            end_time TEXT,
            FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )
    `).run();

    // POLL OPTIONS
    db.prepare(`
        CREATE TABLE IF NOT EXISTS poll_options (
            option_id INTEGER PRIMARY KEY AUTOINCREMENT,
            poll_id INTEGER,
            contents TEXT,
            vote_count INTEGER DEFAULT 0,
            FOREIGN KEY (poll_id) REFERENCES group_polls(poll_id) ON DELETE CASCADE
        )
    `).run();

    // VOTES
    db.prepare(`
        CREATE TABLE IF NOT EXISTS poll_votes (
            poll_id INTEGER,
            option_id INTEGER,
            voter_id INTEGER,
            FOREIGN KEY (option_id) REFERENCES poll_options(option_id) ON DELETE CASCADE,
            FOREIGN KEY (poll_id) REFERENCES group_polls(poll_id) ON DELETE CASCADE,
            FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE
        )  
    `).run();

    // --- COMPREHENSIVE DEMO DATA ---
    const demoCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;

    if (demoCount === 0) {
        console.log("Database empty: inserting comprehensive demo data...");
        
        // generate random friend codes - from app.js
        function generateFriendCode() {
            const segment = () =>
                Math.random().toString(36).substring(2, 6).toUpperCase();
            return `${segment()}-${segment()}-${segment()}`;
        }

        function generateUniqueFriendCode() {
            let code;
            let exists;

            do {
                code = generateFriendCode();
                exists = db.prepare("SELECT id FROM users WHERE friend_code = ?").get(code);
            } while (exists);

            return code;
        }

        // ========== USERS ==========
        console.log("Inserting demo users...");
        
        const demoUsers = [
            // Admins
            {
                username: "admin_john",
                password: "password123",
                display_name: "John Travelmaster",
                bio: "Seasoned traveler with 20+ years of experience. Love organizing group trips!",
                bannerColor: "#3498db",
                profilePicture: "john_profile.jpg",
                friend_code: generateUniqueFriendCode()
            },
            {
                username: "sarah_admin",
                password: "$password456",
                display_name: "Sarah Explorer",
                bio: "Adventure photographer and trip planner. Always looking for new destinations!",
                bannerColor: "#e74c3c",
                profilePicture: "sarah_profile.jpg",
                friend_code: generateUniqueFriendCode()
            },
            // Members (regular users)
            {
                username: "mike_adventurer",
                password: "password789",
                display_name: "Mike Mountain",
                bio: "Hiking enthusiast and nature lover. Join me on mountain trails!",
                bannerColor: "#2ecc71",
                profilePicture: "mike_profile.jpg",
                friend_code: generateUniqueFriendCode()
            },
            {
                username: "lisa_beach",
                password: "password012",
                display_name: "Lisa Sunseeker",
                bio: "Beach vacations are my specialty! Tropical destinations expert.",
                bannerColor: "#f1c40f",
                profilePicture: "lisa_profile.jpg",
                friend_code: generateUniqueFriendCode()
            },
            {
                username: "david_city",
                password: "password345",
                display_name: "David Urban",
                bio: "City explorer and food tour guide. Know all the best spots in major cities.",
                bannerColor: "#9b59b6",
                profilePicture: "david_profile.jpg",
                friend_code: generateUniqueFriendCode()
            },
            {
                username: "emma_culture",
                password: "password678",
                display_name: "Emma Culture",
                bio: "History buff and museum enthusiast. Love cultural immersion trips.",
                bannerColor: "#1abc9c",
                profilePicture: "emma_profile.jpg",
                friend_code: generateUniqueFriendCode()
            },
            // Viewers (more passive users)
            {
                username: "tom_viewer",
                password: "password901",
                display_name: "Tom Observer",
                bio: "I enjoy following trip plans and seeing photos from others' adventures.",
                bannerColor: "#95a5a6",
                profilePicture: "tom_profile.jpg",
                friend_code: generateUniqueFriendCode()
            },
            {
                username: "anna_follower",
                password: "password234",
                display_name: "Anna Follower",
                bio: "New to traveling, learning from experienced travelers in the community.",
                bannerColor: "#34495e",
                profilePicture: "anna_profile.jpg",
                friend_code: generateUniqueFriendCode()
            },
            {
                username: "robert_planner",
                password: "password567",
                display_name: "Robert Detailer",
                bio: "Excel at logistics and budgeting. Make every trip cost-effective!",
                bannerColor: "#d35400",
                profilePicture: "robert_profile.jpg",
                friend_code: generateUniqueFriendCode()
            },
            {
                username: "sophia_photo",
                password: "password890",
                display_name: "Sophia Lens",
                bio: "Professional travel photographer. Always capturing the perfect moments.",
                bannerColor: "#16a085",
                profilePicture: "sophia_profile.jpg",
                friend_code: generateUniqueFriendCode()
            }
        ];

        const insertUser = db.prepare(`
            INSERT INTO users (username, password, display_name, bio, bannerColor, profilePicture, friend_code)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const usersTx = db.transaction((users) => {
            for (const user of users) {
                insertUser.run(
                    user.username,
                    user.password,
                    user.display_name,
                    user.bio,
                    user.bannerColor,
                    user.profilePicture,
                    user.friend_code
                );
            }
        });
        usersTx(demoUsers);

        const users = db.prepare("SELECT id, username FROM users").all();
        const userMap = Object.fromEntries(users.map(u => [u.username, u.id]));

        // ========== GROUPS ==========
        console.log("Inserting demo groups...");
        
        const demoGroups = [
            {
                name: "European Backpackers 2026",
                description: "3-week backpacking trip across Europe. Hostels, trains, and lots of walking!",
                startDate: "2026-07-01T00:00:00",
                endDate: "2026-07-21T00:00:00",
                allowMemberInvite: 1,
                allowMemberPoll: 1,
                allowViewerChat: 0
            },
            {
                name: "Ski Trip - Alps 2026",
                description: "Annual ski trip to the French Alps. All skill levels welcome!",
                startDate: "2026-12-15T00:00:00",
                endDate: "2026-12-22T00:00:00",
                allowMemberInvite: 0,
                allowMemberPoll: 1,
                allowViewerChat: 1
            },
            {
                name: "Southeast Asia Adventure",
                description: "Exploring Thailand, Vietnam, and Cambodia for 4 weeks.",
                startDate: "2026-11-01T00:00:00",
                endDate: "2026-11-28T00:00:00",
                allowMemberInvite: 1,
                allowMemberPoll: 0,
                allowViewerChat: 0
            },
            {
                name: "US National Parks Roadtrip",
                description: "2-month roadtrip visiting 10+ national parks across the USA.",
                startDate: "2026-06-01T00:00:00",
                endDate: "2026-07-31T00:00:00",
                allowMemberInvite: 1,
                allowMemberPoll: 1,
                allowViewerChat: 1
            },
            {
                name: "Mediterranean Cruise",
                description: "Luxury cruise visiting Greece, Italy, and Spain.",
                startDate: "2026-08-10T00:00:00",
                endDate: "2026-08-24T00:00:00",
                allowMemberInvite: 0,
                allowMemberPoll: 0,
                allowViewerChat: 1
            }
        ];

        const insertGroup = db.prepare(`
            INSERT INTO groups (name, description, startDate, endDate, allowMemberInvite, allowMemberPoll, allowViewerChat)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const groupsTx = db.transaction((groups) => {
            for (const group of groups) {
                insertGroup.run(
                    group.name,
                    group.description,
                    group.startDate,
                    group.endDate,
                    group.allowMemberInvite,
                    group.allowMemberPoll,
                    group.allowViewerChat
                );
            }
        });
        groupsTx(demoGroups);

        const groups = db.prepare("SELECT id, name FROM groups").all();
        const groupMap = Object.fromEntries(groups.map(g => [g.name, g.id]));

        // ========== GROUP MEMBERSHIP ==========
        console.log("Inserting demo group memberships...");
        
        const demoMemberships = [
            // European Backpackers 2026
            { user_id: userMap["admin_john"], group_id: groupMap["European Backpackers 2026"], role: "admin" },
            { user_id: userMap["mike_adventurer"], group_id: groupMap["European Backpackers 2026"], role: "member" },
            { user_id: userMap["lisa_beach"], group_id: groupMap["European Backpackers 2026"], role: "member" },
            { user_id: userMap["david_city"], group_id: groupMap["European Backpackers 2026"], role: "member" },
            { user_id: userMap["tom_viewer"], group_id: groupMap["European Backpackers 2026"], role: "viewer" },
            
            // Ski Trip - Alps 2026
            { user_id: userMap["sarah_admin"], group_id: groupMap["Ski Trip - Alps 2026"], role: "admin" },
            { user_id: userMap["admin_john"], group_id: groupMap["Ski Trip - Alps 2026"], role: "member" },
            { user_id: userMap["emma_culture"], group_id: groupMap["Ski Trip - Alps 2026"], role: "member" },
            { user_id: userMap["robert_planner"], group_id: groupMap["Ski Trip - Alps 2026"], role: "member" },
            { user_id: userMap["anna_follower"], group_id: groupMap["Ski Trip - Alps 2026"], role: "viewer" },
            
            // Southeast Asia Adventure
            { user_id: userMap["lisa_beach"], group_id: groupMap["Southeast Asia Adventure"], role: "admin" },
            { user_id: userMap["sophia_photo"], group_id: groupMap["Southeast Asia Adventure"], role: "member" },
            { user_id: userMap["tom_viewer"], group_id: groupMap["Southeast Asia Adventure"], role: "member" },
            { user_id: userMap["anna_follower"], group_id: groupMap["Southeast Asia Adventure"], role: "viewer" },
            
            // US National Parks Roadtrip
            { user_id: userMap["mike_adventurer"], group_id: groupMap["US National Parks Roadtrip"], role: "admin" },
            { user_id: userMap["sarah_admin"], group_id: groupMap["US National Parks Roadtrip"], role: "member" },
            { user_id: userMap["david_city"], group_id: groupMap["US National Parks Roadtrip"], role: "member" },
            { user_id: userMap["emma_culture"], group_id: groupMap["US National Parks Roadtrip"], role: "member" },
            { user_id: userMap["robert_planner"], group_id: groupMap["US National Parks Roadtrip"], role: "member" },
            { user_id: userMap["anna_follower"], group_id: groupMap["US National Parks Roadtrip"], role: "viewer" },
            
            // Mediterranean Cruise
            { user_id: userMap["sophia_photo"], group_id: groupMap["Mediterranean Cruise"], role: "admin" },
            { user_id: userMap["lisa_beach"], group_id: groupMap["Mediterranean Cruise"], role: "member" },
            { user_id: userMap["tom_viewer"], group_id: groupMap["Mediterranean Cruise"], role: "viewer" }
        ];

        const insertMember = db.prepare(`
            INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, ?)
        `);

        const membershipsTx = db.transaction((memberships) => {
            for (const m of memberships) {
                insertMember.run(m.user_id, m.group_id, m.role);
            }
        });
        membershipsTx(demoMemberships);

        // ========== INVITES ==========
        console.log("Inserting demo invites...");
        
        const demoInvites = [
            // Pending invites
            { group_id: groupMap["European Backpackers 2026"], inviter_id: userMap["admin_john"], invited_id: userMap["sophia_photo"], role: "member" },
            { group_id: groupMap["Ski Trip - Alps 2026"], inviter_id: userMap["sarah_admin"], invited_id: userMap["david_city"], role: "viewer" },
            { group_id: groupMap["Southeast Asia Adventure"], inviter_id: userMap["lisa_beach"], invited_id: userMap["mike_adventurer"], role: "admin" },
            { group_id: groupMap["US National Parks Roadtrip"], inviter_id: userMap["mike_adventurer"], invited_id: userMap["sophia_photo"], role: "member" }
        ];

        const insertInvite = db.prepare(`
            INSERT INTO invites (group_id, inviter_id, invited_id, role) VALUES (?, ?, ?, ?)
        `);

        const invitesTx = db.transaction((invites) => {
            for (const invite of invites) {
                insertInvite.run(invite.group_id, invite.inviter_id, invite.invited_id, invite.role);
            }
        });
        invitesTx(demoInvites);

        // ========== STOPS ==========
        console.log("Inserting demo stops...");
        
        const demoStops = [
            // European Backpackers stops
            {
                group_id: groupMap["European Backpackers 2026"],
                creator_id: userMap["admin_john"],
                title: "Amsterdam Arrival",
                description: "Arrive at Schiphol Airport, check into hostel, explore canals",
                startDate: "2026-07-01T10:00:00",
                endDate: "2026-07-03T10:00:00",
                coordinates_lat: 52.3676,
                coordinates_lng: 4.9041
            },
            {
                group_id: groupMap["European Backpackers 2026"],
                creator_id: userMap["david_city"],
                title: "Berlin History Tour",
                description: "Visit Berlin Wall, Brandenburg Gate, Museum Island",
                startDate: "2026-07-05T09:00:00",
                endDate: "2026-07-07T18:00:00",
                coordinates_lat: 52.5200,
                coordinates_lng: 13.4050
            },
            {
                group_id: groupMap["European Backpackers 2026"],
                creator_id: userMap["lisa_beach"],
                title: "Prague Castle & Old Town",
                description: "Guided tour of Prague Castle, Charles Bridge walk",
                startDate: "2026-07-08T11:00:00",
                endDate: "2026-07-10T16:00:00",
                coordinates_lat: 50.0755,
                coordinates_lng: 14.4378
            },
            
            // Ski Trip stops
            {
                group_id: groupMap["Ski Trip - Alps 2026"],
                creator_id: userMap["sarah_admin"],
                title: "Chamonix Ski Resort",
                description: "Beginner slopes in the morning, intermediate in afternoon",
                startDate: "2026-12-15T09:00:00",
                endDate: "2026-12-19T17:00:00",
                coordinates_lat: 45.9237,
                coordinates_lng: 6.8694
            },
            {
                group_id: groupMap["Ski Trip - Alps 2026"],
                creator_id: userMap["robert_planner"],
                title: "Après-ski Social",
                description: "Evening gathering at the lodge with hot chocolate",
                startDate: "2026-12-15T19:00:00",
                endDate: "2026-12-15T22:00:00",
                coordinates_lat: 45.9237,
                coordinates_lng: 6.8694
            },
            
            // Southeast Asia stops
            {
                group_id: groupMap["Southeast Asia Adventure"],
                creator_id: userMap["lisa_beach"],
                title: "Bangkok Temples",
                description: "Visit Wat Arun, Wat Phra Kaew, and Grand Palace",
                startDate: "2026-11-01T08:00:00",
                endDate: "2026-11-03T18:00:00",
                coordinates_lat: 13.7563,
                coordinates_lng: 100.5018
            },
            {
                group_id: groupMap["Southeast Asia Adventure"],
                creator_id: userMap["sophia_photo"],
                title: "Angkor Wat Sunrise",
                description: "Early morning photography session at Angkor Wat",
                startDate: "2026-11-10T05:00:00",
                endDate: "2026-11-10T09:00:00",
                coordinates_lat: 13.4125,
                coordinates_lng: 103.8670
            }
        ];

        const insertStop = db.prepare(`
            INSERT INTO stops (group_id, creator_id, title, description, startDate, endDate, coordinates_lat, coordinates_lng)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const stopsTx = db.transaction((stops) => {
            for (const stop of stops) {
                insertStop.run(
                    stop.group_id,
                    stop.creator_id,
                    stop.title,
                    stop.description,
                    stop.startDate,
                    stop.endDate,
                    stop.coordinates_lat,
                    stop.coordinates_lng
                );
            }
        });
        stopsTx(demoStops);

        const stops = db.prepare("SELECT id, group_id FROM stops").all();

        // ========== STOP FILES ==========
        console.log("Inserting demo stop files...");
        
        const demoStopFiles = [
            {
                stop_id: stops[0].id,
                group_id: stops[0].group_id,
                file_name: "amsterdam_itinerary.pdf",
                file_path: "/uploads/amsterdam_itinerary.pdf",
                file_type: "application/pdf",
                file_size: 2048576
            },
            {
                stop_id: stops[0].id,
                group_id: stops[0].group_id,
                file_name: "hostel_confirmation.jpg",
                file_path: "/uploads/hostel_confirmation.jpg",
                file_type: "image/jpeg",
                file_size: 512000
            },
            {
                stop_id: stops[1].id,
                group_id: stops[1].group_id,
                file_name: "berlin_map.png",
                file_path: "/uploads/berlin_map.png",
                file_type: "image/png",
                file_size: 1024000
            },
            {
                stop_id: stops[3].id,
                group_id: stops[3].group_id,
                file_name: "ski_rental_form.pdf",
                file_path: "/uploads/ski_rental_form.pdf",
                file_type: "application/pdf",
                file_size: 153600
            },
            {
                stop_id: stops[5].id,
                group_id: stops[5].group_id,
                file_name: "bangkok_temple_rules.docx",
                file_path: "/uploads/bangkok_temple_rules.docx",
                file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                file_size: 25600
            }
        ];

        const insertStopFile = db.prepare(`
            INSERT INTO stop_files (stop_id, group_id, file_name, file_path, file_type, file_size)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const stopFilesTx = db.transaction((files) => {
            for (const file of files) {
                insertStopFile.run(
                    file.stop_id,
                    file.group_id,
                    file.file_name,
                    file.file_path,
                    file.file_type,
                    file.file_size
                );
            }
        });
        stopFilesTx(demoStopFiles);

        // ========== GROUP MESSAGES ==========
        console.log("Inserting demo group messages...");
        
        const demoMessages = [
            // European Backpackers messages
            {
                group_id: groupMap["European Backpackers 2026"],
                user_id: userMap["admin_john"],
                contents: "Welcome everyone! Let's start planning our European adventure!",
                timestamp: "2026-05-01 09:15:00"
            },
            {
                group_id: groupMap["European Backpackers 2026"],
                user_id: userMap["david_city"],
                contents: "I've uploaded the Berlin itinerary. Please check if the dates work for everyone.",
                timestamp: "2026-05-01 14:30:00"
            },
            {
                group_id: groupMap["European Backpackers 2026"],
                user_id: userMap["lisa_beach"],
                contents: "Found a great deal on hostels in Prague! 20% off if we book this week.",
                timestamp: "2026-05-02 11:45:00"
            },
            {
                group_id: groupMap["European Backpackers 2026"],
                user_id: userMap["tom_viewer"],
                contents: "Excited to follow along with your trip! Take lots of photos please!",
                timestamp: "2026-05-03 16:20:00"
            },
            
            // Ski Trip messages
            {
                group_id: groupMap["Ski Trip - Alps 2026"],
                user_id: userMap["sarah_admin"],
                contents: "Ski rentals are booked! Remember to bring your gloves and goggles.",
                timestamp: "2026-11-10 10:00:00"
            },
            {
                group_id: groupMap["Ski Trip - Alps 2026"],
                user_id: userMap["robert_planner"],
                contents: "I've created a budget spreadsheet for shared expenses. Check your email.",
                timestamp: "2026-11-11 15:45:00"
            },
            
            // Southeast Asia messages
            {
                group_id: groupMap["Southeast Asia Adventure"],
                user_id: userMap["lisa_beach"],
                contents: "Temple dress code reminder: shoulders and knees must be covered.",
                timestamp: "2026-09-15 13:20:00"
            },
            {
                group_id: groupMap["Southeast Asia Adventure"],
                user_id: userMap["sophia_photo"],
                contents: "Sunrise at Angkor Wat is at 5:42 AM. Let's meet at 4:30 to get good spots!",
                timestamp: "2026-09-20 18:05:00"
            }
        ];

        const insertMessage = db.prepare(`
            INSERT INTO group_messages (group_id, user_id, contents, timestamp)
            VALUES (?, ?, ?, ?)
        `);

        const messagesTx = db.transaction((messages) => {
            for (const msg of messages) {
                insertMessage.run(msg.group_id, msg.user_id, msg.contents, msg.timestamp);
            }
        });
        messagesTx(demoMessages);

        // ========== FRIEND REQUESTS ==========
        console.log("Inserting demo friend requests...");
        
        const demoFriendRequests = [
            // Mutual friendships (both directions)
            { requester_id: userMap["admin_john"], requested_id: userMap["sarah_admin"] },
            { requester_id: userMap["sarah_admin"], requested_id: userMap["admin_john"] },
            
            { requester_id: userMap["mike_adventurer"], requested_id: userMap["lisa_beach"] },
            { requester_id: userMap["lisa_beach"], requested_id: userMap["mike_adventurer"] },
            
            { requester_id: userMap["david_city"], requested_id: userMap["emma_culture"] },
            { requester_id: userMap["emma_culture"], requested_id: userMap["david_city"] },
            
            { requester_id: userMap["sophia_photo"], requested_id: userMap["robert_planner"] },
            { requester_id: userMap["robert_planner"], requested_id: userMap["sophia_photo"] },
            
            // One-way pending requests
            { requester_id: userMap["tom_viewer"], requested_id: userMap["admin_john"] },
            { requester_id: userMap["anna_follower"], requested_id: userMap["sarah_admin"] },
            { requester_id: userMap["admin_john"], requested_id: userMap["mike_adventurer"] }
        ];

        const insertFriendRequest = db.prepare(`
            INSERT INTO friend_requests (requester_id, requested_id) VALUES (?, ?)
        `);

        const friendsTx = db.transaction((requests) => {
            for (const req of requests) {
                insertFriendRequest.run(req.requester_id, req.requested_id);
            }
        });
        friendsTx(demoFriendRequests);

        // ========== POLLS ==========
        console.log("Inserting demo polls...");
        
        const now = new Date();
        
        const demoPolls = [
            {
                group_id: groupMap["European Backpackers 2026"],
                title: "Which additional city should we visit?",
                creator_id: userMap["admin_john"],
                allow_multiple: 0,
                end_time: new Date(now.getTime() + 7*24*60*60*1000).toISOString(),
                options: ["Vienna", "Budapest", "Krakow", "Ljubljana"]
            },
            {
                group_id: groupMap["European Backpackers 2026"],
                title: "What type of transportation between cities?",
                creator_id: userMap["david_city"],
                allow_multiple: 1,
                end_time: new Date(now.getTime() + 3*24*60*60*1000).toISOString(),
                options: ["Night trains", "Budget flights", "Buses", "Car rental"]
            },
            {
                group_id: groupMap["Ski Trip - Alps 2026"],
                title: "Evening activity preference",
                creator_id: userMap["sarah_admin"],
                allow_multiple: 1,
                end_time: new Date(now.getTime() + 2*24*60*60*1000).toISOString(),
                options: ["Hot tub sessions", "Board games", "Movie nights", "Local restaurants"]
            },
            {
                group_id: groupMap["Southeast Asia Adventure"],
                title: "Should we add a beach day?",
                creator_id: userMap["lisa_beach"],
                allow_multiple: 0,
                end_time: new Date(now.getTime() - 1*24*60*60*1000).toISOString(), // Ended yesterday
                options: ["Yes, Phuket", "Yes, Koh Samui", "No, stick to culture", "Maybe day trip"]
            },
            {
                group_id: groupMap["US National Parks Roadtrip"],
                title: "Camping or cabins?",
                creator_id: userMap["mike_adventurer"],
                allow_multiple: 0,
                end_time: new Date(now.getTime() + 5*24*60*60*1000).toISOString(),
                options: ["Camping all the way!", "Cabins for comfort", "Mix of both", "Hotels"]
            }
        ];

        const insertPoll = db.prepare(`
            INSERT INTO group_polls (group_id, title, creator_id, allow_multiple, end_time)
            VALUES (?, ?, ?, ?, ?)
        `);

        const insertOption = db.prepare(`
            INSERT INTO poll_options (poll_id, contents) VALUES (?, ?)
        `);

        const insertVote = db.prepare(`
            INSERT INTO poll_votes (poll_id, option_id, voter_id) VALUES (?, ?, ?)
        `);

        const pollsTx = db.transaction((polls) => {
            for (const poll of polls) {
                const result = insertPoll.run(
                    poll.group_id,
                    poll.title,
                    poll.creator_id,
                    poll.allow_multiple,
                    poll.end_time
                );
                const pollId = result.lastInsertRowid;

                // Insert options
                const optionIds = [];
                for (const optionText of poll.options) {
                    const optionResult = insertOption.run(pollId, optionText);
                    optionIds.push(optionResult.lastInsertRowid);
                }

                // Simulate some votes
                const groupMembers = db.prepare(`
                    SELECT user_id FROM group_members WHERE group_id = ?
                `).all(poll.group_id);
                
                // Distribute votes randomly
                for (const member of groupMembers) {
                    if (Math.random() > 0.3) { // 70% of members vote
                        if (poll.allow_multiple) {
                            // Vote for 1-2 options
                            const votesCount = Math.floor(Math.random() * 2) + 1;
                            const shuffled = [...optionIds].sort(() => Math.random() - 0.5);
                            for (let i = 0; i < Math.min(votesCount, shuffled.length); i++) {
                                insertVote.run(pollId, shuffled[i], member.user_id);
                                // Update vote count
                                db.prepare(`
                                    UPDATE poll_options SET vote_count = vote_count + 1 WHERE option_id = ?
                                `).run(shuffled[i]);
                            }
                        } else {
                            // Vote for one option
                            const optionId = optionIds[Math.floor(Math.random() * optionIds.length)];
                            insertVote.run(pollId, optionId, member.user_id);
                            // Update vote count
                            db.prepare(`
                                UPDATE poll_options SET vote_count = vote_count + 1 WHERE option_id = ?
                            `).run(optionId);
                        }
                    }
                }
            }
        });
        pollsTx(demoPolls);

        console.log("   Comprehensive demo data inserted successfully!");
        console.log("   Summary:");
        console.log(`   Users: ${users.length} (admins, members, viewers)`);
        console.log(`   Groups: ${groups.length}`);
        console.log(`   Group Memberships: ${demoMemberships.length}`);
        console.log(`   Stops: ${stops.length}`);
        console.log(`   Stop Files: ${demoStopFiles.length}`);
        console.log(`   Messages: ${demoMessages.length}`);
        console.log(`   Friend Requests: ${demoFriendRequests.length}`);
        console.log(`   Polls: ${demoPolls.length}`);
        console.log(`   Invites: ${demoInvites.length}`);
    } else {
        console.log("Database already contains data: skipping demo inserts.");
    }

    console.log("Database initialized successfully.");
}