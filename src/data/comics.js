import comingHome from '@assets/comics/covers/coming-home.webp'
import amazingSpiderMan2025 from '@assets/comics/covers/amazing-spider-man-2025.webp'
import ultimateSpiderMan2024 from '@assets/comics/covers/ultimate-spider-man-2024.webp'
import longWayHome4 from '@assets/comics/covers/long-way-home-4.webp'
import punisherVsSpiderMan5 from '@assets/comics/covers/punisher-vs-spider-man-5.webp'
import halloweenSpecial1 from '@assets/comics/covers/halloween-special-1.webp'
import blackCat2025 from '@assets/comics/covers/black-cat-2025.webp'
import maryJane1 from '@assets/comics/covers/mary-jane-1.webp'
import milesMorales42 from '@assets/comics/covers/miles-morales-42.webp'
import nightwing135 from '@assets/comics/covers/nightwing-135.webp'
import nightwing136 from '@assets/comics/covers/nightwing-136.webp'
import nightwing137 from '@assets/comics/covers/nightwing-137.webp'
import nightwing138 from '@assets/comics/covers/nightwing-138.webp'
import absoluteBatman1 from '@assets/comics/covers/absolute-batman-1.webp'
import absoluteBatman2 from '@assets/comics/covers/absolute-batman-2.webp'
import absoluteBatman3 from '@assets/comics/covers/absolute-batman-3.webp'
import absoluteBatman4 from '@assets/comics/covers/absolute-batman-4.webp'
import absoluteBatman5 from '@assets/comics/covers/absolute-batman-5.webp'
import absoluteBatman6 from '@assets/comics/covers/absolute-batman-6.webp'
import absoluteBatman7 from '@assets/comics/covers/absolute-batman-7.webp'
import absoluteBatman8 from '@assets/comics/covers/absolute-batman-8.webp'
import daredevil1 from '@assets/comics/covers/daredevil-1.webp'
import daredevil2 from '@assets/comics/covers/daredevil-2.webp'
import daredevil25 from '@assets/comics/covers/daredevil-25.webp'
import scarletWitch1 from '@assets/comics/covers/scarlet-witch-1.webp'
import scarletWitch2 from '@assets/comics/covers/scarlet-witch-2.webp'
import scarletWitch3 from '@assets/comics/covers/scarlet-witch-3.webp'
import thanos20161 from '@assets/comics/covers/thanos-2016-1.webp'
import thanos20231 from '@assets/comics/covers/thanos-2023-1.webp'
import infinityWars1 from '@assets/comics/covers/infinity-wars-1.webp'

/**
 * Comic Hoarder: the comics on the wire rack (ComicHoarder.jsx), grouped by
 * hero or villain. The rack gives every comic a pocket of its own, in this
 * order: each character's comics together, as listed, with the character's
 * name on the tag under each one. It grows a tier for every three comics.
 *
 * Adding a character is one more entry in STACKS; adding a comic is one more
 * entry in its `comics`, plus its cover: put the cover's source in
 * scripts/fetch-comic-covers.mjs and run it, which writes
 * Assets/comics/covers/<name>.webp to import here.
 *
 *   title    the series as it is listed, with its launch year
 *   issue    the issue number, or for a whole run the issues it spans
 *   run      true for a whole series: shown as one comic, with the #1 cover
 *   issues   for a run, how many issues `issue` spans
 *   rating   out of 5, in halves
 *   status   the tag above the stars; 'Completed' unless it says otherwise
 *
 * Runs are as of November 2026: Ultimate Spider-Man (2024) ended at #24; The
 * Amazing Spider-Man (2025) went to #35, then took its legacy numbering at
 * #1000; Black Cat (2025) was at #15. Update `issue` as they go on.
 *
 * Batman is Absolute Batman (2024): the client asked for "Ultimate Batman",
 * but Ultimate is Marvel's line and DC's matching one is Absolute.
 *
 * PLACEHOLDER: every rating below is a stand-in (client, 2026-11-04: "for
 * now"), to be replaced with the client's own.
 */
export const STACKS = [
  {
    key: 'spider-man',
    name: 'Spider-Man',
    side: 'Hero',
    comics: [
      // First, so it is the comic out when the window opens (client: John
      // Romita Jr.'s Spider-Man on a ledge in the rain). One book, not a run.
      { title: 'Amazing Spider-Man Modern Era Epic Collection: Coming Home (2025)', issue: 'Collects #30–#45', cover: comingHome, rating: 5 },
      { title: 'The Amazing Spider-Man (2025)', issue: '#1–#35, #1000–#1002', run: true, issues: 38, cover: amazingSpiderMan2025, rating: 4 },
      { title: 'Ultimate Spider-Man (2024)', issue: '#1–#24', run: true, issues: 24, cover: ultimateSpiderMan2024, rating: 5 },
      { title: 'Spider-Man: Long Way Home (2026)', issue: '#4', cover: longWayHome4, rating: 4.5 },
      { title: 'Punisher Vs. Spider-Man (2026)', issue: '#5', cover: punisherVsSpiderMan5, rating: 3.5 },
      { title: 'Amazing Spider-Man: Halloween Special (2026)', issue: '#1', cover: halloweenSpecial1, rating: 3.5 },
    ],
  },
  {
    key: 'black-cat',
    name: 'Black Cat',
    side: 'Anti-hero',
    comics: [{ title: 'Black Cat (2025)', issue: '#1–#15', run: true, issues: 15, cover: blackCat2025, rating: 4.5 }],
  },
  {
    key: 'mary-jane',
    name: 'Mary Jane',
    side: 'Hero',
    comics: [{ title: 'Friendly Neighborhood Mary Jane (2026)', issue: '#1', cover: maryJane1, rating: 4 }],
  },
  {
    key: 'miles-morales',
    name: 'Miles Morales',
    side: 'Hero',
    comics: [{ title: 'Miles Morales: Spider-Man (2022)', issue: '#42', cover: milesMorales42, rating: 4 }],
  },
  {
    key: 'nightwing',
    name: 'Nightwing',
    side: 'Hero',
    comics: [
      { title: 'Nightwing (2016)', issue: '#135', cover: nightwing135, rating: 4.5 },
      { title: 'Nightwing (2016)', issue: '#136', cover: nightwing136, rating: 4.5 },
      { title: 'Nightwing (2016)', issue: '#137', cover: nightwing137, rating: 4 },
      { title: 'Nightwing (2016)', issue: '#138', cover: nightwing138, rating: 4.5 },
    ],
  },
  {
    key: 'batman',
    name: 'Batman',
    side: 'Hero',
    comics: [
      { title: 'Absolute Batman (2024)', issue: '#1', cover: absoluteBatman1, rating: 5 },
      { title: 'Absolute Batman (2024)', issue: '#2', cover: absoluteBatman2, rating: 4.5 },
      { title: 'Absolute Batman (2024)', issue: '#3', cover: absoluteBatman3, rating: 4.5 },
      { title: 'Absolute Batman (2024)', issue: '#4', cover: absoluteBatman4, rating: 4 },
      { title: 'Absolute Batman (2024)', issue: '#5', cover: absoluteBatman5, rating: 4.5 },
      { title: 'Absolute Batman (2024)', issue: '#6', cover: absoluteBatman6, rating: 5 },
      { title: 'Absolute Batman (2024)', issue: '#7', cover: absoluteBatman7, rating: 4 },
      { title: 'Absolute Batman (2024)', issue: '#8', cover: absoluteBatman8, rating: 4.5 },
    ],
  },
  {
    key: 'daredevil',
    name: 'Daredevil',
    side: 'Hero',
    comics: [
      { title: 'Daredevil (2023)', issue: '#1', cover: daredevil1, rating: 4.5 },
      { title: 'Daredevil (2023)', issue: '#2', cover: daredevil2, rating: 4 },
      { title: 'Daredevil (2023)', issue: '#25', cover: daredevil25, rating: 4.5 },
    ],
  },
  {
    key: 'scarlet-witch',
    name: 'Scarlet Witch',
    side: 'Hero',
    comics: [
      { title: 'Scarlet Witch (2023)', issue: '#1', cover: scarletWitch1, rating: 4.5 },
      { title: 'Scarlet Witch (2023)', issue: '#2', cover: scarletWitch2, rating: 4 },
      { title: 'Scarlet Witch (2023)', issue: '#3', cover: scarletWitch3, rating: 4 },
    ],
  },
  {
    key: 'thanos',
    name: 'Thanos',
    side: 'Villain',
    comics: [
      { title: 'Thanos (2016)', issue: '#1', cover: thanos20161, rating: 4.5 },
      { title: 'Thanos (2023)', issue: '#1', cover: thanos20231, rating: 4 },
      { title: 'Infinity Wars (2018)', issue: '#1', cover: infinityWars1, rating: 4 },
    ],
  },
]
