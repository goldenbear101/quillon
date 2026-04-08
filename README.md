# Skein — Interactive Fiction Workbench

A professional multi-file writing environment for ChoiceScript games.

## Your Setup Steps

### 1. Prerequisites
Make sure you have Node.js installed. Open a terminal and check:
```
node --version   (needs to be v18 or higher)
npm --version
```

### 2. Install dependencies
Navigate to the skein folder and run:
```
cd skein
npm install
```

### 3. Run the app
```
npm run dev
```
This starts both the backend server (port 3001) and the Vite frontend (port 5173).

Open **http://localhost:5173** in your browser.

---

## What each file does

```
skein/
├── server/
│   ├── index.js            — Express server entry point
│   └── routes/
│       ├── projects.js     — Create, import, delete, restore projects
│       ├── scenes.js       — Read/write .txt scene files + error analysis
│       ├── images.js       — Upload/serve/delete project images
│       ├── actions.js      — Activity log (everything that happens)
│       └── run.js          — Sync scenes + launch game in browser
├── src/
│   ├── index.html          — App HTML shell
│   ├── main.js             — App boot, view routing, toast
│   ├── api.js              — All backend fetch calls in one place
│   ├── store.js            — App state
│   ├── components/
│   │   ├── dashboard.js    — Dashboard, New Project, Open Existing
│   │   ├── editor.js       — Scene editor, write mode, image insert
│   │   ├── storymap.js     — Story Map (visual graph)
│   │   ├── analysis.js     — Deep project analysis
│   │   ├── bin.js          — Recycle bin
│   │   ├── actions.js      — Activity log panel
│   │   └── modals.js       — Reusable modal system
│   └── styles/
│       ├── main.css        — Variables, layout, topbar, toast
│       ├── dashboard.css   — Dashboard, project cards, bin
│       ├── editor.css      — Editor, write mode, images
│       ├── modals.css      — Modal dialogs, form fields
│       ├── actions.css     — Activity log panel
│       └── storymap.css    — Story map canvas
├── data/                   — Created automatically, stores all your work
│   ├── projects/           — One folder per project (scenes, images, meta)
│   ├── bin/                — Deleted projects waiting to be permanently removed
│   ├── bin.json            — Recycle bin index
│   └── actions.json        — Activity log
├── package.json
├── vite.config.js
└── README.md
```

## Running your game

When you click the three-dot menu → "Run Game" on any project:
1. Enter the path to your game's `web` folder (where `index.html` lives)
   - e.g. `C:\Users\yourname\Desktop\beast games\web`
2. Skein syncs your latest scene edits back to the game folder
3. The game opens in your browser automatically

The path is saved per project so you only enter it once.

## Importing existing scenes

Click **"Open Existing"** on the dashboard:
1. Enter a project title
2. Click to browse your files and select all your `.txt` scene files at once
3. Skein imports them and auto-fills the title/author from startup.txt

## Image workflow

1. Go to Editor → open a scene → Images tab in the side panel
2. Upload your image (JPG, PNG, WEBP up to 10MB)
3. Click the thumbnail — Skein inserts `*page_break` + `*image filename` at your cursor
4. Skein stores the image inside `data/projects/{id}/images/`
   — You need to also place the same image in your game's `mygame/` folder for it to show when running

## Error checking

The error checker runs automatically on every save. It catches:
- Unknown ChoiceScript commands
- *goto targets that don't exist in the scene  
- *create outside of startup
- *set with no value
- *if with no condition
- Wrong indentation in *choice blocks
- Missing *title, *author, *scene_list in startup
- Image file extension issues
- And more — think of it as Grammarly for ChoiceScript

Click any error in the panel to jump to that line.
