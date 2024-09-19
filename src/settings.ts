import { Env } from ".";

export const isUserWhitelisted = (userId: number, env: Env) => {
    if (env.WHITELIST_ENABLED === 'true') {
        return env.WHITELIST_ENTITIES?.split(',').includes(userId.toString())
    }
    return true
}
export const isStreaming = (env: Env) => {
    if (env.MESSAGE_STREAMING_ENABLED === 'false') return false
    return true
}
export const getInitialCooldown = (env: Env) => {
    if (env.MESSAGE_STREAMING_INITIAL_COOLDOWN) return Number(env.MESSAGE_STREAMING_INITIAL_COOLDOWN)
    return 2000
}
export const getCooldown = (env: Env) => {
    if (env.MESSAGE_STREAMING_COOLDOWN) return Number(env.MESSAGE_STREAMING_COOLDOWN)
    return 3500
}