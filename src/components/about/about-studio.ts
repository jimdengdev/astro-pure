import type { AboutScene } from './about-scene'

class AboutStudio extends HTMLElement {
  private cleanup?: () => void

  connectedCallback() {
    if (this.cleanup) return
    const video = this.querySelector<HTMLVideoElement>('.studio-video')
    const canvas = this.querySelector<HTMLCanvasElement>('.studio-canvas')
    const artwork = this.querySelector<HTMLElement>('.studio-art')
    const plane = this.querySelector<HTMLElement>('.studio-art-plane')
    const button = this.querySelector<HTMLButtonElement>('.studio-motion')
    const label = this.querySelector<HTMLElement>('.studio-motion-label')
    if (!video || !canvas || !artwork || !plane || !button || !label) return

    const events = new AbortController()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    let active = true
    let visible = false
    let wanted = !reduced.matches
    let failed = false
    let requestedScene = false
    let scene: AboutScene | undefined
    let frame = 0
    let elapsed = 0
    let previousTime = 0
    let lastDraw = 0
    let pointerX = 0
    let pointerY = 0
    let smoothX = 0
    let smoothY = 0
    const canRun = () => active && visible && !document.hidden && wanted && !failed

    const updateButton = () => {
      const playing = canRun() && !video.paused
      this.dataset.motion = playing ? 'playing' : 'paused'
      const { labelPlay, labelPause, ariaPlay, ariaPause } = this.dataset
      const text = (playing ? ariaPause : ariaPlay) ?? ''
      button.setAttribute('aria-label', text)
      button.title = text
      label.textContent = (playing ? labelPause : labelPlay) ?? ''
    }

    const stopFrame = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
      lastDraw = 0
    }

    const draw = (time: number) => {
      frame = 0
      if (!canRun() || video.paused) return
      elapsed += previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0
      previousTime = time
      if (time - lastDraw >= 1000 / 30) {
        lastDraw = time
        const useParallax = pointer.matches && !reduced.matches
        smoothX += ((useParallax ? pointerX : 0) - smoothX) * 0.06
        smoothY += ((useParallax ? pointerY : 0) - smoothY) * 0.06
        plane.style.setProperty('--studio-x', `${smoothX * -6}px`)
        plane.style.setProperty('--studio-y', `${smoothY * -4}px`)
        plane.style.setProperty('--studio-turn', `${smoothX * 0.7}deg`)
        scene?.render(elapsed, smoothX, smoothY)
      }
      frame = requestAnimationFrame(draw)
    }

    const startFrame = () => {
      if (!frame && canRun() && !video.paused) frame = requestAnimationFrame(draw)
    }

    const loadScene = async () => {
      if (requestedScene || reduced.matches) return
      requestedScene = true
      try {
        const { createAboutScene } = await import('./about-scene')
        if (!active || reduced.matches) {
          requestedScene = false
          return
        }
        scene = createAboutScene(canvas)
        scene.resize(artwork.clientWidth, artwork.clientHeight)
        scene.setTheme(document.documentElement.classList.contains('dark'))
        this.dataset.webgl = 'ready'
        startFrame()
      } catch (error) {
        this.dataset.webgl = 'unavailable'
        canvas.hidden = true
        console.warn('[About studio] WebGL unavailable; keeping video/poster.', error)
      }
    }

    const sync = () => {
      if (canRun()) {
        if (!video.hasAttribute('src')) {
          video.src = video.dataset.src!
          video.muted = true
        }
        void video
          .play()
          .then(() => {
            if (!canRun()) {
              video.pause()
              return
            }
            this.setAttribute('data-video-ready', '')
            void loadScene()
            startFrame()
            updateButton()
          })
          .catch((error: unknown) => {
            // A pause during an in-flight play request is expected when leaving the viewport.
            if (
              !active ||
              !canRun() ||
              (error instanceof DOMException && error.name === 'AbortError')
            )
              return
            wanted = false
            stopFrame()
            this.dataset.playback = 'blocked'
            updateButton()
          })
      } else {
        video.pause()
        stopFrame()
      }
      updateButton()
    }

    button.hidden = false
    button.addEventListener(
      'click',
      () => {
        wanted = !wanted
        sync()
      },
      { signal: events.signal }
    )
    video.addEventListener(
      'error',
      () => {
        failed = true
        wanted = false
        this.removeAttribute('data-video-ready')
        this.dataset.playback = 'unavailable'
        button.hidden = true
        sync()
        console.warn('[About studio] Video unavailable; showing static poster.')
      },
      { signal: events.signal }
    )
    video.addEventListener(
      'playing',
      () => {
        startFrame()
        updateButton()
      },
      { signal: events.signal }
    )
    video.addEventListener(
      'pause',
      () => {
        stopFrame()
        updateButton()
      },
      { signal: events.signal }
    )
    this.addEventListener(
      'pointermove',
      (event: PointerEvent) => {
        if (!pointer.matches || reduced.matches || !canRun()) return
        const rect = this.getBoundingClientRect()
        pointerX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1))
        pointerY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1))
      },
      { signal: events.signal }
    )
    this.addEventListener(
      'pointerleave',
      () => {
        pointerX = 0
        pointerY = 0
      },
      { signal: events.signal }
    )
    document.addEventListener('visibilitychange', sync, { signal: events.signal })
    reduced.addEventListener(
      'change',
      () => {
        if (reduced.matches) {
          wanted = false
          pointerX = pointerY = smoothX = smoothY = 0
          this.removeAttribute('data-video-ready')
          canvas.hidden = true
        } else {
          canvas.hidden = this.dataset.webgl === 'unavailable'
        }
        sync()
      },
      { signal: events.signal }
    )
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault()
        const lost = scene
        scene = undefined
        canvas.hidden = true
        this.dataset.webgl = 'unavailable'
        lost?.dispose()
      },
      { signal: events.signal }
    )

    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        sync()
      },
      { threshold: 0 }
    )
    intersection.observe(this)
    const resize = new ResizeObserver(() => {
      scene?.resize(artwork.clientWidth, artwork.clientHeight)
      if (!canRun()) scene?.render(elapsed, smoothX, smoothY)
    })
    resize.observe(artwork)
    const theme = new MutationObserver(() => {
      scene?.setTheme(document.documentElement.classList.contains('dark'))
      if (!canRun()) scene?.render(elapsed, smoothX, smoothY)
    })
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    this.cleanup = () => {
      active = false
      events.abort()
      intersection.disconnect()
      resize.disconnect()
      theme.disconnect()
      stopFrame()
      video.pause()
      video.removeAttribute('src')
      video.load()
      scene?.dispose()
      scene = undefined
      this.removeAttribute('data-video-ready')
      this.cleanup = undefined
    }
    document.addEventListener('astro:before-swap', () => this.cleanup?.(), {
      signal: events.signal,
      once: true
    })
    updateButton()
  }

  disconnectedCallback() {
    this.cleanup?.()
  }
}

if (!customElements.get('about-studio')) customElements.define('about-studio', AboutStudio)
