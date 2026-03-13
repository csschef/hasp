# HASP — Home Assistant Simplified Panel

A **mobile-first**, performance-oriented dashboard for **Home Assistant** built with **Vite, TypeScript, and Web Components**.
Designed to be a fast, beautiful, and highly personal alternative to the default Home Assistant UI — optimized for phones and tablets with the HA Companion App.

---

## About

HASP is a custom frontend for Home Assistant that prioritizes speed, aesthetics, and touch usability. It is built entirely from scratch using native browser technologies — no heavy frameworks, no unnecessary dependencies.

Key design principles:
- **Optimistic UI**: Visual states update instantly on tap, never waiting for server confirmation.
- **Pure Web Components**: Shadow DOM encapsulation for maximum performance and style isolation.
- **Mobile-First**: Every layout, interaction, and animation is designed for finger-sized targets and small screens.
- **Custom Design System**: A cohesive visual language with curated gradients, glassmorphism, and fluid micro-animations.

---

## Features

- **Instant Feedback**: Cards and toggles update on the same frame as the tap — zero perceptible latency.
- **Dynamic Adaptive Backgrounds**: Cards automatically adjust their background gradient based on the light's color temperature or RGB state.
- **Person Tracking & Maps**: Premium, Apple-style person cards with high-resolution satellite imagery (Esri World Imagery) and dynamic map markers.
- **Advanced Weather Dashboard**: Intelligent weather component with dynamic icon mapping, calculated "feels like" temperature, and real-time reverse geocoding for precise local forecasts.
- **TV Remote Popup**: A full-featured, premium in-app remote control with D-pad, volume oval, and app-switching.
- **Lucide Iconography**: Consistent stroke-based SVG icons throughout for a clean, professional look.
- **Subview Navigation**: Fluid per-room subview routing with sheet-style transitions.
- **History Graphs**: Interactive popups showing historical sensor data (temperature, humidity, etc.).
- **Theme Support**: Built-in light/dark mode toggle with persistent storage.

---

## Tech Stack

- **TypeScript**
- **Vite** (Build tool and dev server)
- **Vanilla CSS** (Custom properties and design tokens — no Tailwind)
- **Web Components** (Shadow DOM for style encapsulation)
- **Home Assistant WebSocket API** (Real-time state synchronization)
- **Lucide Icons** (Inline SVGs)

---

## Architecture

HASP is a Single Page Application (SPA) where every UI element is a fully self-contained custom element.

- **Entity Store**: Manages WebSocket subscriptions and ensures components only re-render when their specific state changes.
- **Optimistic Layer**: Intercepts user actions to patch the DOM instantly before sending commands to Home Assistant.
- **Color Utility**: Math-based color translation from mireds/RGB to card-ready gradients, with smart fallbacks for mixed light groups.

---

## Project Structure

```
src/
├── components/   # Custom Web Components (LightCard, TvCard, WeatherCard, etc.)
├── store/        # State management and entity subscriptions
├── services/     # Home Assistant WebSocket API layer
├── utils/        # Color translation, history processing, data formatting
├── styles/       # Design tokens, layout, and global card styles
public/
└── weather/      # Custom high-resolution weather icon set
```

---

## Joint Development

HASP is a collaborative project between a human creative director and an **AI Coding Agent (Antigravity)**. Human vision drives aesthetics, UX direction, and product decisions. The AI handles implementation, component architecture, and state management logic.

---

## Installation

### Clone the repository

```bash
git clone https://github.com/csschef/hasp.git
cd hasp
npm install
```

### Development server

```bash
npm run dev -- --host
```

### Build for production

```bash
npm run build
```

The `dist/` folder can be served by any static web server (NGINX, Apache) or deployed directly into Home Assistant as a frontend add-on.

---

## License

MIT
