import { useState } from 'react'

/**
 * Whether the visitor has data saver on (`navigator.connection.saveData`).
 * Read once per mount and not tracked: a visitor who turns it on mid-page
 * keeps whatever is already playing.
 */
export function useSaveData() {
  const [saveData] = useState(() => navigator.connection?.saveData === true)
  return saveData
}
