'use client'

import { useRouter } from 'next/navigation'
import { ThemeProvider } from '../../src/contexts/ThemeContext'
import { AIProvider } from '../../src/features/ai/aiContext'
import Topbar from '../../src/components/Topbar'
import ProductIntro from '../../src/components/ProductIntro'
import Button from '../../src/components/ui/Button'

export default function WelcomePage() {
  const router = useRouter()

  return (
    <ThemeProvider>
      <AIProvider>
        <div className="h-screen">
          <Topbar
            isBoardView={false}
            onOpenBoardRoom={() => router.push('/')}
          />
          <div className="pt-12 h-[calc(100vh-3rem)]">{/* space for fixed topbar height approx */}
            <ProductIntro
              open={true}
              onClose={() => router.push('/')}
              mode="page"
              slides={[
                ({ next }) => (
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold mb-4">Slide 1</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Welcome to Nodal — slide 1 content.</p>
                    <div className="flex justify-center">
                      <Button variant="primary" size="medium" onClick={next}>Next</Button>
                    </div>
                  </div>
                ),
                ({ next, prev }) => (
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold mb-4">Slide 2</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Slide 2 content goes here.</p>
                    <div className="flex justify-center gap-3">
                      <Button variant="secondary" size="medium" onClick={prev}>Previous</Button>
                      <Button variant="primary" size="medium" onClick={next}>Next</Button>
                    </div>
                  </div>
                ),
                ({ next, prev }) => (
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold mb-4">Slide 3</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Slide 3 content goes here.</p>
                    <div className="flex justify-center gap-3">
                      <Button variant="secondary" size="medium" onClick={prev}>Previous</Button>
                      <Button variant="primary" size="medium" onClick={next}>Next</Button>
                    </div>
                  </div>
                ),
                ({ prev }) => (
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold mb-4">Slide 4</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Final slide — you're ready!</p>
                    <div className="flex justify-center gap-3">
                      <Button variant="secondary" size="medium" onClick={prev}>Previous</Button>
                      <Button variant="primary" size="medium" onClick={() => router.replace('/')}>Finish</Button>
                    </div>
                  </div>
                ),
              ]}
            />
          </div>
        </div>
      </AIProvider>
    </ThemeProvider>
  )
}


