import { Subspace, encoders, inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';

export enum NodeState {
    JOINED = 0,
    LEAVING = 1,
    LEFT = 2
}

const SUBSPACE_STATE = 0;
const SUBSPACE_TIMEOUT = 1;

export class NodeRepository {

    private directory: Subspace;

    constructor(directory: Subspace) {
        this.directory = directory;
    }

    async registerNode(parent: Context, nodeId: string, shardId: string, registrationTimeout: number): Promise<NodeState> {
        return await inTx(parent, async (ctx) => {

            // Resolve existing node status
            let existing = await this.directory.get(ctx, encoders.tuple.pack([SUBSPACE_STATE, shardId, nodeId]));
            if (existing) {
                let tuple = encoders.tuple.unpack(existing);
                let state = tuple[0] as number;
                if (state === NodeState.JOINED) {
                    let timeout = encoders.tuple.unpack((await this.directory.get(ctx, encoders.tuple.pack([SUBSPACE_TIMEOUT, shardId, nodeId])))!)[0] as number;
                    if (registrationTimeout < timeout) {
                        return NodeState.JOINED;
                    }
                }
                if (state === NodeState.LEAVING) {
                    return NodeState.LEAVING;
                }
                if (state === NodeState.LEFT) {
                    return NodeState.LEFT;
                }

                // Update timeout
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_TIMEOUT, shardId, nodeId]), encoders.tuple.pack([registrationTimeout]));

            } else {
                // Set timeout
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_TIMEOUT, shardId, nodeId]), encoders.tuple.pack([registrationTimeout]));
                // Set state
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_STATE, shardId, nodeId]), encoders.tuple.pack([NodeState.JOINED]));
            }

            return NodeState.JOINED;
        });
    }

    async registerNodeLeaving(parent: Context, nodeId: string, shardId: string, registrationTimeout: number): Promise<NodeState> {
        return await inTx(parent, async (ctx) => {
            let existing = await this.directory.get(ctx, encoders.tuple.pack([SUBSPACE_STATE, shardId, nodeId]));
            if (existing) {
                let tuple = encoders.tuple.unpack(existing);
                let state = tuple[0] as number;

                // Renew leaving
                if (state === NodeState.LEAVING) {
                    let timeout = encoders.tuple.unpack((await this.directory.get(ctx, encoders.tuple.pack([SUBSPACE_TIMEOUT, shardId, nodeId])))!)[0] as number;
                    if (registrationTimeout > timeout) {
                        // Update timeout
                        this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_TIMEOUT, shardId, nodeId]), encoders.tuple.pack([registrationTimeout]));
                    }

                    return NodeState.LEAVING;
                }

                // Renew left
                if (state === NodeState.LEFT) {
                    return NodeState.LEFT;
                }

                // Leaving
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_TIMEOUT, shardId, nodeId]), encoders.tuple.pack([registrationTimeout]));
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_STATE, shardId, nodeId]), encoders.tuple.pack([NodeState.LEAVING]));

                return NodeState.LEAVING;
            }

            return NodeState.LEFT;
        });
    }

    async registerNodeLeft(parent: Context, nodeId: string, shardId: string, registrationTimeout: number) {
        await inTx(parent, async (ctx) => {
            let existing = await this.directory.get(ctx, encoders.tuple.pack([SUBSPACE_STATE, shardId, nodeId]));
            if (existing) {
                let tuple = encoders.tuple.unpack(existing);
                if (tuple[0] !== NodeState.LEFT) {
                    this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_TIMEOUT, shardId, nodeId]), encoders.tuple.pack([registrationTimeout]));
                    this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_STATE, shardId, nodeId]), encoders.tuple.pack([NodeState.LEFT]));
                }
            }
        });
    }

    async getShardRegionNodes(parent: Context, shardId: string) {
        return await inTx(parent, async (ctx) => {
            let nodes: { id: string, state: NodeState }[] = [];
            let allNodes = await this.directory.range(ctx, encoders.tuple.pack([SUBSPACE_STATE, shardId]));
            for (let n of allNodes) {
                let keyTuple = encoders.tuple.unpack(n.key);
                let valueTuple = encoders.tuple.unpack(n.value);
                let nodeId = keyTuple[2] as string;
                let stateId = valueTuple[0] as number;
                let state: NodeState = NodeState.LEFT;
                if (stateId === NodeState.JOINED) {
                    state = NodeState.JOINED;
                } else if (stateId === NodeState.LEAVING) {
                    state = NodeState.LEAVING;
                }
                nodes.push({ id: nodeId, state });
            }
            return nodes;
        });
    }

    async getRegionNodes(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let nodes: { region: string, id: string, state: NodeState }[] = [];
            let allNodes = await this.directory.range(ctx, encoders.tuple.pack([SUBSPACE_STATE]));
            for (let n of allNodes) {
                let keyTuple = encoders.tuple.unpack(n.key);
                let valueTuple = encoders.tuple.unpack(n.value);
                let region = keyTuple[1] as string;
                let nodeId = keyTuple[2] as string;
                let stateId = valueTuple[0] as number;
                let state: NodeState = NodeState.LEFT;
                if (stateId === NodeState.JOINED) {
                    state = NodeState.JOINED;
                } else if (stateId === NodeState.LEAVING) {
                    state = NodeState.LEAVING;
                }
                nodes.push({ region, id: nodeId, state });
            }
            return nodes;
        });
    }

    async handleTimeouts(parent: Context, now: number) {
        await inTx(parent, async (ctx) => {
            let allNodes = await this.directory.range(ctx, encoders.tuple.pack([SUBSPACE_TIMEOUT]));
            for (let n of allNodes) {
                let keyTuple = encoders.tuple.unpack(n.key);
                let valueTuple = encoders.tuple.unpack(n.value);
                let shardId = keyTuple[1] as string;
                let nodeId = keyTuple[2] as string;
                let timeout = valueTuple[0] as number;
                if (timeout < now) {
                    this.directory.clear(ctx, encoders.tuple.pack([SUBSPACE_TIMEOUT, shardId, nodeId]));
                    this.directory.clear(ctx, encoders.tuple.pack([SUBSPACE_STATE, shardId, nodeId]));
                }
            }
        });
    }
}