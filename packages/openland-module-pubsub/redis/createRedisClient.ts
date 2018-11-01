import * as Redis from 'handy-redis';

export const isRedisConfigured = process.env.REDIS_HOST !== undefined && process.env.DISABLE_CACHE !== 'true';

export function createRedisClient() {
    let port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT as string, 10) : 6379;
    let client = Redis.createHandyClient(port, process.env.REDIS_HOST);
    return client;
}