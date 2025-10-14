'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function PrivacyPolicyPage() {
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
          <h1>Privacy Policy – Nodal</h1>
            <p><strong>Effective Date:</strong> October 14, 2025</p>
          <p>
            At Nodal, your privacy is important to us. This Privacy Policy explains what we collect, why, and how we use it.
          </p>

          <h2>1. Information We Collect</h2>
          <ul>
            <li>Account info: email, username, password (if you use email login)</li>
            <li>OAuth info: if you sign in via Google/GitHub, we collect the info they share with us</li>
            <li>Content: boards, nodes, notes</li>
            <li>Usage: how you interact with the app (pages visited, actions taken)</li>
          </ul>

          <h2>2. How We Use Your Info</h2>
          <ul>
            <li>To provide and improve Nodal</li>
            <li>To communicate with you about your account, updates, or support</li>
            <li>To personalize your experience</li>
          </ul>

          <h2>3. Sharing Your Info</h2>
          <ul>
            <li>We don’t sell your info. Ever.</li>
            <li>
              We may share data with service providers (like Postmark for emails, analytics providers) who help us run the app
            </li>
            <li>We may disclose info if required by law or to protect rights</li>
          </ul>

          <h2>4. Cookies &amp; Tracking</h2>
          <ul>
            <li>We use cookies and similar tools to make the app work and understand usage</li>
            <li>You can manage cookies via your browser settings</li>
          </ul>

          <h2>5. Security</h2>
          <ul>
            <li>We take reasonable measures to protect your info, but no system is 100% secure</li>
            <li>You are responsible for keeping your password safe</li>
          </ul>

          <h2>6. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy. The “Effective Date” will show when it was last updated.
          </p>

          <p>Enjoy Nodal, and keep your nodes happy!</p>
        </article>
      </div>
    </main>
  )
}


