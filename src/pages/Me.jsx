import { Layout } from '@/components/Layout'
import { Terminal, Cmd, Out, K, F, S } from '@/components/Terminal'
import { FridgeDoor } from '@/components/FridgeDoor'
import { PixelCat } from '@/components/PixelCat'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import '@/styles/me.css'

/** The headline, set like the Funzies one; under it, the Python terminal on
    the left and the fridge door of photos on the right (stacked on phones),
    then the pixel cat doing its rounds in front of its night window. */
export function Me() {
  useDocumentMeta({ title: 'About', description: 'About Shreya Rudrapatna, an experience designer.' })
  return (
    <Layout>
      <div className="me-page">
        <h1 className="me-headline font-display">heyo, i’m Shreya</h1>
        <div className="me-grid">
          {/* Each call reads as plain English: shreya.how_i_design(), … */}
          <Terminal className="term--tall">
            <Cmd>
              <K>import</K> shreya
            </Cmd>
            <Cmd>
              shreya.<F>tell_me_about_this_portfolio</F>()
            </Cmd>
            <Out>
              <p>
                This portfolio started as a pile of sketches, screenshots and half-finished ideas. I mapped the
                pages in Figma first, then <strong>rebuilt every piece by hand</strong>, measuring spacing and colour off the comps
                so the site would feel like my own work, not a template.
              </p>
            </Out>
            <Cmd>
              shreya.<F>list_some_facts</F>()
            </Cmd>
            <Out>
              <ul className="term__list">
                <li>
                  <strong>Personality type: ENTJ</strong>
                </li>
                <li>
                  <strong>3+ years of professional experience</strong>
                </li>
                <li>
                  <strong>The biggest spiderman nerd you’ll meet</strong>
                </li>
              </ul>
            </Out>
            <Cmd>
              shreya.<F>explain_how_you_design</F>()
            </Cmd>
            <Out>
              <p>
                The way I design is through the <strong>art of understanding</strong>. Sure, I can solve your problems, but what
                makes me different from other designers is that I value the process of <strong>research and data</strong>.
              </p>
            </Out>
            <Cmd>
              shreya.<F>work_with_me</F>(<S>'hello!'</S>)
            </Cmd>
            <Out>
              <p>
                Opening{' '}
                <a className="term__link" href="mailto:shreyarudrapatna@gmail.com">
                  mailto:shreyarudrapatna@gmail.com
                </a>
              </p>
            </Out>
          </Terminal>
          <FridgeDoor />
        </div>
        <PixelCat className="h-[10.5rem] w-full md:h-[14rem]" />
      </div>
    </Layout>
  )
}
