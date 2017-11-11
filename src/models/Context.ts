export class Context {
    uid?: number
    domain?: string
    accountId?: number

    requireAccount(): number {
        if (this.accountId == undefined) {
            throw "Domain need to be specified"
        } else {
            return this.accountId
        }
    }
}