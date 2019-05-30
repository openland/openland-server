import { AtomicModel } from 'foundation-orm-gen/Model';
import * as Case from 'change-case';

export function generateAtomic(atomic: AtomicModel): string {
    let entityKey = Case.camelCase(atomic.name);
    let entityClass = Case.pascalCase(atomic.name);

    let res = '';

    res += 'export class ' + entityClass + 'Factory extends FAtomicIntegerFactory {\n';
    res += '    constructor(connection: FConnection) {\n';
    res += '        super(connection, new FNamespace(\'atomic\', \'' + entityKey + '\'));\n';
    res += '    }\n';

    res += '    async findById(ctx: Context, ' + atomic.keys.map((v) => v.name + ': ' + v.type).join(', ') + ') {\n';
    res += '        return await this._findById(ctx, [' + atomic.keys.map((v) => v.name).join(', ') + ']);\n';
    res += '    }\n';

    res += '}';

    return res;
}