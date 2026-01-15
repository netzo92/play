# 🌍 Simple MMO

A lightweight HTML5 multiplayer online game, deployable to Netlify.

![Game Preview](https://via.placeholder.com/600x400?text=Simple+MMO+Preview)

## Features

- 🎮 **Real-time multiplayer** - See other players move in real-time
- 🚀 **Netlify-ready** - Deploy in seconds, no server required
- 🎨 **Smooth animations** - 60fps canvas rendering with interpolation
- 📱 **Responsive** - Works on desktop and mobile
- ⚡ **Lightweight** - No build step, pure HTML/CSS/JS

## Quick Start

### 1. Clone & Run Locally

```bash
# Serve the files locally
npx serve .

# Or just open index.html in your browser
```

### 2. Enable Multiplayer (Optional)

1. Sign up at [ably.com](https://ably.com) (free tier: 6M messages/month)
2. Create an app in your Ably dashboard
3. Copy your API key
4. Edit `main.js` and replace `YOUR_ABLY_API_KEY_HERE` with your key

### 3. Deploy to Netlify

**Option A: Drag & Drop**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag this folder onto the page
3. Done! 🎉

**Option B: Git Deploy**
1. Push this repo to GitHub
2. Connect it to Netlify
3. Auto-deploys on every push

**Option C: CLI**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

## Controls

- **WASD** or **Arrow Keys** - Move your character
- See other players in real-time!

## Tech Stack

- **Frontend**: Vanilla HTML5 Canvas + JavaScript
- **Multiplayer**: [Ably](https://ably.com) real-time messaging
- **Hosting**: Netlify (static hosting)

## Project Structure

```
├── index.html      # Main HTML file
├── styles.css      # Game styling
├── game.js         # Game engine & rendering
├── multiplayer.js  # Ably multiplayer logic
├── main.js         # Entry point & initialization
├── netlify.toml    # Netlify configuration
└── README.md       # This file
```

## License

MIT - Do whatever you want with it! 🎉
