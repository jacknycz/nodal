'use client'

import React from 'react'
import { useSupabaseUser } from '../../features/auth/authUtils'
import { isAdmin } from '../../features/auth/roles'
import Link from 'next/link'

export default function ComponentsLibraryPage() {
  const user = useSupabaseUser()
  const admin = isAdmin(user)

  if (!admin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl md:text-3xl font-fredoka text-gray-900 dark:text-white">Not authorized</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">This page is only available to admins.</p>
        <Link href="/" className="mt-4 text-primary-600 dark:text-primary-400">Go back home</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-12">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 dark:from-gray-950 dark:via-primary-950 dark:to-gray-950" />
      </div>
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-12 py-12">
        <h1 className="text-3xl md:text-4xl font-fredoka font-medium text-gray-900 dark:text-white mb-2">Nodal Components</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Internal component library. Copy/paste examples with Tailwind classes.</p>

        {/* Inject the same HTML node examples from BoardRoom */}
        {/* Default Node */}
        <section className="mb-10">
          <h2 className="text-xl font-fredoka font-medium text-gray-900 dark:text-white mb-2">Default Node (title + rich text)</h2>
          <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 inline-block">
            <div className="relative flex flex-col justify-start text-left p-3 bg-white dark:bg-gray-800 border border-transparent rounded-lg shadow-sm shadow-gray-400/20 dark:shadow-none group w-[260px] hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition">
              <div className="rf-handle-hit-32 absolute -top-2 left-1/2 -translate-x-1/2" aria-hidden></div>
              <div className="rf-handle-hit-32 absolute -bottom-2 left-1/2 -translate-x-1/2" aria-hidden></div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">How to tame your inner raccoon</h3>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-200 mb-2">
                Raccoons are just night pandas with more opinions. Start small: close tabs. Hydrate. Wear softer pants.
              </div>
            </div>
          </div>
        </section>

        {/* Image Node */}
        <section className="mb-10">
          <h2 className="text-xl font-fredoka font-medium text-gray-900 dark:text-white mb-2">Image Node</h2>
          <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 inline-block">
            <div className="relative flex flex-col justify-start text-left p-3 bg-white dark:bg-gray-800 border border-transparent rounded-lg shadow-sm shadow-gray-400/20 dark:shadow-none group w-[260px] hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition">
              <div className="rf-handle-hit-32 absolute -top-2 left-1/2 -translate-x-1/2" aria-hidden></div>
              <div className="rf-handle-hit-32 absolute -bottom-2 left-1/2 -translate-x-1/2" aria-hidden></div>
              <div className="relative w-full">
                <img src="/nodal.png" alt="Nodal" className="w-full h-[160px] rounded-md object-cover" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">brand_magic.png</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">420 KB • image/png</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Document Node */}
        <section className="mb-10">
          <h2 className="text-xl font-fredoka font-medium text-gray-900 dark:text-white mb-2">Document Node (PDF)</h2>
          <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 inline-block">
            <div className="relative flex flex-col justify-start text-left p-3 bg-white dark:bg-gray-800 border border-transparent rounded-lg shadow-sm shadow-gray-400/20 dark:shadow-none group w-[320px] hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition">
              <div className="rf-handle-hit-32 absolute -top-2 left-1/2 -translate-x-1/2" aria-hidden></div>
              <div className="rf-handle-hit-32 absolute -bottom-2 left-1/2 -translate-x-1/2" aria-hidden></div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 flex items-center justify-center text-red-600">📄</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">Jurassic Hiring Packet.pdf</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">1.8 MB • application/pdf</div>
                </div>
              </div>
              <div className="flex items-center gap-1 mb-2">
                <span className="inline-flex w-3 h-3 rounded-full bg-green-500" aria-hidden></span>
                <span className="text-xs text-gray-600 dark:text-gray-400">Ready</span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded p-2">
                Extracted Text: “Welcome to the Cretaceous. Benefits include ferns, sun lamps, and not being eaten.”
              </div>
            </div>
          </div>
        </section>

        {/* Task Node */}
        <section className="mb-10">
          <h2 className="text-xl font-fredoka font-medium text-gray-900 dark:text-white mb-2">Task Node</h2>
          <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 inline-block">
            <div className="relative flex flex-col justify-start text-left p-3 bg-white dark:bg-gray-800 border border-transparent rounded-lg shadow-sm shadow-gray-400/20 dark:shadow-none group w-[360px] hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition">
              <div className="rf-handle-hit-32 absolute -top-2 left-1/2 -translate-x-1/2" aria-hidden></div>
              <div className="rf-handle-hit-32 absolute -bottom-2 left-1/2 -translate-x-1/2" aria-hidden></div>
              <div className="flex items-center gap-2">
                <span className="inline-flex w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" aria-hidden></span>
                <input className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-500" placeholder="Pitch rocket raccoon self‑care plan" />
              </div>
            </div>
          </div>
        </section>

        {/* Video Node */}
        <section className="mb-10">
          <h2 className="text-xl font-fredoka font-medium text-gray-900 dark:text-white mb-2">Video Node</h2>
          <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 inline-block">
            <div className="relative flex flex-col justify-start text-left p-3 bg-white dark:bg-gray-800 border border-transparent rounded-lg shadow-sm shadow-gray-400/20 dark:shadow-none group w-[260px] hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition">
              <div className="rf-handle-hit-32 absolute -top-2 left-1/2 -translate-x-1/2" aria-hidden></div>
              <div className="rf-handle-hit-32 absolute -bottom-2 left-1/2 -translate-x-1/2" aria-hidden></div>
              <div className="relative w-full">
                <div className="w-full h-[160px] rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500">Video thumbnail</div>
              </div>
              <div className="mt-2">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">How to not get eaten on demo day</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">https://youtu.be/please‑dont‑run</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}


