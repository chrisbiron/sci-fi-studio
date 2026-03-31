# Dither Studio (sci-fi-studio)

## Project Overview
A browser-based dither art tool that converts uploaded images and videos into stylized dither outputs using SVG shapes. Built as a single-page app with vanilla JS and Vite.

**Live site:** https://chrisbiron.github.io/sci-fi-studio/
**Repo:** https://github.com/chrisbiron/sci-fi-studio

## Tech Stack
- **Vanilla JS** (ES modules) — no framework
- **Vite 5.4.21** for dev server and build. Do NOT upgrade Vite — Node is v20.14.0 and Vite 6+ requires Node 20.19+.
- **Canvas API** for real-time rendering
- **MediaRecorder API** for video export

## File Structure
- `index.html` — Main HTML with sidebar controls and canvas layout. Logo is an inline SVG.
- `main.js` — All application logic: file handling, dither rendering, animation, pan/drag, export
- `shapes.js` — SVG shape definitions (Path2D objects + path strings for SVG export). Three density levels: 8-pointed star (dense), 4-pointed star (medium), horizontal bar (sparse)
- `style.css` — Full styling, dark theme, floating sidebar with border-radius
- `favicon.svg` — Site favicon with dark/light mode support via `prefers-color-scheme` media query

## Architecture
- **Rendering pipeline:** Source image/video → offscreen canvas (downsampled to grid) → per-cell luminance calculation (with brightness, contrast, gamma adjustments) → shape selection via 3 thresholds → draw Path2D shapes on output canvas
- **Render loop performance:** Uses `ctx.setTransform()` instead of `save/translate/scale/restore` per cell; brightness/contrast/gamma computed in a single pass with minimal clamping; animation values pre-computed once per frame
- **Animation:** Perlin noise (fbm) applied to luminance values over time. Only available for images, hidden for videos.
- **Video:** Uses requestAnimationFrame loop for live preview, MediaRecorder for MP4/WebM export
- **Pan/drag:** Mouse drag on canvas adjusts panX/panY in source-image space

## Key Conventions
- Asset paths must be **relative** (`./style.css`, `./main.js`) for GitHub Pages compatibility (served from `/sci-fi-studio/` subdirectory)
- All shape coordinates use a 64x64 viewBox (`SHAPE_VIEWBOX`)
- The `.hidden` CSS class uses `display: none !important`
- Animate section (`#animate-section`) is hidden/disabled when a video is uploaded, shown when an image is loaded
- Sidebar floats with 8px spacing from viewport edges, 20px border-radius
- Threshold labels use inline SVG icons matching each shape density level
- Animate speed slider: 0-100 range, default 50 (maps to 1x speed internally via `speedRaw / 50`)
- Placeholder text "Upload an image or video to get started" is centered on the canvas area

## Controls Summary
- **Frame:** Aspect ratio (Original/1:1/16:9/9:16), Image Scale (10-300%), Fit button, pan/drag
- **Adjustments:** Scale (2-50), Gamma, Contrast, Brightness, 3 Thresholds (with SVG shape icons), Invert toggle
- **Animate:** Enable toggle, Strength (0.01-1.0), Speed (0-100). Hidden for video inputs.
- **Colors:** Background and Shape color pickers
- **Export:** SVG/PNG/JPG for images, MP4 for video

## Dev Commands
```bash
npm run dev      # Start Vite dev server (port 5173)
npm run build    # Production build
npm run preview  # Preview production build
```

## Deployment
Static site on GitHub Pages from `main` branch. Push to `main` triggers deploy automatically.
