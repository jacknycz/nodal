// Google Places API utility for general place search
// Reads API key from VITE_GOOGLE_MAPS_API_KEY environment variable
// NOTE: For browser use, you must proxy requests to avoid exposing your API key and CORS issues.
// Example proxy endpoint: /api/google-places?query=...&location=...

export interface PlaceResult {
  name: string
  address: string
  url: string
  place_id?: string
  phone?: string
  photo_url?: string
}

export async function searchPlacesGoogle(query: string, location: string): Promise<PlaceResult[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    // Fallback: hypothetical examples
    return [
      {
        name: `${query} One`,
        address: `${location} (hypothetical)`,
        url: '#',
      },
      {
        name: `${query} Two`,
        address: `${location} (hypothetical)`,
        url: '#',
      },
      {
        name: `${query} Three`,
        address: `${location} (hypothetical)`,
        url: '#',
      },
    ]
  }
  // Google Places API endpoint (Text Search)
  const endpoint = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}+in+${encodeURIComponent(location)}&key=${apiKey}`
  // Use a proxy server to avoid CORS and keep API key secret
  const proxyUrl = `/api/google-places?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`
  const res = await fetch(proxyUrl)
  if (!res.ok) throw new Error('Failed to fetch from Google Places API')
  const data = await res.json()
  return (data.results || []).map((place: any) => ({
    name: place.name,
    address: place.formatted_address,
    url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
    place_id: place.place_id,
    photo_url: place.photos && place.photos.length > 0
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`
      : undefined,
  }))
} 