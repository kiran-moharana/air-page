# Air-Page

A browser-based hand-tracking drawing tool that lets you draw on screen using just your hand and webcam — no mouse, no touch, just gestures.

Built with pure HTML, CSS, and JavaScript using Google's MediaPipe Hands library.

---

##  Gestures

| Gesture | Action |
|--------|--------|
|  Index finger only | Draw |
|  Open palm | Lift pen (stop drawing) |
|  Pinky finger only | Erase |

---

## Features

- **Hand skeleton overlay** — see your hand landmarks live on both the webcam preview and the canvas, color-synced to your brush
- **Draggable webcam preview** — move it anywhere on screen
- **6 preset colors** + custom color picker
- **Brush size control** — adjustable slider
- **Eraser size control** — adjustable slider
- **Light / Dark canvas toggle**
- **Save as PNG** — download your drawing
- **No Data Sharing** — runs locally in the browser, no install needed

---

## How to Run

1. Open `index.html` in **Chrome** or **Edge** or in any browser
2. Allow camera access when prompted
3. Wait for MediaPipe to load
4. Start drawing with your hand 

>  Requires internet connection to load MediaPipe from CDN.  
>  Works best in good lighting conditions.

---

## Tech Stack

- HTML5 Canvas API
- CSS3
- Vanilla JavaScript
- [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) (via CDN)

---

## File Structure

```
air-canvas/
|-- index.html   
|-- style.css    
|-- script.js    
```

---

## Author

Kiran Kumar Moharana — [@kiran-moharana](https://github.com/kiran-moharana)

---

## Changelog

### v2.4
- Eraser is now round instead of square in hand mode
- Round eraser indicator shows exact erase area with red outline and soft fill
- White highlight ring around eraser indicator for visibility on all backgrounds
- Center dot shows precise erase point
- Eraser indicator clears automatically when hand is lifted or lost


### v2.3
- Added Undo and Redo support
- Ctrl+Z to undo, Ctrl+Y to redo
- Works for drawing, erasing, and clear canvas actions


### v2.2
- Added brush type selector — Brush, Marker, and Pen
- Brush type works in both Hand Mode and Mouse Mode


### v2.1
- Fixed drawing breaks at certain positions in Mouse Mode
- Added right click to erase in Mouse Mode — left click draws, right click erases
- Added rectangle eraser cursor in Mouse Mode showing exact erase area with red outline and highlight
- Fixed stroke connection between separate mouse clicks — lines no longer connect across clicks
- Context menu disabled on canvas to allow right click erasing


### v2.0
- Added Mouse Mode — toggle between Hand Mode and Mouse Mode from top right panel
- Custom brush cursor in Mouse Mode — colored circle matching brush color with white highlight
- Cursor size matches current brush size and updates in real time
- Click and drag to draw with mouse in Mouse Mode
- Hand skeleton hidden in Mouse Mode to avoid confusion
- Gesture guide hidden in Mouse Mode since gestures are inactive


### v1.6
- Drawing stops immediately when pen is lifted — no more trailing strokes after gesture change
- Reduced grace period from 10 to 3 frames for faster response to hand loss
- Index finger buffer cleared when switching to erase mode — no position bleed
- Pinky buffer cleared when switching to draw mode — clean start every time


### v1.5
- Added moving average smoothing — recent frames count more than older versions
- Added lerp interpolation — hand position moves fluidly instead of jumping
- Added velocity check — tracking errors that move too fast are ignored automatically
- Added minimum movement threshold — micro-jitter under 3px is filtered out
- Added hand loss grace period — brief hand disappearance no longer resets drawing
- Eraser position is also smoothed for consistent erasing


### v1.4
- Added gesture confirmation buffer — gesture must be held for 5 consecutive frames before switching
- Added landmark visibility filtering — weak or partially visible hand detections are ignored
- Added gesture cooldown — 300ms must pass before another gesture switch is allowed
- Increased hand detection confidence threshold to 0.75 for more reliable detection
- Gesture switching is now stable and does not flicker accidentally


### v1.3
- Drawing now scales with window resize — fixed resolution offscreen canvas used as source of truth
- Resizing or minimizing the window no longer erases any part of the drawing
- Saved PNG exports at full 1920x1080 resolution regardless of window size


### v1.2
- Improved loading screen — staged messages, slow network warning 
- Added version tag — bottom right corner, color synced with light/dark theme toggle

### v1.1
- Fixed skeleton drawing permanently on main canvas — now uses separate overlay canvas
- Fixed eraser — now paints background color like MS Paint instead of punching holes
- Fixed webcam drag boundary — can no longer be dragged off screen
- Fixed loading overlay — now hides on first real MediaPipe frame, not a blind timer
- Removed unused variables — isDrawing, thumb, w/h params in drawSkeleton

### v1.0
- Initial release
