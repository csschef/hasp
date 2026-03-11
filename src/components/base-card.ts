export class BaseCard extends HTMLElement {

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    render(title: string, subtitle: string) {

        this.shadowRoot!.innerHTML = `

      <style>

        .card {

          background: var(--color-card);
          border-radius: var(--radius-md);

          padding: var(--space-md);

          box-shadow:
          0 4px 12px rgba(0,0,0,0.2);

          transition:
          transform 0.15s ease,
          box-shadow 0.15s ease;

        }

        .card:active {

        box-shadow:
        0 2px 6px rgba(0,0,0,0.3);

        }

        .header {

          display: flex;
          justify-content: space-between;
          align-items: center;

        }

        .title {

          font-weight: 600;
          font-size: 16px;

          color: var(--text-primary);

        }

        .subtitle {

          font-size: 13px;
          color: var(--text-secondary);

        }

      </style>

      <div class="card">

        <div class="header">
          <slot name="icon"></slot>
          <slot name="toggle"></slot>
        </div>

        <div class="title">${title}</div>
        <div class="subtitle">${subtitle}</div>

      </div>
    `
    }

}

customElements.define("base-card", BaseCard)