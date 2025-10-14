'use client'
import React, { useState } from 'react'
import { GoogleLogo } from '@phosphor-icons/react'
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../features/auth/authUtils'
import { useTheme } from '../contexts/ThemeContext'
import AnimatedBackground from './AnimatedBackground'
import Image from 'next/image'
import Tag from './ui/Tag'
import Button from './ui/Button'
import TextInput from './ui/TextInput'

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const { isDark } = useTheme()

  console.log('[LoginScreen] rendered')

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Single-screen flow – Google sign-in only for now
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password)
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />
      <div className="w-full max-w-md relative z-10">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <Image 
              src={isDark ? "/nodal-white.svg" : "/nodal-black.svg"} 
              alt="Nodal" 
              width={32}
              height={32}
              className="h-8 w-auto"
              priority
            />
            <Tag variant="beta" className="ml-3">
              BETA
            </Tag>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/50 p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Welcome</h2>
            <p className="text-gray-600 dark:text-gray-400">Continue to your boards</p>
          </div>

          {/* Continue Button (Google) */}
          <Button
            onClick={handleGoogleAuth}
            disabled={isLoading}
            loading={isLoading}
            variant="secondary"
            fullWidth
            className="mb-6 h-12"
          >
            <GoogleLogo className="w-5 h-5 mr-2" />
            {isLoading ? 'Signing in...' : 'Continue'}
          </Button>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={isLoading}
              required
              fullWidth
              label="Email"
            />
            
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={isLoading}
              required
              minLength={6}
              fullWidth
              label="Password"
            />

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-800 rounded-2xl">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading || !(email.trim() && password.length >= 6)}
              loading={isLoading}
              fullWidth
              className="h-12"
            >
              Continue
            </Button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-800 rounded-2xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            By signing in, you agree to our{' '}
            <a href="/terms-of-service" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline transition-colors">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy-policy" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline transition-colors">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  )
} 