'use client'

import React, { useEffect, useState } from 'react'

interface UnsplashBackgroundProps {
  query?: string
  className?: string
  blurPx?: number
  opacity?: number
}

export default function UnsplashBackground({
  query = 'creative',
  className = '',
  blurPx = 8,
  opacity = 0.6,
}: UnsplashBackgroundProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchImage = async () => {
      try {
        const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY
        if (accessKey) {
          const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(
            query
          )}&orientation=landscape&content_filter=high`
          const res = await fetch(url, {
            headers: { Authorization: `Client-ID ${accessKey}` },
          })
          if (res.ok) {
            const json = await res.json()
            const chosen = json?.urls?.regular || json?.urls?.full || json?.urls?.small
            if (!cancelled) setImageUrl(chosen || null)
            return
          }
        }
        // Fallback to source API if key missing or request failed
        if (!cancelled) setImageUrl(`https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}`)
      } catch {
        // ignore
      }
    }
    fetchImage()
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <div className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`} aria-hidden>
      {/* Base gradient layer (same palette as original page bg, with transparency) */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-white/60 to-purple-50/80 dark:from-gray-900/80 dark:via-gray-800/60 dark:to-gray-900/80" />
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Decorative background"
          className="absolute inset-0 w-full h-full object-cover scale-[1.06]"
          style={{ filter: `blur(${blurPx}px)`, opacity: loaded ? opacity : 0, transition: 'opacity 300ms ease' }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  )
}


