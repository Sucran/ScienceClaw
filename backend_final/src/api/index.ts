/**
 * Elysia route modules — re-export for package `exports["./api"]` consumers.
 * Prefer importing specific routes from `@api/routes/*` inside this repo.
 */
export { default as authRoutes } from "./routes/auth.js"
export { default as sessionsRoutes } from "./routes/sessions.js"
export { default as chatRoutes } from "./routes/chat.js"
export { default as modelsRoutes } from "./routes/models.js"
export { default as tooluniverseRoutes } from "./routes/tooluniverse.js"
export { default as taskSettingsRoutes } from "./routes/task-settings.js"
export { default as memoryRoutes } from "./routes/memory.js"
export { default as scienceRoutes } from "./routes/science.js"
export { default as statisticsRoutes } from "./routes/statistics.js"
export { default as fileRoutes } from "./routes/file.js"
export { default as imRoutes } from "./routes/im.js"
export { authPlugin } from "./middleware/auth.js"
