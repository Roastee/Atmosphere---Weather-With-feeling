export type WeatherLayerId = 'temperature' | 'precipitation' | 'wind' | 'cloud' | 'air'

export interface WeatherLayerConfig {
  readonly id: WeatherLayerId
  readonly label: string
  readonly enabled: boolean
  readonly providerLayer?: string
  readonly unavailableReason?: string
}

export interface MapTileCoordinates {
  readonly z: number
  readonly x: number
  readonly y: number
}
