'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-10 relative">
        {/* Back button */}
        <div className="absolute left-4 top-6">
          <Link href="/" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
            ← Back to Nodal
          </Link>
        </div>

        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <Image
            src="/nodal-black.svg"
            alt="Nodal"
            width={40}
            height={40}
            className="h-8 w-auto dark:hidden"
            priority
          />
          <Image
            src="/nodal-white.svg"
            alt="Nodal"
            width={40}
            height={40}
            className="hidden h-8 w-auto dark:block"
            priority
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white/70 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/60">
          <div className="px-6 py-5 md:px-8 md:py-6 border-b border-gray-100 dark:border-gray-800">
            <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Effective Date: October 14, 2025</p>
          </div>

          <div className="px-6 py-6 md:px-8 md:py-8">
            <nav aria-label="On this page" className="mb-6 md:mb-8">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">On this page</div>
              <ul className="flex flex-wrap gap-3 text-sm">
                <li><a href="#information-we-collect" className="text-primary-600 hover:underline dark:text-primary-400">Information We Collect</a></li>
                <li><a href="#how-we-use" className="text-primary-600 hover:underline dark:text-primary-400">How We Use Your Info</a></li>
                <li><a href="#sharing-info" className="text-primary-600 hover:underline dark:text-primary-400">Sharing Your Info</a></li>
                <li><a href="#cookies" className="text-primary-600 hover:underline dark:text-primary-400">Cookies & Tracking</a></li>
                <li><a href="#security" className="text-primary-600 hover:underline dark:text-primary-400">Security</a></li>
                <li><a href="#changes" className="text-primary-600 hover:underline dark:text-primary-400">Changes</a></li>
              </ul>
            </nav>

            <article className="prose prose-gray max-w-none dark:prose-invert leading-relaxed">
              <p>
                At Nodal, your privacy is important to us. This Privacy Policy explains what we collect, why, and how we use it.
              </p>

              <section id="information-we-collect" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">1. Information We Collect</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500">
                  <li>Account info: email, username, password (if you use email login)</li>
                  <li>OAuth info: if you sign in via Google/GitHub, we collect the info they share with us</li>
                  <li>Content: boards, nodes, notes</li>
                  <li>Usage: how you interact with the app (pages visited, actions taken)</li>
                </ul>
              </section>

              <section id="how-we-use" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">2. How We Use Your Info</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500">
                  <li>To provide and improve Nodal</li>
                  <li>To communicate with you about your account, updates, or support</li>
                  <li>To personalize your experience</li>
                </ul>
              </section>

              <section id="sharing-info" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">3. Sharing Your Info</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500">
                  <li>We don’t sell your info. Ever.</li>
                  <li>We may share data with service providers (like Postmark for emails, analytics providers) who help us run the app</li>
                  <li>We may disclose info if required by law or to protect rights</li>
                </ul>
              </section>

              <section id="cookies" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">4. Cookies &amp; Tracking</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500">
                  <li>We use cookies and similar tools to make the app work and understand usage</li>
                  <li>You can manage cookies via your browser settings</li>
                </ul>
              </section>

              <section id="security" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">5. Security</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500">
                  <li>We take reasonable measures to protect your info, but no system is 100% secure</li>
                  <li>You are responsible for keeping your password safe</li>
                </ul>
              </section>

              <section id="changes" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">6. Changes to This Policy</h2>
                <p className="mt-3">
                  We may update this Privacy Policy. The “Effective Date” will show when it was last updated.
                </p>
                <p className="mt-3">Enjoy Nodal, and keep your nodes happy!</p>
              </section>
            </article>
          </div>
        </div>
      </div>
    </main>
  )
}


