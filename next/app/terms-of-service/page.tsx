'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-6 relative">
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

        <article className="prose prose-gray max-w-none dark:prose-invert">
          <h1>Terms of Service – Nodal</h1>
          <p><strong>Effective Date:</strong> October 14, 2025</p>
          <p>
            Welcome to Nodal! By using our app, website, or services (“Services”), you agree to these
            Terms of Service. If you don’t agree, don’t use the app. Simple as that.
          </p>

          <h2>1. Using Nodal</h2>
          <ul>
            <li>You must be 13+ to use Nodal.</li>
            <li>You’re responsible for your account info, password, and any activity that happens on your account.</li>
            <li>Don’t be a jerk: no illegal stuff, no spamming, no breaking the app.</li>
          </ul>

          <h2>2. Account &amp; Content</h2>
          <ul>
            <li>You own the content you create (boards, nodes, notes).</li>
            <li>You grant Nodal a license to operate the app, store, and display your content while you use the service.</li>
            <li>Don’t post anything illegal, harmful, or infringing someone else’s rights.</li>
          </ul>

          <h2>3. Privacy &amp; Data</h2>
          <ul>
            <li>
              We collect information as described in our <Link href="/privacy-policy">Privacy Policy</Link>.
            </li>
            <li>We may send you emails about your account, updates, or service announcements.</li>
          </ul>

          <h2>4. Termination</h2>
          <ul>
            <li>We can suspend or delete accounts for violations of these Terms.</li>
            <li>You can close your account anytime, but we may retain some data for legal or operational reasons.</li>
          </ul>

          <h2>5. Disclaimer &amp; Limitation of Liability</h2>
          <ul>
            <li>Nodal is provided “as is.” We try our best, but we don’t guarantee the app will always work perfectly.</li>
            <li>We are not liable for lost data, downtime, or any indirect damages.</li>
          </ul>

          <h2>6. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We’ll post the changes here and update the effective date.
          </p>

          <p>
            Thanks for using Nodal! Play nice, make cool boards, and enjoy your nodes.
          </p>
        </article>
      </div>
    </main>
  )
}


