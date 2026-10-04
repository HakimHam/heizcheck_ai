import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The Check Report PDF embeds these fonts, read from disk at runtime.
  outputFileTracingIncludes: {
    '/pakete/*/pruefbericht': ['./assets/fonts/*.ttf'],
    // Extraction reads PDFs with pdf.js, whose Node build loads its worker from disk.
    '/pakete/*': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
    '/gebaeude/*/hochladen': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
  serverExternalPackages: ['pdfjs-dist'],
}

export default nextConfig
