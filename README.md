# HASP - Home Assistant Simplified Panel

A mobile-first, performance-oriented dashboard I built for Home Assistant using Vite, TypeScript, and Web Components. Designed to be a fast, beautiful, and highly personal alternative to the default Home Assistant UI.

## Why I Built This

I created HASP because I hit a limit with standard Home Assistant dashboards. I wanted a UI that felt like a premium native app, not a collection of boxes on a webpage. 

### 1. Frustration with Custom Cards
I got tired of the "YAML hell" and constant maintenance. In a complex smart home, a single vendor change (like the shift from mireds to Kelvin) can break dozens of custom cards. By building the dashboard from scratch in TypeScript, I have a **single source of truth**. I can fix a breaking change across every card in minutes by updating the core code, rather than hunt through thousands of lines of configuration.

### 2. High-End UI & UX
Standard HA dashboards are functional but can feel rigid. I wanted full creative control to implement:
- **Custom Animations**: Fluid transitions and iOS-style sheet popups that aren't possible with standard Lovelace.
- **Micro-interactions**: Instant "Optimistic UI" updates where toggles react immediately without waiting for the server.
- **Premium Design**: A unified aesthetic where every pixel, from the typography to the custom gradients, follows my personal design system.

## What Makes This Different

Unlike standard dashboards or generic custom cards, HASP implements several "hardware-aware" innovations:

- **Personalized Weather Map**: Most weather cards are static. Mine detects which device is being used (e.g., my Oneplus 12 vs. another phone) and fetches a decentralized local forecast for that specific GPS spot. It turns the dashboard into a personalized tool for whoever is holding it.
- **Device Identity**: The dashboard automatically greets the user and adjusts its tracking data based on the hardware it's running on, making it truly multi-user aware.
- **Decentralized Performance**: I fetch weather and geocoding data directly (bypassing HA's internal proxy limits) to ensure zero loading failures and absolute speed on mobile companion apps.

## Key Features

- **Weather Hero**: High-res custom icons, reverse geocoding for city names, and "feels like" temp math.
- **Premium TV Remote**: A custom interactive popup with D-pad and haptic-ready controls.
- **History Visualization**: Real-time sensor history graphs integrated directly into the cards.
- **Adaptive Lighting**: Cards that generate background color gradients based on the current state of light or lightgroups.

## Tech Stack

- **TypeScript** (Core logic and strict typing)
- **Vite** (Next-gen build tool and HMR dev server)
- **Vanilla CSS** (Custom properties and hardware-accelerated animations)
- **Web Components** (Shadow DOM for style encapsulation)
- **Home Assistant WebSocket API** (Real-time state synchronization)
- **BigDataCloud / Open-Meteo API** (Decentralized location and weather engine)

## Development

I developed HASP in collaboration with Antigravity (AI). This allowed me to focus on the design, UX friction points, and overall architecture while we worked together to build a robust, scalable codebase that replaces hundreds of fragile YAML configs with solid TypeScript.

## Installation

```bash
# Setup
git clone https://github.com/csschef/hasp.git
npm install

# Development
npm run dev -- --host

# Production
npm run build
```

The contents of the `dist/` folder go into your Home Assistant `www/` directory.

## License
MIT
