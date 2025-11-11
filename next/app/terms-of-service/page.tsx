'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function TermsOfServicePage() {
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
            <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Effective Date: October 14, 2025</p>
          </div>

          <div className="px-6 py-6 md:px-8 md:py-8">
            <nav aria-label="On this page" className="mb-6 md:mb-8">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">On this page</div>
              <ul className="flex flex-wrap gap-3 text-sm">
                <li><a href="#using-nodal" className="text-primary-600 hover:underline dark:text-primary-400">Using Nodal</a></li>
                <li><a href="#account-content" className="text-primary-600 hover:underline dark:text-primary-400">Account & Content</a></li>
                <li><a href="#privacy-data" className="text-primary-600 hover:underline dark:text-primary-400">Privacy & Data</a></li>
                <li><a href="#termination" className="text-primary-600 hover:underline dark:text-primary-400">Termination</a></li>
                <li><a href="#disclaimer" className="text-primary-600 hover:underline dark:text-primary-400">Disclaimer</a></li>
                <li><a href="#changes" className="text-primary-600 hover:underline dark:text-primary-400">Changes</a></li>
              </ul>
            </nav>

            <article className="prose prose-gray max-w-none dark:prose-invert leading-relaxed">
              <p>
                Welcome to Nodal! By using our app, website, or services (“Services”), you agree to these
                Terms of Service. If you don’t agree, don’t use the app. Simple as that.
              </p>

              <section id="using-nodal" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">1. Using Nodal</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500">
                  <li>You must be 13+ to use Nodal.</li>
                  <li>You’re responsible for your account info, password, and any activity that happens on your account.</li>
                  <li>Don’t be a jerk: no illegal stuff, no spamming, no breaking the app.</li>
                </ul>
              </section>

              <section id="account-content" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">2. Account &amp; Content</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500">
                  <li>You own the content you create (boards, nodes, notes).</li>
                  <li>You grant Nodal a license to operate the app, store, and display your content while you use the service.</li>
                  <li>Don’t post anything illegal, harmful, or infringing someone else’s rights.</li>
                </ul>
              </section>

              <section id="privacy-data" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">3. Privacy &amp; Data</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500">
                  <li>
                    We collect information as described in our <Link href="/privacy-policy">Privacy Policy</Link>.
                  </li>
                  <li>We may send you emails about your account, updates, or service announcements.</li>
                </ul>
              </section>

              <section id="termination" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">4. Termination</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500">
                  <li>We can suspend or delete accounts for violations of these Terms.</li>
                  <li>You can close your account anytime, but we may retain some data for legal or operational reasons.</li>
                </ul>
              </section>

              <section id="disclaimer" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">5. Disclaimer &amp; Limitation of Liability</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500">
                  <li>Nodal is provided “as is.” We try our best, but we don’t guarantee the app will always work perfectly.</li>
                  <li>We are not liable for lost data, downtime, or any indirect damages.</li>
                </ul>
              </section>

              <section id="changes" className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold">6. Changes to Terms</h2>
                <p className="mt-3">
                  We may update these Terms from time to time. We’ll post the changes here and update the effective date.
                </p>
                <p className="mt-3">
                  Thanks for using Nodal! Play nice, make cool boards, and enjoy your nodes.
                </p>
              </section>
            </article>
          </div>
        </div>
      </div>
    </main>
  )
}


