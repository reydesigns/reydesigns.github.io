import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { toyMaterial } from '@/lib/toyStyle'
import { DEFAULT_DEPTH, DEFAULT_SEGMENTS, prepareDrawing, releaseDrawing } from '@/lib/drawingPrep'
import style from '@/data/style_config.json'

/**
 * One of Shreya's drawings extruded into 3D — ported from the standalone
 * Three.js toys in Assets/experiments/3d-drawing/interactive/.
 *
 * Differences from the originals, all needed to sit on a page rather than
 * fill a tab:
 *  - sized to its container, not the window
 *  - no title / subtitle / "Face front" / "Spin" chrome
 *  - transparent (the originals already used alpha:true, so this is free)
 *  - zoom disabled, so the wheel keeps scrolling the page instead of dollying
 *  - started as soon as it mounts (Drawing3DLazy decides when), and torn
 *    down on unmount
 *  - turns to follow the pointer only while the pointer is over it, so the
 *    two drawings on the page react one at a time, never together
 *  - draggable, and springs back into its resting pose the moment it is let go
 *  - reports when the pointer is over the drawing itself (`onHoverChange`) and
 *    when it is tapped on a touch screen (`onTap`), for the speech bubbles
 *
 * The mesh is built by displacing a plane with a 16-bit height map packed into
 * the red and green channels of height.png. That, and the gloss maps, are
 * worked out in a worker (drawing.worker.js) so the page never freezes for
 * them; this file wraps the worker's arrays in three.js objects, compiles the
 * shaders without blocking, and calls `onReady` once the first frame is on
 * the canvas.
 *
 * Its finish — the glossy "designer toy" look — comes from
 * src/data/style_config.json (see restyle/README.md). With `enabled: false`
 * there it falls back to the original matte look.
 */

/** Idle sway, kept small so the pointer owns most of the rotation range. */
const SWAY_Y = 0.16
const SWAY_X = 0.06
/** How far the pointer can turn the model, in radians. ~23° yaw, ~13° pitch. */
const TRACK_Y = 0.4
const TRACK_X = 0.22
/**
 * The drawing fills roughly the middle 70% of its box; the rest is transparent
 * margin. Only the pointer over that middle part counts as hovering the model.
 */
const HIT_ZONE = 0.35
/** A touch that moves less than this, and lifts within TAP_MS, is a tap. */
const TAP_PX = 10
const TAP_MS = 500
/** Radians of turn per pixel dragged. */
const DRAG_GAIN = 0.012
/**
 * Rotation is a damped spring rather than a lerp: it follows the cursor
 * briskly, and when a drag is released it snaps back to its resting pose with
 * a small overshoot instead of drifting home.
 */
const STIFFNESS = 0.1
const FRICTION = 0.76

export function Drawing3D({
  textures,
  meta,
  className = '',
  label = '',
  depth = DEFAULT_DEPTH,
  maxSegments = DEFAULT_SEGMENTS,
  onHoverChange,
  onTap,
  onReady,
}) {
  const mountRef = useRef(null)
  const reduced = useReducedMotion()
  // The callbacks are read through a ref so a new function from the parent
  // never tears down and rebuilds the WebGL scene.
  const callbacks = useRef({ onHoverChange, onTap, onReady })
  useEffect(() => {
    callbacks.current = { onHoverChange, onTap, onReady }
  }, [onHoverChange, onTap, onReady])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    let renderer, scene, camera, disposed = false
    const cleanupFns = []
    // Every geometry, material and texture made here, for the cleanup.
    const owned = []
    const own = (x) => (owned.push(x), x)
    // The worker may already be on it: Drawing3DLazy starts the build as soon
    // as the drawing mounts, before this chunk has even downloaded.
    const build = prepareDrawing({ textures, meta, depth, maxSegments })
    build.catch(() => {})

    const init = () => {
      if (disposed) return
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearAlpha(0)
      if (style.enabled) {
        renderer.toneMapping =
          style.render.toneMapping === 'AgX' ? THREE.AgXToneMapping : THREE.NeutralToneMapping
        renderer.toneMappingExposure = style.render.exposure
      }
      mount.appendChild(renderer.domElement)
      Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' })

      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)

      // The originals ran on r128's legacy lighting, where these intensities
      // were scaled by π. Since r155 a light's irradiance meets the Lambert
      // BRDF (albedo / π) unscaled, so a flat face pointed at the camera needs
      // ~π of total light to show the texture's own colour. The rig below sums
      // to roughly that on the front face (hemi ≈1.8 + key ≈1.4), leaving the
      // key's angle to shade the relief. All lights are neutral white: the
      // originals' blue ground and rim tinted the art cold and grey.
      if (style.enabled) {
        // Toy look: a studio rig of key, fill and rim, plus a soft studio
        // room for the glossy parts to reflect — that reflection is what
        // draws the sharp white highlights along the hair.
        const L = style.lights
        scene.add(new THREE.HemisphereLight(L.ambient.color, L.ambient.ground, L.ambient.intensity))
        for (const name of ['key', 'fill', 'rim', 'back']) {
          const d = new THREE.DirectionalLight(L[name].color, L[name].intensity)
          d.position.set(...L[name].position)
          scene.add(d)
        }
        const pmrem = new THREE.PMREMGenerator(renderer)
        scene.environment = own(pmrem.fromScene(new RoomEnvironment(), 0.04).texture)
        scene.environmentIntensity = style.render.environmentIntensity
        pmrem.dispose()
      } else {
        scene.add(new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 2.2))
        const key = new THREE.DirectionalLight(0xffffff, 1.85)
        key.position.set(2, 3, 4)
        const rim = new THREE.DirectionalLight(0xffffff, 0.3)
        rim.position.set(-3, -1, 2)
        // Lights the back face when the drawing is dragged round.
        const backL = new THREE.DirectionalLight(0xffffff, 1.6)
        backL.position.set(-2, 2, -4)
        scene.add(key, rim, backL)
      }

      // Not in the scene until its shaders are compiled (see show()).
      const charm = new THREE.Group()
      const maxAniso = renderer.capabilities.getMaxAnisotropy()

      /** An RGBA texture from the worker's pixels (row 0 at the top). */
      const texture = ({ data, w, h }, colorSpace) => {
        const t = own(new THREE.DataTexture(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), w, h))
        // As a CanvasTexture would be: flipped to three's uv origin, smooth,
        // mipmapped.
        t.flipY = true
        t.magFilter = THREE.LinearFilter
        t.minFilter = THREE.LinearMipmapLinearFilter
        t.generateMipmaps = true
        t.colorSpace = colorSpace
        t.needsUpdate = true
        return t
      }

      build
        .then(({ mesh, tex }) => {
          if (disposed) return undefined
          releaseDrawing({ textures, depth, maxSegments })

          // The front and back shells share the uvs and the triangles.
          const uv = new THREE.BufferAttribute(mesh.uv, 2)
          const index = new THREE.BufferAttribute(mesh.index, 1)
          const shell = ({ position, normal }) => {
            const g = own(new THREE.BufferGeometry())
            g.setIndex(index)
            g.setAttribute('position', new THREE.BufferAttribute(position, 3))
            g.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
            g.setAttribute('uv', uv)
            return g
          }

          const map = (k, cs) => texture({ data: tex.maps[k], w: tex.w, h: tex.h }, cs)
          let frontMat
          if (style.enabled) {
            const maps = {
              map: map('map', THREE.SRGBColorSpace),
              coat: map('coat', THREE.NoColorSpace),
              coatRough: map('coatRough', THREE.NoColorSpace),
              sheen: map('sheen', THREE.SRGBColorSpace),
              glow: map('glow', THREE.SRGBColorSpace),
            }
            maps.map.anisotropy = maxAniso
            frontMat = own(toyMaterial(maps))
          } else {
            const colorTex = map('map', THREE.SRGBColorSpace)
            colorTex.anisotropy = maxAniso
            // Matte Lambert rather than Standard: even rough, Standard's
            // specular laid a grey veil over the dark colours (the strawberry,
            // the hair). Lambert's diffuse term is the same, so the relief
            // still shades.
            frontMat = own(new THREE.MeshLambertMaterial({ map: colorTex, alphaTest: 0.5, side: THREE.DoubleSide }))
          }

          // Back face: a blurred copy of the height field (built in the
          // worker), so the front artwork doesn't read through from behind.
          const backTex = texture(tex.back, THREE.SRGBColorSpace)
          backTex.magFilter = THREE.NearestFilter
          backTex.anisotropy = maxAniso
          const B = style.backFace
          const backMat = own(
            style.enabled
              ? new THREE.MeshPhysicalMaterial({
                  map: backTex,
                  roughness: B.roughness,
                  clearcoat: B.clearcoat,
                  clearcoatRoughness: B.clearcoatRoughness,
                  alphaTest: 0.5,
                  side: THREE.DoubleSide,
                })
              : new THREE.MeshLambertMaterial({ map: backTex, alphaTest: 0.5, side: THREE.DoubleSide }),
          )
          charm.add(new THREE.Mesh(shell(mesh.front), frontMat), new THREE.Mesh(shell(mesh.back), backMat))

          // Compiling the glossy material's shaders took ~200 ms of frozen
          // page when it happened inside the first render. compileAsync hands
          // it to the GPU process (KHR_parallel_shader_compile) and resolves
          // once it is done, so the first frame doesn't wait on it.
          return renderer.compileAsync(charm, camera, scene).then(() => charm)
        })
        .then((ready) => {
          if (ready && !disposed) show(ready)
        })
        .catch((err) => {
          // The still in Drawing3DLazy stays up; nothing else to do.
          if (!disposed) console.warn('Drawing3D: could not build the drawing', err)
        })

      let baseDist = 7
      const resize = () => {
        const w = mount.clientWidth
        const h = mount.clientHeight
        if (!w || !h) return
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        const fit = 4.2
        const tanH = Math.tan(THREE.MathUtils.degToRad(15))
        baseDist = Math.max(fit / (2 * tanH), fit / (2 * tanH * camera.aspect))
        camera.position.set(0, 0, baseDist)
        camera.lookAt(0, 0, 0)
      }
      resize()

      const ro = new ResizeObserver(resize)
      ro.observe(mount)
      cleanupFns.push(() => ro.disconnect())

      // Pointer tracking. Each drawing listens only to the pointer over its
      // own canvas, so hovering one leaves the other at rest. Raw coordinates
      // are stored here and turned into a rotation in the animation loop.
      let pointerX = 0
      let pointerY = 0
      let hovering = false
      const onPointerMove = (e) => {
        pointerX = e.clientX
        pointerY = e.clientY
        hovering = true
      }

      // Hover over the drawing itself — the same middle zone the tracking
      // uses, not the transparent margin round it. Listened for separately
      // from the tracking so it still works under reduced motion, where the
      // model does not turn but the speech bubble should still appear. Only a
      // real hovering pointer counts; touch gets taps instead.
      const inZone = (e) => {
        const r = mount.getBoundingClientRect()
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height
        return Math.abs(dx) <= HIT_ZONE && Math.abs(dy) <= HIT_ZONE
      }
      let over = false
      const setOver = (next) => {
        if (over === next) return
        over = next
        callbacks.current.onHoverChange?.(next)
      }
      const onHoverMove = (e) => {
        if (e.pointerType === 'mouse') setOver(inZone(e))
      }

      // Dragging. The drag turns the model directly; letting go zeroes the
      // offset, and the spring in the loop snaps it back into place.
      const canvas = renderer.domElement
      // Vertical swipes still scroll the page on touch screens.
      canvas.style.touchAction = 'pan-y'
      canvas.style.cursor = 'grab'
      let drag = null
      let dragY = 0
      let dragX = 0
      const onDown = (e) => {
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }
        canvas.setPointerCapture(e.pointerId)
        canvas.style.cursor = 'grabbing'
      }
      const onDrag = (e) => {
        if (!drag || e.pointerId !== drag.id) return
        dragY = (e.clientX - drag.x) * DRAG_GAIN
        dragX = (e.clientY - drag.y) * DRAG_GAIN
      }
      const onUp = (e) => {
        if (!drag || e.pointerId !== drag.id) return
        if (
          e.type === 'pointerup' &&
          e.pointerType !== 'mouse' &&
          Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < TAP_PX &&
          performance.now() - drag.t < TAP_MS &&
          inZone(e)
        ) {
          callbacks.current.onTap?.()
        }
        drag = null
        dragY = 0
        dragX = 0
        canvas.style.cursor = 'grab'
      }
      const onLeave = () => {
        hovering = false
        setOver(false)
      }
      canvas.addEventListener('pointerdown', onDown)
      canvas.addEventListener('pointermove', onDrag)
      canvas.addEventListener('pointerup', onUp)
      canvas.addEventListener('pointercancel', onUp)
      if (!reduced) canvas.addEventListener('pointermove', onPointerMove, { passive: true })
      canvas.addEventListener('pointermove', onHoverMove, { passive: true })
      canvas.addEventListener('pointerleave', onLeave)
      cleanupFns.push(() => {
        setOver(false)
        canvas.removeEventListener('pointermove', onHoverMove)
        canvas.removeEventListener('pointerdown', onDown)
        canvas.removeEventListener('pointermove', onDrag)
        canvas.removeEventListener('pointerup', onUp)
        canvas.removeEventListener('pointercancel', onUp)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerleave', onLeave)
      })

      let velY = 0
      let velX = 0
      /**
       * Puts the finished drawing on screen and starts it moving. The first
       * frame is drawn at once, at rest (no sway, no bob: both start at
       * zero), which is exactly the pose of the still underneath, so
       * Drawing3DLazy can fade one into the other.
       */
      const show = (charm) => {
        scene.add(charm)
        // Timer replaces the deprecated Clock (r183). It isn't connected to
        // the document, so like the Clock it keeps counting while the tab is
        // hidden. Made here so the sway starts from zero on the first frame.
        const timer = new THREE.Timer()
        const frame = (time) => {
          const t = timer.update(time).getElapsed()

          let aimY = 0
          let aimX = 0
          if (!reduced && hovering && !drag) {
            // Measured from this drawing's own centre, in units of half its
            // box, so the turn follows the cursor across the model itself.
            // Outside the hit zone (over the transparent margin) it rests.
            const r = mount.getBoundingClientRect()
            const dx = (pointerX - (r.left + r.width / 2)) / r.width
            const dy = (pointerY - (r.top + r.height / 2)) / r.height
            if (Math.abs(dx) <= HIT_ZONE && Math.abs(dy) <= HIT_ZONE) {
              aimY = (dx / HIT_ZONE) * TRACK_Y
              // Screen y grows downwards; a positive x-rotation tips the face up.
              aimX = -(dy / HIT_ZONE) * TRACK_X
            }
          }

          const sway = !reduced && !drag
          const ty = (sway ? Math.sin(t * 0.7) * SWAY_Y : 0) + aimY + dragY
          const tx = (sway ? Math.sin(t * 0.5) * SWAY_X : 0) + aimX + dragX
          velY = (velY + (ty - charm.rotation.y) * STIFFNESS) * FRICTION
          velX = (velX + (tx - charm.rotation.x) * STIFFNESS) * FRICTION
          charm.rotation.y += velY
          charm.rotation.x += velX
          if (!reduced) charm.position.y = Math.sin(t * 1.2) * 0.03
          renderer.render(scene, camera)
        }
        frame(performance.now())
        renderer.setAnimationLoop(frame)
        callbacks.current.onReady?.()
      }
    }

    // Its own task, so two drawings mounting together don't make one long
    // one (each WebGL context and studio room is tens of ms). Drawing3DLazy
    // decides when the drawing mounts.
    const start = setTimeout(() => {
      try {
        init()
      } catch (err) {
        // No WebGL (blocked, or the GPU process gone): the still stays, and
        // the worker's arrays have nowhere to go.
        releaseDrawing({ textures, depth, maxSegments })
        console.warn('Drawing3D: WebGL unavailable', err)
      }
    })

    return () => {
      disposed = true
      clearTimeout(start)
      cleanupFns.forEach((fn) => fn())
      if (renderer) {
        renderer.setAnimationLoop(null)
        renderer.domElement.remove()
        renderer.dispose()
      }
      owned.forEach((x) => x.dispose())
    }
  }, [textures, meta, depth, reduced, maxSegments])

  return (
    <div
      ref={mountRef}
      className={className}
      role={label ? 'img' : 'presentation'}
      aria-label={label || undefined}
    />
  )
}
