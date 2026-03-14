# HASP - Home Assistant Simplified Panel

A mobile-first, performance-oriented dashboard for Home Assistant built with Vite, TypeScript, and Web Components.
Designed to be a fast, beautiful, and highly personal alternative to the default Home Assistant UI — optimized for phones with the HA Companion App.

---

## Catalyst & Philosophy

HASP exists because off-the-shelf solutions often reach a limit of expression. This project is driven by two core motivations:

1.  **Creative Freedom**: Native weather, map, and popup cards in Home Assistant are functional but visually rigid. HASP is an exercise in full-stack control, where every pixel, animation, and interaction is designed without the constraints of a generic framework.
2.  **Maintenance Resilience**: In a complex smart home, vendor changes (like the industry shift from mireds to Kelvin) can break dozens of custom YAML-based cards. By consolidating the logic in Antigravity and a centralized TypeScript codebase, we avoid code duplication and can fix breaking changes across the entire dashboard in minutes, not hours.

---

## Design & UX Principles

HASP is built from scratch using native browser technologies — no heavy frameworks, no unnecessary dependencies.

- **Personalized Localized Weather (World-First Innovation)**: Unlike native Home Assistant weather cards which are locked to a single static zone, HASP implements hardware-aware weather. It automatically detects the holder of the phone (Pixel vs. OnePlus) and fetches a decentralized forecast for their specific GPS coordinates. This provides a truly personalized survival tool for multi-user households that Home Assistant does not yet support natively.
- **Hardware-Aware Identity**: Automatically detects who is holding the phone (e.g., Pixel 9 Pro vs. OnePlus 12) via User-Agent fingerprinting, ensuring personalized weather and GPS tracking without manual toggles.
- **Decentralized Weather**: Fetches local weather directly from Open-Meteo, bypassing Home Assistant's internal proxy limits and forbidden headers to ensure zero "Failed to fetch" errors on mobile devices.
- **Optimistic UI**: Visual states update instantly on tap, never waiting for server confirmation.
- **Micro-Animations**: Fluid transitions for subviews and sheet-style popups that feel like a native iOS/Android application.

---

## Key Features

- **Personalized Welcome**: Automatic user detection and greeting system based on the physical device.
- **Dynamic Weather Hero**: High-resolution custom icons, real-time reverse geocoding for city names, and feels like temperature calculations.
- **Hardware-Sync Person Cards**: Satellite-imagery mapping and battery tracking synced to the specific user's hardware.
- **Premium TV Remote**: A custom interactive popup with D-pad, haptic-ready volume controls, and app-switching logic.
- **History Visualization**: Real-time sensor history graphs for temperature and humidity.
- **Adaptive Lighting**: Cards that automatically generate color gradients based on the current state of light groups (Color Temp or RGB).

---

## Tech Stack

- **TypeScript** (Core logic and strict typing)
- **Vite** (Next-gen build tool and HMR dev server)
- **Vanilla CSS** (Custom properties and hardware-accelerated animations)
- **Web Components** (Shadow DOM for style encapsulation)
- **Home Assistant WebSocket API** (Real-time state synchronization)
- **BigDataCloud / Open-Meteo API** (Decentralized location and weather engine)

---

## Project Structure

```
src/
├── components/   # Hardware-aware Web Components (WeatherCard, UserHeader, LightCard)
├── store/        # State management and identity tracking (entity-store.ts)
├── services/     # Home Assistant WebSocket client and hardware detection
├── utils/        # Color math, geocoding logic, and data formatting
├── styles/       # Design tokens (tokens.css) and layout systems
public/
└── weather/      # Custom high-quality weather iconography
```

---

## Joint Development

HASP is a collaborative effort between me, a human creative director and an AI Coding Agent (Antigravity). This workflow allows for rapid iteration: I identify the UX friction points (like broken sensor logic or rigid YAML), and the AI architecting a robust, scalable TypeScript solution instantly.

---

## Installation & Build

### 1. Setup
```bash
git clone https://github.com/csschef/hasp.git
cd hasp
npm install
```

### 2. Deployment
```bash
# Start local development with HMR
npm run dev -- --host

# Build for production
npm run build
```

The contents of the dist/ folder should be copied to your Home Assistant www/dashboard/ directory.

---

## License
MIT
