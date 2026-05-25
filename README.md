## Air Canvas

A browser-based hand-tracking drawing tool that lets you draw on screen using just your hand and webcam — no mouse, no touch, just gestures.

Built with pure HTML, CSS, and JavaScript using Google's MediaPipe Hands library.

---

##  Gestures

| Gesture           | Action  |
|-------------------|---------|
| Index finger only | Draw    |
| Open palm         | Lift pen|
| Pinky finger only | Erase   |

---

## Features

- **Hand skeleton overlay** — see your hand landmarks live on both the webcam preview and the canvas, color-synced to your brush
- **Draggable webcam preview** — move it anywhere on screen
- **6 preset colors** + custom color picker
- **Brush size control** — adjustable slider
- **Eraser size control** — adjustable slider
- **Light / Dark canvas toggle**
- **Save as PNG** — download your drawing
- **Zero backend** — runs entirely in the browser, no install needed

---

## How to Run

1. Download or clone this repository
2. Open `index.html` in **Chrome** or **Edge**
3. Allow camera access when prompted
4. Wait for MediaPipe to load 
5. Start drawing with your hand 

>>  Requires internet connection to load MediaPipe from CDN.  
>>  Works best in good lighting conditions.

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
|---index.html   
|---style.css 
|---script.js   


## Changelog

### v1.1
- Fixed skeleton drawing permanently on main canvas — now uses separate overlay canvas
- Fixed eraser — now paints background color like MS Paint instead of hole punching
- Fixed webcam drag boundary — can no longer be dragged off the screen
- Removed unused variables

### v1.0
- Initial release


---

##  Author

**Kiran Kumar Moharana** — [@undeclarable](https://github.com/undeclarable)

---
