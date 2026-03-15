# HASP - Home Assistant Simplified Panel

A mobile-first, performance-oriented dashboard I built for Home Assistant using Vite, TypeScript, and Web Components. Designed to be a fast, beautiful, and highly personal alternative to the default Home Assistant UI.

<div align="center">
  <table>
    <tr>
      <td><img src="https://github.com/user-attachments/assets/29b1d333-d513-49be-aeba-2bdc80c60f57" width="230" alt="Dashboard 1"></td>
      <td><img src="https://github.com/user-attachments/assets/a9171ce4-a0ea-4033-a996-41291629f5cb" width="230" alt="Dashboard 2"></td>
      <td><img src="https://github.com/user-attachments/assets/6312dd95-6de5-4244-b425-a6b4365509ee" width="230" alt="Dashboard 3"></td>
      <td><img src="https://github.com/user-attachments/assets/0e572715-0a53-4dd5-a20e-4a33cf158009" width="230" alt="Dashboard 4"></td>
    </tr>
    <tr>
      <td><img src="https://github.com/user-attachments/assets/9910683d-0bd5-4a60-b0f3-cf5965a01c26" width="230" alt="Dashboard 5"></td>
      <td><img src="https://github.com/user-attachments/assets/1a3328c5-ec14-4ec7-a774-d6597d736cf2" width="230" alt="Dashboard 6"></td>
      <td><img src="https://github.com/user-attachments/assets/63c22fca-9703-48a2-9a8b-24ae8052c17a" width="230" alt="Dashboard 7"></td>
      <td><img src="https://github.com/user-attachments/assets/e13f44ed-b6f5-4adb-821b-f6fbd7dd1e50" width="230" alt="Dashboard 8"></td>
    </tr>
    <tr>
      <td><img src="https://github.com/user-attachments/assets/b64a0c70-c2cd-4957-8e3b-a8c8e2d881f4" width="230" alt="Dashboard 9"></td>
      <td><img src="https://github.com/user-attachments/assets/293e0739-d30e-4870-ae36-66548397a29b" width="230" alt="Dashboard 10"></td>
      <td><img src="https://github.com/user-attachments/assets/3bc165ad-9f50-4f9a-82cb-ad0ab10f0af5" width="230" alt="Dashboard 11"></td>
      <td><img src="https://github.com/user-attachments/assets/306846c8-9592-49b0-93ab-548df99711aa" width="230" alt="Dashboard 12"></td>
    </tr>
  </table>
</div>


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

- **Personalized Weather Map**: Most weather cards are static. Home Assistant doesn't natively support personalized weather maps. Mine detects which device is being used (e.g., my Oneplus 12 vs. another phone) and fetches a decentralized local forecast for that specific GPS spot. It turns the dashboard into a personalized tool for whoever is holding it.
- **Device Identity**: The dashboard automatically greets the user and adjusts its tracking data based on the hardware it's running on, making it truly multi-user aware.
- **Decentralized Performance**: I fetch weather and geocoding data directly (bypassing HA's internal proxy limits) to ensure zero loading failures and absolute speed on mobile companion apps.

## Key Features

- **Weather Hero**: High-res custom icons, reverse geocoding for city names, and "feels like" temp math.
- **Premium TV Remote**: A custom interactive popup with D-pad and haptic-ready controls.
- **Data History & Trends**: Real-time sensor history graphs for temperature and humidity integrated directly into cards. I can instantly see how the house has cooled or warmed over the last 24 hours without leaving the main view.
- **Adaptive Lighting**: Cards that generate background color gradients based on the current state of light or lightgroups.
- **Smart Top Bar & Notifications**: 
  - A dynamic notification system (e.g., "Empty the cat litter box" or "The dishwasher is done" or "Postman has arrived") with interactive action buttons.
  - A hidden "Tray" that slides down to provide quick toggles for Guest Mode, Sleep Mode, and Theme switching.
- **Native Bottom Navigation**: A persistent dock for switching between main views (in my case Home, Kitchen, Energy) with smooth icon transitions and active state tracking.

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
