import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { SearchLocation } from './SearchLocation'
import openMeteoProvider from '../lib/api'
import type { Location } from '../types/api'

const london: Location = {
  id: 2643743,
  name: 'London',
  admin1: 'England',
  country: 'United Kingdom',
  country_code: 'GB',
  latitude: 51.5072,
  longitude: -0.1276,
  timezone: 'Europe/London',
}

function SearchHarness({ onSelect }: { onSelect: (location: Location) => void }) {
  const [query, setQuery] = React.useState('')
  return <SearchLocation query={query} setQuery={setQuery} onSelect={onSelect} />
}

afterEach(() => vi.restoreAllMocks())

describe('SearchLocation', () => {
  it('shows a loading result, then lets a user select a city', async () => {
    const user = userEvent.setup()
    let resolveSearch!: (locations: Location[]) => void
    vi.spyOn(openMeteoProvider, 'searchLocations').mockImplementation(() => new Promise(resolve => { resolveSearch = resolve }))
    const onSelect = vi.fn()

    render(<SearchHarness onSelect={onSelect} />)
    await user.type(screen.getByRole('searchbox', { name: 'Search a city' }), 'London')

    expect(await screen.findByText(/Searching/)).toBeVisible()
    resolveSearch([london])
    const option = await screen.findByRole('option', { name: /London/ })
    expect(option).toHaveTextContent('United Kingdom')

    await user.click(option)
    expect(onSelect).toHaveBeenCalledWith(london)
  })

  it('shows provider errors and allows the query to be cleared', async () => {
    const user = userEvent.setup()
    vi.spyOn(openMeteoProvider, 'searchLocations').mockRejectedValue(new Error('provider unavailable'))

    render(<SearchHarness onSelect={vi.fn()} />)
    const input = screen.getByRole('searchbox', { name: 'Search a city' })
    await user.type(input, 'Nowhere')
    expect(await screen.findByText('Search unavailable. Please try again.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await waitFor(() => expect(input).toHaveValue(''))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
