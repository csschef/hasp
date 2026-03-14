import { subscribeActivePerson } from "../store/entity-store"

class UserHeader extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.shadowRoot!.innerHTML = `
            <style>
                span {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    letter-spacing: -0.01em;
                    transition: color 0.3s ease;
                }
            </style>
            <span id="name">Söker...</span>
        `

        subscribeActivePerson((personId) => {
            const nameEl = this.shadowRoot!.getElementById("name")
            if (nameEl) {
                const name = personId === "person.sara" ? "Sara" : "Sebbe"
                nameEl.textContent = `Välkommen tillbaka ${name}`
            }
        })
    }
}

customElements.define("user-header", UserHeader)
