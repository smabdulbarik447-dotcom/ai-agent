import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A stray package-lock.json in the user folder confuses Next's root detection
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  serverExternalPackages: ['@anthropic-ai/sdk', 'cheerio'],
  devIndicators: false,
};

export default nextConfig;
