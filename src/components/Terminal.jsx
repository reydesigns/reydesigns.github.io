import '@/styles/terminal.css'

/**
 * A terminal window running a Python REPL: traffic-light title bar, the
 * interpreter's banner, then the session passed as children — `Cmd` lines
 * and the `Out` blocks they print — and a block cursor blinking at the last
 * prompt for as long as the page is open.
 */
export function Terminal({ title = 'python3 — shreya@reydesigns', children, className = '' }) {
  return (
    <figure className={`term ${className}`} aria-label="Terminal">
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
        <p className="term__line term__banner">
          Python 3.13.0 (main, Oct 2026) [Clang 17.0] on darwin
          <br />
          Type &quot;help&quot;, &quot;copyright&quot;, &quot;credits&quot; or &quot;license&quot; for more information.
        </p>
        {children}
        <p className="term__line">
          <Prompt /> <span className="term__cursor" aria-hidden="true" />
        </p>
      </div>
    </figure>
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
