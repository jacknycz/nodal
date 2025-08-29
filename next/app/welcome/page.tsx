'use client'

import { useRouter } from 'next/navigation'
import { ThemeProvider, useTheme } from '../../src/contexts/ThemeContext'
import { AIProvider } from '../../src/features/ai/aiContext'
import Topbar from '../../src/components/Topbar'
import ProductIntro from '../../src/components/ProductIntro'
import Button from '../../src/components/ui/Button'
import Toggle from '../../src/components/ui/Toggle'
import { motion } from 'motion/react'
import Loader from '../../src/components/ui/Loader'
import Image from 'next/image'
import Tag from '../../src/components/ui/Tag'
import IconButton from '../../src/components/ui/IconButton'
import { X, LinkedinLogo, InstagramLogo } from '@phosphor-icons/react'

const slideContainerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.12 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
}

function WelcomeContent() {
  const router = useRouter()
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className="h-screen">
      <Topbar
        isBoardView={false}
        onOpenBoardRoom={() => router.push('/')}
      />
      <div className="h-full min-h-screen">
        <ProductIntro
          open={true}
          onClose={() => router.push('/')}
          mode="page"
          slides={[
            ({ next }) => (
              <motion.div variants={slideContainerVariants} className="w-full text-center max-w-lg mx-auto">
                <motion.div variants={itemVariants} className="flex justify-center mb-4">
                  <Loader size="xl" />
                </motion.div>
                <motion.h2 variants={itemVariants} className="text-4xl font-medium font-fredoka mb-4">welcome to nodal</motion.h2>
                <motion.p variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  AI + mind-mapping + a dash of chaos. Learn, teach, share — the good stuff.
                </motion.p>
                <motion.p variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  This intro is being forced on you. We apologize. It’ll be quick, painless, and yes — you get cool things out of it.
                </motion.p>
                <motion.div variants={itemVariants} className="flex justify-center mt-12">
                  <Button variant="primary" size="lg" onClick={next}>Next</Button>
                </motion.div>
              </motion.div>
            ),
            ({ next, prev }) => (
              <div className="flex h-full min-h-screen w-full items-center justify-center px-6">
                <motion.div variants={slideContainerVariants} className="w-full text-center">
                  <motion.h2 variants={itemVariants} className="text-4xl font-medium font-fredoka mb-4">choose your style</motion.h2>
                  <motion.p variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                    Pick your style. (you can change it later - anytime, menu in the top right)
                  </motion.p>
                  <motion.div variants={itemVariants} className="flex items-center justify-center my-6">
                    <Toggle checked={isDark} onChange={() => toggleTheme()} size="lg" label={isDark ? 'Dark' : 'Light'} />
                  </motion.div>
                  <motion.div variants={itemVariants} className="flex gap-3 justify-center mt-12">
                    <Button variant="secondary" size="lg" onClick={prev}>Previous</Button>
                    <Button variant="primary" size="lg" onClick={next}>Next</Button>
                  </motion.div>
                </motion.div>
              </div>
            ),
            ({ next, prev }) => (
              <motion.div variants={slideContainerVariants} className="w-full text-center max-w-lg mx-auto">
                <motion.h2 variants={itemVariants} className="text-4xl font-medium font-fredoka mb-4">your own board room</motion.h2>
                <motion.p variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  This is your dashboard. (Get it??) It's where your boards, templates, updates, and some fun stuff live.
                </motion.p>
                <motion.div variants={itemVariants} className="flex justify-center mb-4">
                  <Image src="/welcome/board-room.svg" alt="Board room" width={720} height={420} className="mx-auto max-w-60 rounded-lg shadow-lg" />
                </motion.div>
                <motion.div variants={itemVariants} className="flex gap-3 justify-center mt-12">
                  <Button variant="secondary" size="lg" onClick={prev}>Previous</Button>
                  <Button variant="primary" size="lg" onClick={next}>Next</Button>
                </motion.div>
              </motion.div>
            ),
            ({ next,prev }) => (
              <motion.div variants={slideContainerVariants} className="w-full text-center max-w-lg mx-auto">
                <motion.h2 variants={itemVariants} className="text-4xl font-medium font-fredoka mb-4">meet the nodes</motion.h2>
                <motion.p variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  Nodes are everything. Content, docs, links, images - connect them, group them, leave them alone - they're good like that.
                </motion.p>
                <motion.p variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  Confused? That's fair - we've go an intro board in just a second that should help.
                </motion.p>
                <motion.div variants={itemVariants} className="flex justify-center mb-4 gap-6">
                  <Image src="/welcome/nodal-node.svg" alt="Board room" width={720} height={420} className="mx-auto max-w-40 rounded-lg shadow-lg" />
                  <Image src="/welcome/image-node.svg" alt="Board room" width={720} height={420} className="mx-auto max-w-40 rounded-lg shadow-lg" />
                  <Image src="/welcome/document-node.svg" alt="Board room" width={720} height={420} className="mx-auto max-w-40 rounded-lg shadow-lg" />
                </motion.div>
                <motion.div variants={itemVariants} className="flex gap-3 justify-center mt-12">
                  <Button variant="secondary" size="lg" onClick={prev}>Previous</Button>
                  <Button variant="primary" size="lg" onClick={next}>Next</Button>
                </motion.div>
              </motion.div>
            ),
            ({ next,prev }) => (
              <motion.div variants={slideContainerVariants} className="w-full text-center max-w-lg mx-auto">
                <motion.h2 variants={itemVariants} className="text-4xl font-medium font-fredoka mb-4">share with friends</motion.h2>
                <motion.div variants={itemVariants} className="flex justify-center mb-4">
                  <Image src="/welcome/share-nodal.svg" alt="Board room" width={720} height={420} className="mx-auto max-w-md rounded-lg shadow-lg" />
                </motion.div>
                <motion.p variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  Share your boards with friends and family. Or enemies. Very flexible.
                </motion.p>
                <motion.p variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  Collaborate with friends and family! (<Tag size="sm">Pro</Tag> feature. I'm one dude, I have rent.)
                </motion.p>
                <motion.div variants={itemVariants} className="flex gap-3 justify-center mt-12">
                  <Button variant="secondary" size="lg" onClick={prev}>Previous</Button>
                  <Button variant="primary" size="lg" onClick={next}>Next</Button>
                </motion.div>
              </motion.div>
            ),
            ({ next,prev }) => (
              <motion.div variants={slideContainerVariants} className="w-full text-center max-w-lg mx-auto">
                <motion.h2 variants={itemVariants} className="text-4xl font-medium font-fredoka mb-4">be our friend?</motion.h2>
                <motion.div variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  <div className="flex items-center justify-center gap-4">
                    <a href="https://x.com/nodal_app" target="_blank" rel="noopener noreferrer">
                      <IconButton aria-label="Open X" variant="secondaryGhost" size="lg">
                        <X size={24} />
                      </IconButton>
                    </a>
                    {/* <a href="https://www.linkedin.com/company/nodal-app" target="_blank" rel="noopener noreferrer">
                      <IconButton aria-label="Open LinkedIn" variant="secondaryGhost" size="lg">
                        <LinkedinLogo size={24} />
                      </IconButton>
                    </a> */}
                    <a href="https://www.instagram.com/nodal_app" target="_blank" rel="noopener noreferrer">
                      <IconButton aria-label="Open Instagram" variant="secondaryGhost" size="lg">
                        <InstagramLogo size={24} />
                      </IconButton>
                    </a>
                  </div>
                </motion.div>
                <motion.p variants={itemVariants} className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  We're on all the cool social things and we <span className="line-through">post when legally required</span> would love to see you guys there!
                </motion.p>
                
                <motion.div variants={itemVariants} className="flex gap-3 justify-center mt-12">
                  <Button variant="secondary" size="lg" onClick={prev}>Previous</Button>
                  <Button variant="primary" size="lg" onClick={() => router.replace('/')}>Finish</Button>
                </motion.div>
              </motion.div>
            ),
          ]}
        />
      </div>
    </div>
  )
}

export default function WelcomePage() {
  return (
    <ThemeProvider>
      <AIProvider>
        <WelcomeContent />
      </AIProvider>
    </ThemeProvider>
  )
}


