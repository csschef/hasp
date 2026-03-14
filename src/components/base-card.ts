export class BaseCard extends HTMLElement {

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    render(title: string, subtitle: string) {

        this.shadowRoot!.innerHTML = `

      <style>

        .card {
          background: var(--card-bg, var(--color-card));
          border-radius: var(--radius-md);
          padding: var(--space-md);
          border: 1px solid var(--border-color);
          transition: background 0.3s ease, transform 0.15s ease, border-color 0.3s ease;
        }

        .card:active {
          transform: scale(0.97);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .title, .subtitle {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .title {
          font-weight: 400;
          font-size: 15px;
          letter-spacing: -0.01em;
          color: var(--card-text-primary, var(--text-primary));
          transition: color 0.3s ease;
          margin-bottom: 2px;
        }

        .subtitle-scroll-container {
            width: 100%;
            overflow: hidden;
            display: flex;
        }

        .subtitle {
          font-weight: 400;
          font-size: 12px;
          color: var(--card-text-secondary, var(--text-secondary));
          transition: color 0.3s ease;
          opacity: 0.8;
        }

        .card-icon {
          color: var(--card-icon-fill, var(--text-secondary));
          transition: color 0.15s ease;
        }

        .subtitle.scrolling {
          animation: marquee 10s linear infinite;
        }

        @keyframes marquee {
          0%, 15% { transform: translateX(0); }
          80%, 100% { transform: translateX(var(--scroll-dist)); }
        }

      </style>

      <div class="card">

        <div class="header">
          <slot name="icon"></slot>
          <slot name="toggle"></slot>
        </div>

        <div class="title" title="${title}">${title}</div>
        <div class="subtitle-scroll-container">
            <div class="subtitle">${subtitle}</div>
        </div>

      </div>
    `
        // Wait till render logic is done and DOM updates
        setTimeout(() => {
            if (!this.shadowRoot) return
            const container = this.shadowRoot.querySelector('.subtitle-scroll-container') as HTMLElement
            const text = this.shadowRoot.querySelector('.subtitle') as HTMLElement
            if (!container || !text) return

            // If the text's scroll width is actually larger than its bounding container...
            if (text.scrollWidth > container.clientWidth + 2) {
                // Add scrolling class
                text.classList.add("scrolling")
                // Dynamically set animation distance based on how much it overflows
                const overflow = text.scrollWidth - container.clientWidth
                text.style.setProperty('--scroll-dist', `-${overflow + 10}px`)
                text.style.animationName = 'marquee'
            } else {
                text.classList.remove("scrolling")
                text.style.animationName = 'none'
            }
        }, 10)
    }

}

customElements.define("base-card", BaseCard)