import { MapView } from './MapView'
import type { Location } from '../types/api'

export function MapsView({ location }: { location: Location }) {
  return <div className="single-view"><MapView location={location} /></div>
}

export default MapsView
