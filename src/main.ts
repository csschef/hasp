import "./styles/tokens.css"
import "./styles/layout.css"
import "./styles/cards.css"

import "./components/toggle-switch"
import "./components/base-card"
import "./components/light-card"
import "./components/light-popup"

import { connectHA } from "./services/ha-client"

console.log("Dashboard starting")

connectHA()
