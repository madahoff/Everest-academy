import { fileURLToPath } from "url"
import { defineConfig } from "vitest/config"

export default defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "") } },
    test: {
        environment: "node",
        include: ["**/*.test.ts"],
        exclude: ["node_modules/**", ".next/**"],
        testTimeout: 60_000,
    },
})
