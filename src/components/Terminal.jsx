import '@/styles/terminal.css'

/**
 * A pane of frosted glass made up as a Python terminal: traffic-light title
 * bar, then the session passed as children — `Cmd` lines typed at the
 * `>>>` prompt, each followed by the `Out` block it "prints" — and a block
 * cursor blinking at the last prompt for as long as the page is open.
 *
 * Only the prompts are monospace. What each call prints is laid out like the
 * rest of the site, as a header (`Head`), a grey bold subheader (`Sub`) and
 * body text (`Body`).
 */
export function Terminal({ title = 'python3 — shreya@reydesigns', children, className = '' }) {
  return (
    <div className={`term-glass ${className}`}>
      {/* Soft colour for the glass to blur: without something behind it,
          frosted glass on a flat page reads as plain white. */}
      <span className="term-glass__glow term-glass__glow--a" aria-hidden="true" />
      <span className="term-glass__glow term-glass__glow--b" aria-hidden="true" />
      <figure className="term" aria-label="Terminal">
        <div className="term__bar">
          <span className="term__dots" aria-hidden="true">
            <span className="term__dot term__dot--red" />
            <span className="term__dot term__dot--yellow" />
            <span className="term__dot term__dot--green" />
          </span>
          <span className="term__title">
            <PyMark /> {title}
          </span>
        </div>
        <div className="term__screen">
          {children}
          <p className="term__line">
            <Prompt /> <span className="term__cursor" aria-hidden="true" />
          </p>
        </div>
      </figure>
    </div>
  )
}

/** A statement typed at the prompt. */
export const Cmd = ({ children }) => (
  <p className="term__line term__cmd">
    <Prompt /> {children}
  </p>
)
/** What the statement before it printed. */
export const Out = ({ children }) => <div className="term__out">{children}</div>
/** The printed section's header: the landing headline's light Inter, at its size. */
export const Head = ({ children }) => <h2 className="term__head">{children}</h2>
/** Its subheader: grey and bold. */
export const Sub = ({ children, as: Tag = 'p' }) => <Tag className="term__sub">{children}</Tag>
/** Its body text, set like the rest of the site's. */
export const Body = ({ children }) => <p className="term__body">{children}</p>
/** A keyword. */
export const K = ({ children }) => <span className="term__kw">{children}</span>
/** A function name. */
export const F = ({ children }) => <span className="term__fn">{children}</span>
/** A string literal. */
export const S = ({ children }) => <span className="term__str">{children}</span>

const Prompt = () => <span className="term__prompt">&gt;&gt;&gt;</span>

/** The two interlocking snakes, in Python's blue and yellow. */
function PyMark() {
  return (
    <svg className="term__py" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="var(--term-py-blue)"
        d="M11.9 1.5c-5.3 0-5 2.3-5 2.3v2.4h5.1V7H4.9S1.5 6.6 1.5 12s3 5.2 3 5.2h1.8v-2.5s-.1-3 2.9-3h5.1s2.8 0 2.8-2.7V4.4s.4-2.9-5.2-2.9Zm-2.8 1.6a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z"
      />
      <path
        fill="var(--term-py-yellow)"
        d="M12.1 22.5c5.3 0 5-2.3 5-2.3v-2.4H12V17h7.1s3.4.4 3.4-5-3-5.2-3-5.2h-1.8v2.5s.1 3-2.9 3H9.7s-2.8 0-2.8 2.7v4.6s-.4 2.9 5.2 2.9Zm2.8-1.6a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z"
      />
    </svg>
  )
}
