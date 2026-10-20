import { expect, test as base } from '@playwright/test'

const london = {
  id: 2643743,
  name: 'London',
  admin1: 'England',
  country: 'United Kingdom',
  country_code: 'GB',
  latitude: 51.5072,
  longitude: -0.1276,
  timezone: 'Europe/London',
}

const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

type ProviderOptions = { forecastStatus?: number }
type ProviderMock = (options?: ProviderOptions) => Promise<void>

function buildForecastResponse(temperatureUnit: 'celsius' | 'fahrenheit' = 'celsius') {
  const start = new Date('2026-01-01T12:00:00.000Z')
  const hourlyTimes = Array.from({ length: 24 }, (_, index) => new Date(start.getTime() + index * 60 * 60 * 1000).toISOString().slice(0, 13) + ':00')
  const dailyTimes = Array.from({ length: 16 }, (_, index) => new Date(start.getTime() + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const fahrenheit = temperatureUnit === 'fahrenheit'
  const temperatureSymbol = fahrenheit ? '°F' : '°C'
  const hourlyNumbers = (value: number) => Array.from({ length: hourlyTimes.length }, (_, index) => value + index % 3)
  const dailyNumbers = (value: number) => Array.from({ length: dailyTimes.length }, (_, index) => value + index % 4)

  return {
    timezone: 'UTC',
    model: 'mock-model',
    current: {
      time: hourlyTimes[0], temperature_2m: fahrenheit ? 75 : 24, relative_humidity_2m: 58, apparent_temperature: fahrenheit ? 77 : 25,
      is_day: 1, precipitation: 0, weather_code: 1, cloud_cover: 20, pressure_msl: 1012,
      surface_pressure: 1008, wind_speed_10m: 12, wind_direction_10m: 90, wind_gusts_10m: 18,
    },
    current_units: { temperature_2m: temperatureSymbol, apparent_temperature: temperatureSymbol, wind_speed_10m: 'km/h', relative_humidity_2m: '%', precipitation: 'mm' },
    hourly: {
      time: hourlyTimes,
      temperature_2m: hourlyNumbers(fahrenheit ? 75 : 24), apparent_temperature: hourlyNumbers(fahrenheit ? 77 : 25), relative_humidity_2m: hourlyNumbers(58),
      precipitation: hourlyNumbers(0), rain: hourlyNumbers(0), showers: hourlyNumbers(0), snowfall: hourlyNumbers(0),
      precipitation_probability: hourlyNumbers(10), weather_code: hourlyNumbers(1), is_day: hourlyTimes.map(() => 1),
      visibility: hourlyNumbers(10_000), uv_index: hourlyNumbers(3), wind_speed_10m: hourlyNumbers(12),
      wind_direction_10m: hourlyNumbers(90), wind_gusts_10m: hourlyNumbers(18),
    },
    hourly_units: { temperature_2m: temperatureSymbol, apparent_temperature: temperatureSymbol, precipitation: 'mm', visibility: 'm', wind_speed_10m: 'km/h' },
    daily: {
      time: dailyTimes, weather_code: dailyNumbers(1), temperature_2m_max: dailyNumbers(29), temperature_2m_min: dailyNumbers(19),
      apparent_temperature_max: dailyNumbers(29), apparent_temperature_min: dailyNumbers(19), sunrise: dailyTimes.map(time => `${time}T06:00`),
      sunset: dailyTimes.map(time => `${time}T18:00`), daylight_duration: dailyNumbers(43_200), uv_index_max: dailyNumbers(4),
      precipitation_sum: dailyNumbers(0), precipitation_probability_max: dailyNumbers(10), wind_speed_10m_max: dailyNumbers(20),
      wind_gusts_10m_max: dailyNumbers(28), wind_direction_10m_dominant: dailyNumbers(90),
    },
    daily_units: { temperature_2m_max: temperatureSymbol, temperature_2m_min: temperatureSymbol, precipitation_sum: 'mm', wind_speed_10m_max: 'km/h' },
  }
}

const buildAirQualityResponse = () => ({
  timezone: 'UTC',
  current: { time: '2026-01-01T12:00', european_aqi: 24, us_aqi: 20, pm2_5: 5.2, pm10: 11, ozone: 40 },
  current_units: { european_aqi: 'EAQI', us_aqi: 'AQI', pm2_5: 'μg/m³', pm10: 'μg/m³', ozone: 'μg/m³' },
})

const test = base.extend<{ mockProvider: ProviderMock }>({
  mockProvider: async ({ page }, provide) => {
    const mockProvider: ProviderMock = async ({ forecastStatus = 200 } = {}) => {
      await page.route('**/v1/search**', route => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ results: [london] }),
      }))
      await page.route('**/v1/forecast**', route => {
        if (forecastStatus !== 200) return route.fulfill({ status: forecastStatus, body: 'mock forecast failure' })
         const url = new URL(route.request().url())
         const temperatureUnit = url.searchParams.get('temperature_unit') === 'fahrenheit' ? 'fahrenheit' : 'celsius'
         return route.fulfill({ contentType: 'application/json', body: JSON.stringify(buildForecastResponse(temperatureUnit)) })
      })
      await page.route('**/v1/air-quality**', route => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(buildAirQualityResponse()),
      }))
    }
    await provide(mockProvider)
  },
})

test('loads the dashboard and supports search, forecast navigation, units, and theme', async ({ page, mockProvider }) => {
  await mockProvider()
  await page.goto('/')

   await expect(page.getByRole('heading', { name: 'Good morning' })).toBeVisible()
   await expect(page.getByRole('region', { name: 'Current weather' })).toContainText('Bengaluru')
   await expect(page.getByRole('region', { name: 'Current weather' })).toContainText('24°C')

   const search = page.getByRole('searchbox', { name: 'Search a city' })
  await search.fill('London')
  await page.getByRole('option', { name: /London/ }).click()
  await expect(page.getByRole('region', { name: 'Current weather' })).toContainText('London')

   const fahrenheit = page.getByRole('button', { name: '°F', exact: true })
   await fahrenheit.click()
   await expect(fahrenheit).toHaveAttribute('aria-pressed', 'true')
   await expect(page.getByRole('region', { name: 'Current weather' })).toContainText('75°F')

  await page.getByRole('button', { name: 'Forecast', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Plan around the weather.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reveal 16-day outlook', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reveal 16-day outlook', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Show 10 days', exact: true })).toBeVisible()
  const firstDay = page.locator('details.daily-detail').first()
  await firstDay.locator('summary').click()
  await expect(firstDay.getByText('Conditions', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Privacy and data sources' })).toBeVisible()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const reducedMotion = page.getByRole('switch')
  await reducedMotion.click()
  await expect(reducedMotion).toHaveAttribute('aria-checked', 'true')
})

test('shows air-quality provenance and informational guidance', async ({ page, mockProvider }) => {
  await mockProvider()
  await page.goto('/')

  await page.getByRole('button', { name: 'Air Quality', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Air quality, in context.' })).toBeVisible()
  await expect(page.getByRole('status', { name: 'air quality data status' })).toContainText('Live response')
  await expect(page.getByText('Open-Meteo Air Quality API', { exact: false })).toBeVisible()
  await expect(page.getByText('Informational only — this summarizes public-health index bands and does not provide medical advice.', { exact: true })).toBeVisible()
})

test('saves a location and refreshes provider readings', async ({ page, mockProvider }) => {
  await mockProvider()
  await page.goto('/')

  await page.getByRole('button', { name: 'Saved Locations', exact: true }).click()
  await expect(page.getByText('No saved locations yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Save selected location' }).click()
  await expect(page.getByRole('heading', { name: 'Bengaluru' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Bengaluru is saved on this device.')

  await page.getByRole('button', { name: 'Dashboard', exact: true }).click()
  const refresh = page.getByRole('button', { name: 'Refresh weather and air quality' })
  await refresh.click()
  await expect(page.getByText('Weather and air quality refreshed.', { exact: true }).first()).toBeVisible()
})

test('keeps searched locations, labels, and recent searches in the local workspace', async ({ page, mockProvider }) => {
  await mockProvider()
  await page.goto('/')

   const search = page.getByRole('searchbox', { name: 'Search a city' })
  await search.fill('London')
  await page.getByRole('option', { name: /London/ }).click()
  await page.getByRole('button', { name: 'Saved Locations', exact: true }).click()
  await page.getByRole('button', { name: 'Save selected location' }).click()
  await expect(page.getByRole('heading', { name: 'London' })).toBeVisible()
  await page.getByRole('button', { name: 'Rename London' }).click()
  await page.getByRole('textbox', { name: 'Rename London' }).fill('Home')
  await page.getByRole('button', { name: 'Save location label' }).click()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent searches' })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Saved Locations', exact: true }).click()
  await expect(page.locator('article.location-card').getByRole('heading', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('button', { name: /London.*England.*United Kingdom/ })).toBeVisible()
  await page.getByRole('button', { name: 'Clear recents', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Recent searches' })).not.toBeVisible()
})

test('surfaces a forecast API error with retry guidance', async ({ page, mockProvider }) => {
  await mockProvider({ forecastStatus: 400 })
  await page.goto('/')

  await expect(page.getByText('Hourly forecast unavailable. Use refresh to retry.')).toBeVisible()
  await expect(page.getByText('Daily outlook unavailable. Use refresh to retry.')).toBeVisible()
  await expect(page.getByText('HTTP 400. Please retry.')).toBeVisible()
})

test('uses the browser location only after an explicit confirmation', async ({ page, mockProvider }) => {
  await mockProvider()
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: london.latitude, longitude: london.longitude })
  await page.goto('/')

  await page.getByRole('button', { name: 'Use current location' }).click()
  const locationNotice = page.getByRole('region', { name: 'Weather where you are' })
  await expect(locationNotice).toBeVisible()
  await expect(locationNotice).toContainText('Location is checked once, never continuously.')
  await locationNotice.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText('Showing provider weather for your current coordinates.')).toBeVisible()
  await expect(page.getByText('A live atmospheric read for Current location.')).toBeVisible()
})

test('keeps the loaded dashboard visible and announces offline mode', async ({ page, mockProvider }) => {
  await mockProvider()
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Current weather' })).toContainText('Bengaluru')

  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(page.getByText('You’re offline. Live requests may use a cached provider response.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Current weather' })).toContainText('Bengaluru')
})

test('loads a mocked weather overlay and replaces it when the layer changes', async ({ page, mockProvider }) => {
  await mockProvider()
  let overlayRequests = 0
  await page.route('**/api/map-tile**', route => {
    overlayRequests += 1
    return route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng })
  })
  await page.route('**://*.tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Maps', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Explore Bengaluru' })).toBeVisible()
  await expect(page.getByText('No overlay selected', { exact: true })).toBeVisible()
  expect(overlayRequests).toBe(0)
  await page.getByRole('button', { name: 'Temperature', exact: true }).click()
  await expect(page.getByText('Temperature overlay active', { exact: true })).toBeVisible()
  expect(overlayRequests).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Precipitation', exact: true }).click()
  await expect(page.getByText('Precipitation overlay active', { exact: true })).toBeVisible()
  expect(overlayRequests).toBeGreaterThan(1)
  await expect(page.getByRole('button', { name: 'Air quality', exact: true })).toBeDisabled()
})

test('degrades gracefully when the weather overlay route fails', async ({ page, mockProvider }) => {
  await mockProvider()
  await page.route('**/api/map-tile**', route => route.fulfill({ status: 503, body: 'unavailable' }))
  await page.route('**://*.tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Maps', exact: true }).click()
  await page.getByRole('button', { name: 'Temperature', exact: true }).click()

  await expect(page.getByText('Temperature overlay unavailable', { exact: true })).toBeVisible()
  await expect(page.getByText('Point readings remain available below.', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Selected point readings' })).toBeVisible()
  await page.getByRole('button', { name: 'Forecast', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Plan around the weather.' })).toBeVisible()
})

test('serves security headers from the configured E2E server', async ({ request }) => {
  const response = await request.get('/')
  expect(response.ok()).toBeTruthy()
  expect(response.headers()).toMatchObject({
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'geolocation=(self)',
  })
})

test.describe('mobile and keyboard navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('offers mobile navigation and keyboard-activatable forecast navigation', async ({ page, mockProvider }) => {
    await mockProvider()
    await page.goto('/')

    const quickNavigation = page.getByRole('navigation', { name: 'Quick navigation' })
    const forecast = quickNavigation.getByRole('button', { name: 'Forecast' })
    await forecast.focus()
    await expect(forecast).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Plan around the weather.' })).toBeVisible()

    await page.getByRole('button', { name: 'Open navigation' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).not.toBeVisible()
  })
})
