# Web programming project
## Login credentials
1. Keti, "123"
2. Pew, "000"
3. ...

## (Un)Realized requirements and expansions
### Expansions
- Each group has its own group chat where users can text, there are no file uploads.
- Users have a customisable profile with
  - Profile picture
  - Banner colour
  - Biography
- Users have a unique friend code they can share with others.
- When two people add each other's friend codes, they will become friends and show up in each other's friends list.
- Inviting a person to a group requires you to be friends with them, and requires you to have the necessary permissions to do so.

### Unrealized requirements
- Export trip information to PDF
- Integration for external sources (like Google Photos)
- Offline access to trip data

### Realized requirements
- User authentication with login credentials.
- Users can create and join groups for planning trips.
- Users can propose ideas for activities, accommodations, and day trips (either via the group chat or by creating a poll).
- Voting system for group decision-making (polls).
- Separate front-end views for data entry (expenses, vouchers, tickets) and analysis (budget overview, expense history).
- Layout optimized for both desktop and mobile devices.
- Dynamic maps and street view visualizations of trip plans and activities.
- Clickable interactive maps (not static images).
- Groups have access tiers: admin, members, viewer.
  - Admin rights
    - Inviting friends to group with specific rights (admin/member/viewer)
    - Viewing member list
    - Removing users from the group
    - Changing other people's roles
    - Editing group settings
    - Creating/Deleting (ANY) polls
    - Creating/Deleting (ANY) stops
    - Generating a route
    - Utilising the group chat
  - Member rights
    - Adding members \[if group settings allow it\] with specific rights (member/viewer)
    - Viewing member list
    - Creating/Deleting (THEIR OWN) polls
    - Creating/Deleting (THEIR OWN) stops
    - Viewing the daily planning
    - Generating a route
    - Viewing the group chat
    - Utilising the group chat
  - Viewer rights
    - Viewing member list
    - Viewing the daily planning
    - Generating a route
    - Viewing the group chat
    - Utilising the group chat \[if group settings allow it\]
- API usage:
  - Integration of at least 3 browser APIs.
    - Fetch
    - Clipboard
    - Geolocation
  - Integration of at least 1 external API.
    - Google Maps API
    - Socket IO
- System deployment:
  - Complete Docker setup for easy installation and testing.
  - Includes example data (users, groups, trip content).

## Statement on AI usage
LLMs (specifically ChatGPT and DeepSeek) were used to assist HTML writing while focusing on backend, this code was later mostly refactored. LLMs were also used to generate more complicated one-liners, for example `res.json(stops.map(s => ({ ...s, files: s.files ? JSON.parse(s.files) : [] })));` \[Ln. 419, app.js\].
LLMs were also used in the writing of the testing data for the database, and to assist with general structuring of backend code.

## Local development

install: `npm install`
run: `node app.js`

## Deployment

build: `docker build . -t webprogramming/project`
run: `docker run -it -p 8080:80 webprogramming/project`

## Notes on your submission

- Submit a `groepX_wepr_Naam1_Naam2.zip` in the same structure as you've received this skeleton. This file should be in the root, and all commands should run from the root.
- Don't forget to test the Docker deployment, this is how your project will be evaluated. (Also test from scratch, i.e., how the staff receives it.)
- Make sure there is example data, and it should load with the Docker deployment.
- The README should contain any important information on your project:
  - Login credentials.
  - (Un)Realized requirements and expansions.
  - A statement on AI usage.
- You can include any relevant optional artefacts, e.g., mockups, diagrams, task distribution, timesheets.
- Don't include unnecessary files, e.g., `.git` or `node_modules`.
