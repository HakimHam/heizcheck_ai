import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The Check Report PDF embeds these fonts, read from disk at runtime.
  outputFileTracingIncludes: { '/pakete/*/pruefbericht': ['./assets/fonts/*.ttf'] },
}

export default nextConfig
