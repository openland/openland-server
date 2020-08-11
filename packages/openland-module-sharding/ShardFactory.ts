export type Shard = () => Promise<void>;
export type ShardFactory = (id: number) => Promise<Shard>;