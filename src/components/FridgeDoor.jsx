import { Drawing3DLazy } from '@/components/Drawing3DLazy'
import { MAGNETS, PHOTOS } from '@/data/fridge'
import '@/styles/fridge.css'

/**
 * Photos stuck to a fridge door: three prints overlapping at angles, each
 * still showing its subject, pinned up by 3D magnets. The Spider-Man head
 * holds the two top prints where they overlap, with the strawberry stuck on
 * just above it; the cat head holds the photo of the cat.
 *
 * Placement is in percentages of the door, so it scales as one piece.
 */
export function FridgeDoor({ className = '' }) {
  return (
    <div className={`fridge ${className}`}>
      <Print photo={PHOTOS.waterfall} className="fridge__print--waterfall" />
      <Print photo={PHOTOS.helmet} className="fridge__print--helmet" />
      <Print photo={PHOTOS.catDesk} className="fridge__print--cat" />

      <Magnet id="strawberry" className="fridge__magnet--strawberry" />
      <Magnet id="spidey" className="fridge__magnet--spidey" />
      <Magnet id="cat" className="fridge__magnet--cat" />
    </div>
  )
}

function Print({ photo, className }) {
  return (
    <figure className={`fridge__print ${className}`}>
      <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
    </figure>
  )
}

/** The box is the magnet's visible size; the canvas hangs over every edge,
    as the landing page's drawings do, since the camera frames the art at
    ~65%. */
function Magnet({ id, className }) {
  return (
    <div className={`fridge__magnet ${className}`}>
      <Drawing3DLazy {...MAGNETS[id]} depth={1} className="absolute inset-[-25%]" />
    </div>
  )
}
