# HA Dashboard

A performance-oriented, premium dashboard for **Home Assistant** built with **Vite, TypeScript, and Web Components**.
Designed to provide a fast, responsive, and visually stunning alternative to the default Home Assistant UI.

---

## About

HA Dashboard is a custom frontend for Home Assistant that prioritizes speed and aesthetics. It uses a bespoke component architecture to ensure transitions are smooth and interactions feel instantaneous.

Key design principles:
- **Optimistic UI**: Visual states update immediately upon user interaction without waiting for server confirmation.
- **Pure Web Components**: Built using native browser technologies for maximum performance and longevity.
- **Custom Design System**: A cohesive visual language featuring subtle gradients, glassmorphism, and smooth animations.

---

## Features

- **Instant Feedback**: Light cards and toggles update on the same frame as the click.
- **Dynamic Adaptive Backgrounds**: Cards automatically adjust their background color/gradient based on the light's current color temperature or RGB state.
- **Lucide Iconography**: Integrated stroke-based icons for a clean, professional look.
- **Subview Navigation**: Intelligent routing system for per-room details and controls.
- **History Graphs**: Interactive popups showing historical data for temperature, humidity, and other sensors.
- **Responsive Layout**: Bento-style grid system that adapts seamlessly to desktop and mobile devices.
- **Theme Support**: Built-in toggle for light and dark modes.

---

## Tech Stack

- **TypeScript**
- **Vite** (Build tool and dev server)
- **Vanilla CSS** (Custom CSS variables and utility-first tokens)
- **Web Components** (Shadow DOM for style encapsulation)
- **Home Assistant WebSocket API** (Real-time state synchronization)
- **Lucide Icons**

---

## Architecture

The dashboard is built as a Single Page Application (SPA) where each UI element is a self-contained custom element.

- **Entity Store**: Manages state subscriptions and ensures components only re-render when necessary.
- **Optimistic Layer**: Intercepts user actions to patch the DOM instantly before sending commands to Home Assistant.
- **Color Utility**: Sophisticated math-based color translation from mireds/RGB to UI-ready gradients.

---

## Joint Development Workflow

This project is a collaborative effort between **me** and an **AI Coding Agent (Antigravity)**. It represents a modern approach to software development where human creative direction and architectural oversight are paired with agentic AI execution.

Core areas of collaboration:
- **Human-Directed Design**: Aesthetic decisions, layout structure, and premium feel driven by human vision.
- **AI-Agentic Implementation**: Core logic, component refactoring, and state management handled by the agent.
- **Optimistic UI Logic**: Jointly refined to ensure zero-latency feedback on user interaction.
- **Performance Optimization**: Deep-level DOM patching strategies implemented to eliminate re-renders.
- **SVG Math & Utilities**: Collaborative refinement of color translation and gradient mapping.
- **Project Structure**: Modularization of components and styles for long-term maintainability.

---

## Project Structure

- `src/components/`: Custom Web Components (LightCard, ToggleSwitch, RoomDivider, etc.)
- `src/store/`: State management and entity subscriptions.
- `src/services/`: Home Assistant API interaction layer.
- `src/utils/`: Helper functions for colors, formatting, and history processing.
- `src/styles/`: Core design system, variables, and layout rules.

---

## Installation

### Clone the repository

```bash
git clone https://github.com/csschef/ha-dashboard.git
cd ha-dashboard
npm install
```

### Configuration
Update the connection details in your configuration or environment setup to point to your Home Assistant instance.

### Start the development server

```bash
npm run dev
```

---

## Production Setup

The application is optimized for persistent use on home tablets or wall-mounted displays.

```bash
npm run build
```

The resulting `dist/` folder can be served by any static web server (NGINX, Apache) or integrated directly as a Home Assistant add-on.

---

## License

This project is licensed under the MIT License.
