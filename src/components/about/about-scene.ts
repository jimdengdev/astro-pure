import * as THREE from 'three'

export interface AboutScene {
  resize(width: number, height: number): void
  render(time: number, pointerX: number, pointerY: number): void
  setTheme(dark: boolean): void
  dispose(): void
}

interface Leaf {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  x: number
  y: number
  depth: number
  phase: number
  speed: number
  tilt: number
}

interface Dust {
  sprite: THREE.Sprite
  x: number
  y: number
  depth: number
  phase: number
  opacity: number
}

const CAMERA_DISTANCE = 8
const FIELD_OF_VIEW = 38
const LEAF_COLORS = [0x788b58, 0xa49c5f, 0x8c9b70, 0xbba16a]
const DARK_LEAF_COLORS = [0x718e84, 0x89957b, 0x5f827b, 0xae9e76]

// Leaves emerge near the tree crown on the upper right and drift along a soft
// wind arc toward the lower left. Keep the person's face and laptop area clear.
const LEAF_ANCHORS = [
  [0.52, 0.8],
  [0.6, 0.86],
  [0.72, 0.68],
  [0.44, 0.9],
  [0.8, 0.78],
  [0.86, 0.52],
  [0.68, 0.4],
  [0.82, 0.28],
  [0.5, 0.62],
  [0.9, 0.66],
  [0.6, 0.3],
  [0.38, 0.74]
] as const

function sample(index: number, seed: number): number {
  return THREE.MathUtils.euclideanModulo(Math.sin(index * 127.1 + seed * 311.7) * 43758.5453, 1)
}

function createLeafGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const segments = 12
  const ribs = 4

  for (let row = 0; row <= segments; row++) {
    const along = row / segments
    const curve = Math.sin(along * Math.PI)
    const width = Math.pow(curve, 0.85) * (0.2 + along * 0.045)

    for (let column = 0; column <= ribs; column++) {
      const across = (column / ribs) * 2 - 1
      positions.push(
        across * width + curve * 0.035,
        along - 0.5 + across * curve * 0.025,
        curve * (0.075 + across * across * 0.13) + across * curve * 0.025
      )
      const tint = 0.81 + (1 - Math.abs(across)) * 0.19
      colors.push(tint, tint, tint * 0.94)
    }
  }

  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < ribs; column++) {
      const start = row * (ribs + 1) + column
      indices.push(start, start + 1, start + ribs + 1)
      indices.push(start + 1, start + ribs + 2, start + ribs + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

function createDustTexture(document: Document): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create the About scene dust texture')

  const glow = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  glow.addColorStop(0.2, 'rgba(255, 255, 255, 0.7)')
  glow.addColorStop(0.5, 'rgba(255, 255, 255, 0.18)')
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, 32, 32)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createAboutScene(canvas: HTMLCanvasElement): AboutScene {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 24)
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>()
  const leaves: Leaf[] = []
  const dust: Dust[] = []
  let renderer: THREE.WebGLRenderer | undefined
  let context: WebGL2RenderingContext | null = null
  let disposed = false
  let hasSize = false
  let dark = false
  let previousTime: number | undefined
  let parallaxX = 0
  let parallaxY = 0

  function own<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(resource: T): T {
    resources.add(resource)
    return resource
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    scene.clear()
    leaves.length = 0
    dust.length = 0
    for (const resource of resources) resource.dispose()
    resources.clear()
    try {
      renderer?.dispose()
    } finally {
      if (context && !context.isContextLost()) {
        context.getExtension('WEBGL_lose_context')?.loseContext()
      }
    }
  }

  function setTheme(isDark: boolean): void {
    if (disposed) return
    dark = isDark
    const palette = dark ? DARK_LEAF_COLORS : LEAF_COLORS
    leaves.forEach(({ mesh }, index) => {
      mesh.material.color.setHex(palette[index % palette.length]!)
      mesh.material.opacity = (dark ? 0.31 : 0.47) + sample(index, 4) * 0.17
    })
    dust.forEach(({ sprite }, index) => {
      sprite.material.color.setHex(dark ? 0xcbd0b4 : index % 3 === 0 ? 0xe5c281 : 0xffedc4)
    })
  }

  function resize(width: number, height: number): void {
    if (disposed || !renderer || !Number.isFinite(width) || !Number.isFinite(height)) return
    if (width <= 0 || height <= 0) return
    const view = canvas.ownerDocument.defaultView
    const coarse = view?.matchMedia('(pointer: coarse)').matches ?? false
    renderer.setPixelRatio(Math.min(view?.devicePixelRatio || 1, coarse ? 1 : 1.5))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    hasSize = true
  }

  function render(time: number, pointerX: number, pointerY: number): void {
    if (disposed || !renderer || !hasSize || context?.isContextLost()) return
    const elapsed = Number.isFinite(time) ? Math.max(0, time) : 0
    const delta =
      previousTime === undefined ? 1 / 60 : Math.min(Math.max(elapsed - previousTime, 0), 0.1)
    previousTime = elapsed
    const smoothing = 1 - Math.exp(-delta * 5)
    const targetX = Number.isFinite(pointerX) ? THREE.MathUtils.clamp(pointerX, -1, 1) : 0
    const targetY = Number.isFinite(pointerY) ? THREE.MathUtils.clamp(pointerY, -1, 1) : 0
    parallaxX += (targetX - parallaxX) * smoothing
    parallaxY += (targetY - parallaxY) * smoothing
    camera.position.set(parallaxX * 0.13, -parallaxY * 0.09, CAMERA_DISTANCE)
    camera.lookAt(parallaxX * 0.025, -parallaxY * 0.02, 0)
    const fieldScale = Math.tan(THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2))

    leaves.forEach(({ mesh, x, y, depth, phase, speed, tilt }) => {
      const angle = elapsed * speed + phase
      const halfHeight = (CAMERA_DISTANCE - depth) * fieldScale
      mesh.position.set(
        x * halfHeight * camera.aspect + Math.sin(angle) * 0.065,
        y * halfHeight + Math.cos(angle * 0.73) * 0.045,
        depth + Math.sin(angle * 0.61) * 0.08
      )
      mesh.rotation.set(
        Math.sin(angle * 0.7) * 0.42,
        Math.cos(angle * 0.83) * 0.55,
        tilt + Math.sin(angle) * 0.2
      )
    })

    dust.forEach(({ sprite, x, y, depth, phase, opacity }) => {
      const angle = elapsed * 0.16 + phase
      const halfHeight = (CAMERA_DISTANCE - depth) * fieldScale
      sprite.position.set(
        x * halfHeight * camera.aspect + Math.sin(angle * 0.81) * 0.11,
        y * halfHeight + Math.sin(angle) * 0.17,
        depth + Math.cos(angle * 0.63) * 0.08
      )
      sprite.material.opacity = opacity * (dark ? 0.6 : 1) * (0.76 + Math.sin(angle * 1.3) * 0.24)
    })
    renderer.render(scene, camera)
  }

  try {
    context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'low-power'
    })
    if (!context) throw new Error('WebGL2 is unavailable for the About scene')
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    camera.position.z = CAMERA_DISTANCE
    const geometry = own(createLeafGeometry())
    const dustTexture = own(createDustTexture(canvas.ownerDocument))

    LEAF_ANCHORS.forEach(([x, y], index) => {
      const material = own(
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          toneMapped: false
        })
      )
      const mesh = new THREE.Mesh(geometry, material)
      const foreground = index % 3 === 0
      const scale = (foreground ? 0.29 : 0.16) + sample(index, 1) * 0.1
      mesh.scale.set(scale * (0.85 + sample(index, 2) * 0.3), scale, scale)
      leaves.push({
        mesh,
        x,
        y,
        depth: foreground ? 1 + sample(index, 3) * 0.7 : -1.4 + sample(index, 3),
        phase: sample(index, 5) * Math.PI * 2,
        speed: 0.14 + sample(index, 6) * 0.1,
        tilt: sample(index, 7) * Math.PI * 2
      })
      scene.add(mesh)
    })

    // Own the billboard geometry instead of disposing Three.js's shared Sprite geometry.
    const dustGeometry = own(new THREE.PlaneGeometry(1, 1))
    for (let index = 0; index < 42; index++) {
      const material = own(
        new THREE.SpriteMaterial({
          map: dustTexture,
          transparent: true,
          depthWrite: false,
          toneMapped: false
        })
      )
      const sprite = new THREE.Sprite(material)
      sprite.geometry = dustGeometry
      const size = 0.025 + sample(index, 8) * 0.035
      sprite.scale.set(size, size, 1)
      dust.push({
        sprite,
        x: (sample(index, 9) - 0.5) * 1.64,
        y: (sample(index, 10) - 0.5) * 1.58 + 0.06,
        depth: (sample(index, 11) - 0.5) * 3,
        phase: sample(index, 12) * Math.PI * 2,
        opacity: 0.27 + sample(index, 13) * 0.24
      })
      scene.add(sprite)
    }

    setTheme(false)
    return { resize, render, setTheme, dispose }
  } catch (error) {
    try {
      dispose()
    } catch {
      // Preserve the initialization error so the caller can keep the video fallback.
    }
    throw error
  }
}
