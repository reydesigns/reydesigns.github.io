import * as THREE from 'three'

/**
 * The "designer toy" finish for the landing-page drawings: the glossy
 * MeshPhysicalMaterial. Its maps — the drawing's colours sorted into regions,
 * each painted with its gloss values from style_config.json — are built off
 * the main thread by toyPixels.js (in drawing.worker.js).
 */

/** The glossy front material, from the maps above (three.js textures). */
export function toyMaterial(maps) {
  return new THREE.MeshPhysicalMaterial({
    map: maps.map,
    roughness: 1,
    roughnessMap: maps.coat,
    metalness: 0,
    clearcoat: 1,
    clearcoatMap: maps.coat,
    clearcoatRoughness: 1,
    clearcoatRoughnessMap: maps.coatRough,
    sheen: 1,
    sheenColor: 0xffffff,
    sheenColorMap: maps.sheen,
    sheenRoughness: 0.5,
    emissive: 0xffffff,
    emissiveMap: maps.glow,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  })
}
