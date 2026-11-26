import { defineConfig } from 'vitest/config'

// Tests supply their own dummy credentials and must never load a developer's .env.
export default defineConfig({ envDir: false })
