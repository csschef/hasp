import { subscribeActivePerson, subscribeEntity } from "../store/entity-store"
import { HA_URL } from "../services/ha-client"

class UserHeader extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
        
        subscribeActivePerson((personId) => {
            if (!personId) return
            subscribeEntity(personId, (entity: any) => {
                this.update(entity)
            })
        })
    }

    private update(entity: any) {
        if (!entity) return
        
        const nameEl = this.shadowRoot!.getElementById("name")
        const imgEl = this.shadowRoot!.getElementById("avatar") as HTMLDivElement
        
        if (nameEl) nameEl.textContent = entity.attributes.friendly_name || ""
        
        if (imgEl) {
            let picture = entity.attributes.entity_picture
            if (picture && picture.startsWith("/")) {
                picture = HA_URL + picture
            }
            if (picture) {
                imgEl.style.backgroundImage = `url(${picture})`
                imgEl.innerHTML = "" // Remove icon if picture exists
            } else {
                imgEl.innerHTML = `<iconify-icon icon="ph:user"></iconify-icon>`
            }
        }
    }

    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: block;
                    padding: 20px 24px 8px 24px;
                }
                .wrapper {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: var(--color-card-alt);
                    border: 1px solid var(--border-color);
                    background-size: cover;
                    background-position: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    font-size: 1.25rem;
                    flex-shrink: 0;
                }
                .name {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    letter-spacing: -0.01em;
                }
            </style>
            <div class="wrapper">
                <div class="avatar" id="avatar">
                    <iconify-icon icon="ph:user"></iconify-icon>
                </div>
                <span class="name" id="name">...</span>
            </div>
        `
    }
}

customElements.define("user-header", UserHeader)
