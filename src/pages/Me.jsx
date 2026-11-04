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
                shreya.<F>what_i_nerd_about</F>()
              </Cmd>
              <Out>
                <Head>what i nerd about</Head>
                {/* Each one bulleted with the nav's pixel cat head. */}
                <ul className="term__subs term__subs--cats">
                  <Sub as="li">The biggest spiderman nerd you’ll meet</Sub>
                  <Sub as="li">Avid comic collector</Sub>
                  <Sub as="li">Personality of an ENTJ</Sub>
                  <Sub as="li">Story &amp; RPG gamer</Sub>
                  <Sub as="li">Stock market larper</Sub>
                </ul>
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
