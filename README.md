# HASP - Home Assistant Simplified Panel

A mobile-first, performance-oriented dashboard built for Home Assistant using Vite, TypeScript, and Web Components. Designed to be a fast, beautiful, and highly personal alternative to the default Home Assistant UI.

[![Watch the video](https://img.youtube.com/vi/z9kERnG80_k/maxresdefault.jpg)](https://youtube.com/shorts/z9kERnG80_k)

---

## Why I Built This

I hit a ceiling with standard Home Assistant dashboards. I wanted a UI that felt polished, fast, and truly personal, the kind of experience you'd expect from a native iOS or Android app, not a configuration file.

### YAML Hell

In a complex smart home, a single vendor change (like the shift from mireds to Kelvin) can break dozens of custom cards across an entire dashboard. By building from scratch in TypeScript, I have a **single source of truth**: fix the core once, and every card in the dashboard is updated. No hunting through thousands of lines of YAML.

### Full Creative Control

Standard Lovelace is functional but constrained. Building my own panel gave me:

- **Custom animations** - fluid iOS-style sheet popups and view transitions
- **Optimistic UI** - toggles react instantly without waiting for the server
- **A unified design system** - every color, shadow, spacing value, and animation follows my own token-based CSS system

---

## Features

### Location-Based Personalized Weather

This is one of the more unique parts of HASP. The weather card doesn't use a fixed location or a generic HA weather integration. Instead, it reads the **actual GPS coordinates of the physical device** being used to view the dashboard.

When you open the dashboard on your phone, it detects which device it's running on (using HA's device registry), fetches the current GPS position for that specific device entity, and then makes a direct API call to **Open-Meteo** using those exact coordinates. The reverse geocoding (turning GPS coordinates into a city name) is handled by **BigDataCloud**, also using live coordinates.

The result: if you're at home, you see the weather at home. If someone else in your household opens the dashboard at work 20 kilometers away, they see the weather at their exact location, a completely different forecast. No configuration required on either end. It just works.

This bypasses HA's internal proxy and all the limitations that come with it, giving near-instant load times on mobile.

The weather card is collapsible: tapping it expands to reveal the full forecast. It shows:
- Current temperature and "feels like" (both from Open-Meteo's `apparent_temperature`)
- Weather condition with custom PNG icons (SVG versions are planned)
- Location name via reverse geocoding
- Sunrise and sunset times from HA's `sun.sun` entity
- Switchable hourly and daily forecast strips with icons, temperatures, and precipitation

---

### Solved Back Navigation in HA Companion App

One of the trickier problems to solve was getting the Android back button to behave correctly inside a Home Assistant Companion App WebView. The dashboard runs inside an `<iframe>` in HA's WebView, which means Android monitors the **parent window's** history stack, not the iframe's. Pressing back in a custom `panel_custom` would normally exit the app immediately or do nothing.

HASP solves this by pushing a "sentinel" entry to `window.parent.history` on load and after every user interaction (using `touchend` for user-activation context). When Android consumes the sentinel via a back gesture, HASP immediately re-pushes it, keeping the stack alive. The iframe's own `popstate` handler then takes care of closing popups, dismissing the tray, and navigating back through subviews in the correct order.

- Pressing back inside a popup closes the popup
- Pressing back with the tray open closes the tray
- Pressing back inside a subview returns to the main view
- Pressing back on the root view is safely absorbed by the sentinel

No freezes, no unexpected exits, no double-back-to-close workarounds.

---

### Custom Map Views

Tapping a person card opens a popup with a full Leaflet map using Google Hybrid satellite tiles (high-resolution satellite imagery with street labels). The map shows:

- A profile photo marker for each person in the household at their current GPS position
- Zone overlays drawn as circles with labels for zones defined in HA (Home, Work, etc.)
- Marker clustering when two people are at the same location, with a tap-to-expand interaction

All data comes from HA's `person` and `zone` entity domains via WebSocket, updating live.

---

### Colored Light Card Backgrounds

Each light card generates a gradient background based on the current state of the light or light group it represents. Warm color temperatures shift the card toward amber tones, cool temperatures push it toward icy blue, and off-states collapse to a neutral dark tone. The transition is smooth and happens in sync with the actual light change - it makes the dashboard feel alive and visually connected to the real state of the room.

---

### Light Popup Controls

Light popups include a set of custom-built controls that adapt to what the light actually supports:

- **Brightness slider** - a gradient bar from dim orange to bright yellow with a draggable thumb
- **Color temperature slider** - a warm-to-cool gradient bar (blue to orange) mapped to the light's actual Kelvin range
- **Color wheel** - a full conic gradient wheel with a radial white overlay for saturation, lets you pick any HS color

None of these use native HTML `<input type="range">`. They are built on pointer events with `setPointerCapture` for robust drag behavior on touch screens. Updates are debounced (60-80ms) to avoid flooding HA with WebSocket calls while still feeling instant.

---

### Sensor History Popup with Bar Charts

Sensor cards (temperature, humidity) have a tappable history button that opens a full-screen popup with a scrollable bar chart. It loads the last 7 days of data from HA's history API, bucketed by hour, and color-codes the bars by value range (cool blue for below 20°C, green up to 22°C, yellow up to 25°C, red above). A y-axis keeps the scale readable and the chart auto-scrolls to the most recent hour when it opens.

---

### Energy View with Electricity Price Chart

The Energy view shows the current Nordpool spot price (öre/kWh) with a color-coded hero card that indicates whether the price is cheap, normal, or expensive relative to the rest of the day. Below that is a scrollable SVG bar chart showing today's and tomorrow's hourly prices, colored green/yellow/red per bar, with a dashed "now" indicator that auto-scrolls to the current hour on load.

At the bottom of the view an advice card calculates the cheapest 3-hour window remaining in the day (or tomorrow if no good windows are left) and displays it as a plain text tip.

---

### Drag-and-Drop Shopping List

The Meals view includes a full shopping list backed by HA's todo entity. Items can be reordered with a drag handle using native HTML drag-and-drop, with visual drop-target indicators and flicker-prevention during active drags. Tapping an item opens an edit popup where you can rename it, add a quantity/description, or delete it. Completed items are separated visually at the bottom of the list. All changes sync to HA in real time.

---

### Smart Notifications and Tray

A notification bell in the top bar shows a count badge and lights up when any configured entity triggers a notification condition. Tapping the top bar reveals a notification list, currently configured for:

- Cat litter counters (triggers when the `counter` entity exceeds a threshold)
- Mail in the mailbox (triggers when a boolean is `on`)

Each notification shows its current value and has inline action buttons that call HA services directly (increment/decrement for counters, turn off for booleans). The same top bar also slides down a tray with quick-toggle tiles for Guest Mode, Sleep Mode, and Movie Mode (each backed by HA `input_boolean` entities), plus a light/dark theme toggle.

There's also a separate system update badge that monitors HACS and all `update.*` entities and shows a dot when updates are available.

---

### TV Remote Popup

A custom popup styled like a physical remote with a circular D-pad, volume oval, and round action buttons. Controls include:

- D-pad (up/down/left/right/center) via HA's `remote.send_command` service
- Volume up/down and mute
- Back and Home buttons
- Play/pause
- HDMI and TV input switching via ADB commands (`androidtv.adb_command`) targeting the Android TV

The popup automatically integrates with a soundbar entity and a media player entity in addition to the main TV/remote entity.

---

### Device Identity and Multi-User Awareness

The dashboard detects which device is being used and greets accordingly. The main header shows the correct person's name and profile image based on who's holding the phone. Tracking data (location, battery, activity) on person cards is also scoped to the active device.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Core logic | TypeScript |
| Build tool | Vite |
| Styling | Vanilla CSS with custom properties |
| Components | Web Components (Shadow DOM) |
| Real-time sync | Home Assistant WebSocket API |
| Weather | Open-Meteo (direct, decentralized) |
| Geocoding | BigDataCloud (reverse geocoding by GPS) |

---

## Notable Implementation Details

### Auto Cache-Busting

Every `npm run build` stamps a build timestamp into the bundle via a `VITE_BUILD_TS` environment variable. On page load, HASP compares this timestamp against the one stored in `localStorage`. If they differ, it wipes all Cache Storage entries and forces a hard reload. This means HA Companion App WebViews always pick up the latest build automatically without the user needing to clear the cache manually.

### Auto Theme Based on Sun Elevation

The theme switches automatically based on the sun's elevation: dark mode kicks in below -3° (civil twilight), light mode returns above +5°. A buffer zone between these values prevents rapid toggling at dusk and dawn.

---

## Development

HASP was built in collaboration with Antigravity (AI). This let me stay focused on design decisions, UX friction points, and the overall architecture while we worked together on the codebase - turning hundreds of fragile YAML configs into a maintainable TypeScript project.

---

## Installation

```bash
# Clone and install
git clone https://github.com/csschef/hasp.git
cd hasp
npm install

# Copy the example env and fill in your details
cp .env.example .env

# Development server (accessible on your local network)
npm run dev -- --host

# Production build
npm run build
```

Copy the contents of `dist/` to your Home Assistant `www/` directory. Then add a `panel_custom` entry in your HA configuration to load it as a full-screen panel.

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_HA_URL` | URL to your Home Assistant instance |
| `VITE_HA_TOKEN` | Long-lived access token from your HA profile |
| `PERSON_1` | Entity ID for the first person (e.g. `person.sebastian`) |
| `PERSON_2` | Entity ID for the second person (e.g. `person.sara`) |

---

## License

MIT
