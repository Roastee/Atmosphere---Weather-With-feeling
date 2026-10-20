import { useCallback, useEffect, useRef, useState } from 'react'

export type GeolocationPermission = 'prompt' | 'granted' | 'denied' | 'unavailable'

export function useGeolocation() {
  const [permission, setPermission] = useState<GeolocationPermission>('prompt')
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const requestLocation = useCallback(() => {
    if (inFlight.current) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermission('unavailable')
      setRequesting(false)
      setError('Location services are not available in this browser.')
      return
    }

    setRequesting(true)
    inFlight.current = true
    setError(null)
    try { navigator.geolocation.getCurrentPosition(
      position => {
        inFlight.current = false
        if (!mounted.current) return
        setCoords(position.coords)
        setPermission('granted')
        setRequesting(false)
      },
      positionError => {
        inFlight.current = false
        if (!mounted.current) return
        const message = positionError.code === 1
          ? 'Location permission was denied. You can enable it in your browser settings.'
          : positionError.code === 2
            ? 'Your current location could not be determined.'
            : 'Location lookup timed out. Please try again.'
        setPermission(positionError.code === 1 ? 'denied' : 'prompt')
        setError(message)
        setRequesting(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    ) } catch {
      inFlight.current = false
      setRequesting(false)
      setPermission('unavailable')
      setError('Location access is unavailable. Use a secure browser connection or search for a city.')
    }
  }, [])

  return { permission, requesting, error, coords, requestLocation }
}
