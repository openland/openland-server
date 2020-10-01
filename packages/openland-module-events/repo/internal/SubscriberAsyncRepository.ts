import { Subspace } from '@openland/foundationdb';

export class SubscriberAsyncRepository {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }
}