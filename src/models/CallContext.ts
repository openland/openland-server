export class CallContext {
    isRetina: boolean
    uid?: number
    owner: boolean

    domain: string
    accountId: number

    requireWriteAccess() {
        if (!this.owner) {
            throw Error("You don't have permission to do this operation")
        }
    }
}