export type Shard = () => Promise<void> | void;
export type ShardFactory = (id: number) => Promise<Shard> | Shard;