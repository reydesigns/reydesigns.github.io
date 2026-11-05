import amazingSpiderMan2025 from '@assets/comics/covers/amazing-spider-man-2025.webp'
import ultimateSpiderMan2024 from '@assets/comics/covers/ultimate-spider-man-2024.webp'
import longWayHome4 from '@assets/comics/covers/long-way-home-4.webp'
import punisherVsSpiderMan5 from '@assets/comics/covers/punisher-vs-spider-man-5.webp'
import halloweenSpecial1 from '@assets/comics/covers/halloween-special-1.webp'
import blackCat2025 from '@assets/comics/covers/black-cat-2025.webp'
import maryJane1 from '@assets/comics/covers/mary-jane-1.webp'
import milesMorales42 from '@assets/comics/covers/miles-morales-42.webp'
import nightwing135 from '@assets/comics/covers/nightwing-135.webp'

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
 * PLACEHOLDER: every rating below is a stand-in (client, 2026-11-04: "for
 * now"), to be replaced with the client's own.
 */
export const STACKS = [
  {
    key: 'spider-man',
    name: 'Spider-Man',
    side: 'Hero',
    comics: [
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
    comics: [{ title: 'Nightwing (2016)', issue: '#135', cover: nightwing135, rating: 4.5 }],
  },
]
