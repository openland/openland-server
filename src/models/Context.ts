export class Context {
    uid?: number
    domain?: string

    resolveDomain(name?: string) {
        if (this.domain == null && name == null) {
            throw "Domain need to be specified"
        }
        if (name != null) {
            return name
        }
        return this.domain!!;
    }
}