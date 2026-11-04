import { Layout } from '@/components/Layout'
import { NavDock } from '@/components/NavDock'
import { Terminal, Cmd, Out, Head, Sub, Body, K, F, S } from '@/components/Terminal'
import { FridgeDoor } from '@/components/FridgeDoor'
import { PixelCat } from '@/components/PixelCat'
import { ExperienceTimeline } from '@/components/ExperienceTimeline'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import '@/styles/me.css'

/** The headline, set like the Funzies one, with the name in the script face;
    under it, the experience timeline over the glass Python terminal on the
    left and, on the right, the pixel cat doing
    its rounds in front of its night window above the fridge door of photos
    (stacked on phones). The nav pill sits at the bottom, as on Works and
    Funzies. */
export function Me() {
  useDocumentMeta({ title: 'About', description: 'About Shreya Rudrapatna, an experience designer.' })
  return (
    <Layout>
      <div className="me-page">
        <h1 className="me-headline font-display">
          heyo, i’m <span className="me-headline__name">Shreya</span>
        </h1>
        <div className="me-grid">
          {/* The timeline sits beside the cat, the terminal under it. */}
          <div className="me-main">
            <ExperienceTimeline />
            {/* Each call reads as plain English, shreya.explain_how_you_design()
                and so on, and prints a header, a subheader and body text. */}
            <Terminal>
              <Cmd>
                <K>import</K> shreya
              </Cmd>
              <Cmd>
                shreya.<F>tell_me_about_this_portfolio</F>()
              </Cmd>
              <Out>
                <Head>about this portfolio</Head>
                <Sub>Rebuilt every piece by hand</Sub>
                <Body>
                  This portfolio started as a pile of sketches, screenshots and half-finished ideas. I mapped the
                  pages in Figma first, then rebuilt every piece by hand, measuring spacing and colour off the comps so
                  the site would feel like my own work, not a template.
                </Body>
              </Out>
              <Cmd>
                shreya.<F>list_some_facts</F>()
              </Cmd>
              <Out>
                <Head>some facts</Head>
                <ul className="term__subs">
                  <Sub as="li">Personality type: ENTJ</Sub>
                  <Sub as="li">3+ years of professional experience</Sub>
                  <Sub as="li">The biggest spiderman nerd you’ll meet</Sub>
                </ul>
              </Out>
              <Cmd>
                shreya.<F>explain_how_you_design</F>()
              </Cmd>
              <Out>
                <Head>how i design</Head>
                <Sub>The art of understanding</Sub>
                <Body>
                  The way I design is through the art of understanding. Sure, I can solve your problems, but what makes
                  me different from other designers is that I value the process of <strong>research and data</strong>.
                </Body>
              </Out>
              <Cmd>
                shreya.<F>work_with_me</F>(<S>'hello!'</S>)
              </Cmd>
              <Out>
                <Head>work with me</Head>
                <Sub>Say hello!</Sub>
                <Body>
                  Email me at{' '}
                  <a className="term__link" href="mailto:shreyarudrapatna@gmail.com">
                    shreyarudrapatna@gmail.com
                  </a>
                </Body>
              </Out>
            </Terminal>
          </div>
          {/* The cat's lane sits over the fridge door, nudging the prints down. */}
          <div className="me-side">
            <PixelCat className="h-[10.5rem] w-full md:h-[12rem]" />
            <FridgeDoor />
          </div>
        </div>
      </div>
      <NavDock placement="bottom" activePath="/me" />
    </Layout>
  )
}
