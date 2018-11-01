import * as Redis from 'handy-redis';

export function createRedisClient() {
    let port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT as string, 10) : 6379;
    let client = Redis.createHandyClient(port, process.env.REDIS_HOST);
    return client;
}