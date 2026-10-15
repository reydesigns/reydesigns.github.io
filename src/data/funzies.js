/* ---------------------------------------------------------------------------
   Funzies — one entry per window on the page, in reading order.

   Media come from Assets/funzies/web/, made by scripts/prep-funzies-media.mjs.
   Never import the originals one folder up: several are HEIC (browsers can't
   decode it) and the .MOV is HEVC.

   `thumb` is what the tile on the grid shows; `media` is the swipeable set in
   the popup, first slide first. Every picture is shown whole on white; `tile:
   'icon'` just gives small artwork a wider margin.

   `body` is plain text: a blank line starts a new paragraph, and a paragraph
   whose lines all start with "- " becomes a bulleted list. Entries marked
   "Placeholder" are drafts awaiting confirmation.
--------------------------------------------------------------------------- */

const media = import.meta.glob('@assets/funzies/web/*.{webp,mp4}', {
  eager: true,
  query: '?url',
  import: 'default',
})
/* `extra` can carry a per-picture `body`, which replaces the window's body
   copy while that picture is on screen in the popup. */
const m = (name, extra) => {
  const url = media[`/Assets/funzies/web/${name}`]
  if (!url) throw new Error(`funzies: missing media ${name}`)
  return { src: url, type: name.endsWith('.mp4') ? 'video' : 'image', ...extra }
}

const parts = import.meta.glob('@assets/funzies/web/pc-parts/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})
const part = (file, name) => ({ name, src: parts[`/Assets/funzies/web/pc-parts/${file}`] })

/* Official store cover art (Steam library capsules; Valorant and Minecraft
   from the Microsoft Store), originals in Assets/funzies/pcbuild/games-src/. */
const covers = import.meta.glob('@assets/funzies/web/games/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})
const game = (file, name) => ({ name, src: covers[`/Assets/funzies/web/games/${file}`] })

/* Square icons for the "Tools:" line (scripts/prep-tool-icons.mjs), keyed by
   file name; sources and credits in Assets/funzies/tools-src/. */
const toolIcons = import.meta.glob('@assets/funzies/web/tools/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})
const tool = (file, name) => {
  const icon = toolIcons[`/Assets/funzies/web/tools/${file}`]
  if (!icon) throw new Error(`funzies: missing tool icon ${file}`)
  return { name, icon }
}

const DESIGN_TOOLS = [
  tool('illustrator.png', 'Illustrator'),
  tool('figma.png', 'Figma'),
  tool('photoshop.png', 'Photoshop'),
]

export const FUNZIES = [
  {
    id: 'magazine',
    label: 'MAGAZINE_FINAL',
    title: 'magazine',
    tools: DESIGN_TOOLS,
    body: 
      'A Magazine Production class I took during my 4th year of GCM! Focused on designing a cover, ' +
      'back of book (BOB) page, double page spread, a cover + ad + single page editorial for a final ' +
      'group project magazine.',
    tile: 'photo',
    thumb: m('magazine-photo.webp'),
    /* The popup shows these two stacked down its left side in place of the
       slides: the photo of the printed issue whole on top, the cover +
       spread mockup under it. `media` is still what the tile previews. */
    stack: [m('magazine-photo.webp'), m('magazine-mockup.webp')],
    media: [
      m('magazine-photo.webp'),
      m('magazine-collage.webp'),
      m('magazine-spread-1.webp'),
      m('magazine-spread-2.webp'),
    ],
  },
  {
    id: 'sdz',
    label: 'SDZ_FINAL',
    title: 'science discovery zone',
    tools: DESIGN_TOOLS,
    body: 
      'Digital Marketing Graphics\n\n' +
      'Took responsibility for handling creative yet strategic graphical decisions towards an increase ' +
      'in social media engagement.',
    tile: 'photo',
    thumb: m('sdz-cover.webp'),
    // Foldered like TMU K-POP: the social graphics, and the website icons.
    openFolder: 'socials',
    folders: [
      {
        name: 'socials',
        media: [
          m('sdz-cover.webp'),
          m('sdz-ig-1.webp'),
          m('sdz-ig-2.webp'),
          m('sdz-ig-3.webp'),
          m('sdz-ig-4.webp'),
          m('sdz-stream-participate.webp'),
          m('sdz-stream-discover.webp'),
          m('sdz-stream-incubate.webp'),
        ],
      },
      {
        name: 'icons',
        tile: 'icon',
        body:
          'Icons designed for the Science Discovery Zone website, used to inform students about the ' +
          'different streams the SDZ provides.',
        media: [m('sdz-icon-1.webp'), m('sdz-icon-2.webp'), m('sdz-icon-3.webp'), m('sdz-icon-4.webp')],
      },
    ],
  },
  {
    id: 'tmukpop',
    label: 'TMUKPOP_FINAL',
    title: 'tmu kpop',
    tools: DESIGN_TOOLS,
    body:
      // Placeholder — to be confirmed.
      'For two years I was a graphic designer for TMU K-POP, creating the marketing collateral that ' +
      'gave the club its look online and in person:\n\n' +
      '- Instagram highlight icons\n' +
      '- Social media posts and stories\n' +
      '- Monthly newsletters\n' +
      '- The club banner graphic\n' +
      '- The printed banner for events',
    tile: 'photo',
    /* The popup files the work into Finder-style folders down its left side;
       each folder has its own slides and a line of its own under the body.
       `openFolder` is the one showing when the window opens. */
    openFolder: 'posts',
    folders: [
      {
        name: 'posts',
        body:
          // Placeholder — to be confirmed.
          'Instagram feed posts, like this Korean Lunar New Year series explaining what Seollal is, ' +
          'how it\u2019s celebrated and the dishes that go with it.',
        media: [
          m('tk-lunar-1.webp'),
          m('tk-lunar-2.webp'),
          m('tk-lunar-3.webp'),
          m('tk-newsletter-1.webp'),
          m('tk-newsletter-2.webp'),
          m('tk-newsletter-3.webp'),
          m('tk-newsletter-4.webp'),
        ],
      },
      {
        name: 'icons',
        tile: 'icon',
        body: 'Instagram highlight icons for the club\u2019s profile.',
        media: [
          m('tk-icon-announce.webp'),
          m('tk-icon-discord.webp'),
          m('tk-icon-faq.webp'),
          m('tk-icon-team.webp'),
          m('tk-icon-cancelled.webp'),
          m('tk-icon-camera.webp'),
          m('tk-icon-website.webp'),
        ],
      },
      {
        name: 'stories',
        // Inside the popup only: the tile shows the feed posts.
        preview: false,
        body:
          // Placeholder — to be confirmed.
          'Instagram story graphics: event announcements, giveaways, song recommendations, sponsor ' +
          'promos and monthly newsletters, designed to keep members in the loop between events.',
        media: [
          m('tk-songs-1.webp'),
          m('tk-songs-2.webp'),
          m('tk-event-archive-text.webp'),
          m('tk-event-archive-photos.webp'),
          m('tk-giveaway.webp'),
          m('tk-dance-workshop.webp'),
          m('tk-hallyuween.webp'),
          m('tk-mercy.webp'),
          m('tk-website-launch.webp'),
        ],
      },
    ],
  },
  {
    id: 'pc-build',
    label: 'PCBUILDOFMYDREAMS_FINAL',
    title: 'pc build of my dreams',
    tools: [tool('screwdriver.png', 'Screwdriver'), tool('screws.png', 'A bunch of screws')],
    body: 
      'Last summer, I took the initiative to learn and build my own PC. I have dreamt of this for so ' +
      'long, and because of my job, I had the privilege of buying the hardware necessary for this build.\n\n' +
      'Some of my faves:',
    tile: 'photo',
    thumb: m('pc-desk.webp'),
    media: [m('pc-desk.webp'), m('pc-build.webp')],
    // The write-up runs long, so the photos sit in the middle of the window
    // rather than level with its top.
    centerMedia: true,
    // Cover row between the write-up and the parts.
    games: [
      game('ghost-of-tsushima.jpg', 'Ghost of Tsushima'),
      game('red-dead-redemption-2.jpg', 'Red Dead Redemption 2'),
      game('cyberpunk-2077.jpg', 'Cyberpunk 2077'),
      game('crimson-desert.jpg', 'Crimson Desert'),
      game('counter-strike.jpg', 'CS:GO'),
      game('valorant.jpg', 'Valorant'),
      game('minecraft.jpg', 'Minecraft'),
    ],
    /* Cut-outs that float under the write-up (scripts/prep-pc-parts.mjs).
       The case is a stand-in (ARCTIC makes no desktop case) and the board is a
       placeholder model until confirmed. */
    partsLabel: 'Copy my specs:',
    parts: [
      part('gpu.png', 'RTX 5070'),
      part('cpu.png', 'Ryzen 7 9700X'),
      part('cooler.png', 'Arctic AIO'),
      part('motherboard.png', 'MSI Tomahawk'),
      part('ssd.png', '2TB M.2 SSD'),
      part('case.png', 'Case'),
    ],
  },
  {
    id: 'print',
    label: 'PRINT_FINAL',
    title: 'print',
    tools: [tool('offset-printer.png', 'Offset printer'), tool('3d-printer.png', '3D printer')],
    body: 
      // Placeholder — to be confirmed.
      'Throughout my undergrad I took a lot of print-focused classes, and they challenged me to take ' +
      'projects off the screen and into the physical world. I prepared and ran work for offset printing, ' +
      'modelled and produced pieces on a 3D printer, and explored other printing methods along the way, ' +
      'from packaging prototypes to a large-format event banner.',
    tile: 'photo',
    thumb: m('print-cartridges.webp'),
    media: [
      m('print-video.mp4'),
      m('print-cartridges.webp'),
      m('package-open.webp'),
      m('package-dieline.webp'),
      m('tk-banner.webp'),
    ],
  },
  {
    id: 'infographics',
    label: 'INFOGRAPHICS_FINAL',
    title: 'infographics',
    tools: DESIGN_TOOLS,
    body: 
      'Here are a compilation of Infographics I worked on throughout the years for class assignments!',
    tile: 'photo',
    thumb: m('infographic-372-2.webp'),
    media: [
      m('infographic-372-1.webp'),
      m('infographic-372-2.webp'),
      m('infographic-dam.webp'),
      m('infographic-740.webp'),
    ],
  },
]

/* A foldered window's tile previews its folders' pictures, the open
   folder's first; its popup reads `folders` instead. Icon folders (`tile:
   'icon'`) and any marked `preview: false` stay out of the tile. */
for (const f of FUNZIES) {
  if (!f.folders) continue
  const shown = f.folders.filter((d) => d.tile !== 'icon' && d.preview !== false)
  const first = shown.find((d) => d.name === f.openFolder) ?? shown[0]
  f.media = [first, ...shown.filter((d) => d !== first)].flatMap((d) => d.media)
}

export const funzie = (id) => FUNZIES.find((f) => f.id === id)
