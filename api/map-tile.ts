import { createOpenWeatherTileHandler } from '../src/server/openWeatherTile.js'

const handler = createOpenWeatherTileHandler()

/** Vercel's standard Web Request/Response function entry point. */
export default { fetch: handler }
