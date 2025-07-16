import React, { useState } from 'react'
import { Button, Link, TextInput } from 'pres-start-core'
import { Chrome, Loader2, Sparkles, Users, Zap, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../features/auth/authUtils'
import { useTheme } from '../contexts/ThemeContext'
import nodalBlackLogo from '../assets/nodal-black.svg'
import nodalWhiteLogo from '../assets/nodal-white.svg'
import AnimatedBackground from './AnimatedBackground'

type AuthMode = 'signin' | 'signup'

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { isDark } = useTheme()

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
      setError(err instanceof Error ? err.message : `${mode === 'signup' ? 'Sign up' : 'Sign in'} failed`)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError(null)
    setEmail('')
    setPassword('')
  }

  const isFormValid = email.trim() && password.length >= 6

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="mb-6">
            <img 
              src={isDark ? nodalWhiteLogo : nodalBlackLogo} 
              alt="Nodal" 
              className="h-12 mx-auto"
            />
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Collaborative mind mapping with AI
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50 p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {mode === 'signin' 
                ? 'Sign in to continue to your boards' 
                : 'Get started with Nodal today'
              }
            </p>
          </div>

          {/* Google Sign In Button */}
          <Button
            onClick={handleGoogleAuth}
            disabled={isLoading}
            variant="custom"
            className="w-full h-12 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border-2 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center space-x-3 mb-6"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Chrome className="w-5 h-5" />
            )}
            <span className="font-medium">
              {isLoading ? 'Signing in...' : `Continue with Google`}
            </span>
          </Button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white/90 dark:bg-gray-800/90 text-gray-500">or</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <div className="relative">
                {/* <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-tertiary-400 dark:color-tertiary-500 dark:text-tertiary-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  disabled={isLoading}
                  required
                /> */}
                <TextInput
                  id="email"
                  type="email"
                  label="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  iconLeft={<Mail className="w-4 h-4 text-tertiary-400 dark:color-tertiary-500 dark:text-tertiary-500" />}
                />
              </div>
            </div>

            <div>
              {/* <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                  disabled={isLoading}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div> */}

              <TextInput
                id="password"
                placeholder="Enter your password"
                type="password"
                label="Password"
                variant="custom"
                iconLeft={<Lock className="w-4 h-4 text-tertiary-400 dark:color-tertiary-500 dark:text-tertiary-500" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors duration-200"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                mode === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </Button>
          </form>

          {/* Mode Toggle */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {mode === 'signin' ? "Don't have an account?" : "Already have an account?"}{' '}
              <Link
                onClick={toggleMode}
                className="text-tertiary-600 dark:text-tertiary-400 hover:underline font-medium cursor-pointer"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </Link>
            </p>
          </div>

          {/* Features Preview */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
              What you'll get:
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  AI-powered brainstorming
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Collaborative mind mapping
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Zap className="w-3 h-3 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Lightning-fast interactions
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            By signing in, you agree to our{' '}
            <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  )
} 