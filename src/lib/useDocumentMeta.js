import { useEffect } from 'react'

const SUFFIX = 'Shreya Rudrapatna'

// index.html's own title and description, read once before any route has
// touched them. They are the fallback for the landing page and for a page
// that passes nothing, so the static file stays the single source for `/`.
let defaults = null
const readDefaults = () => {
  defaults ??= {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content ?? '',
  }
  return defaults
}

/** Find a <meta>, creating it when index.html doesn't carry one. */
function metaTag(attr, key) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  return tag
}

/**
 * Per-route <title> and meta description. A single-page app otherwise shows the
 * same tab title, history entry and share preview for every route.
 *
 * `title` is the page's own name; "— Shreya Rudrapatna" is appended here so the
 * pages can't drift apart. Omit it for the landing page, which keeps the
 * title and description from index.html. Social tags are only rewritten when
 * index.html already has them, so nothing is invented.
 *
 * Every page calls this on mount, so back/forward re-runs it with the restored
 * route's values and nothing needs undoing on unmount.
 */
export function useDocumentMeta({ title, description } = {}) {
  useEffect(() => {
    const base = readDefaults()
    const nextTitle = title ? `${title} — ${SUFFIX}` : base.title
    const nextDescription = description ?? base.description

    document.title = nextTitle
    metaTag('name', 'description').content = nextDescription
    for (const [key, value] of [
      ['og:title', nextTitle],
      ['og:description', nextDescription],
    ]) {
      const tag = document.head.querySelector(`meta[property="${key}"]`)
      if (tag) tag.content = value
    }
  }, [title, description])
}
