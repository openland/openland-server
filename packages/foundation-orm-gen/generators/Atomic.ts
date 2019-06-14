import { AtomicModel } from 'foundation-orm-gen/Model';
import * as Case from 'change-case';

export function generateAtomic(atomic: AtomicModel): string {
    let entityKey = Case.camelCase(atomic.name);
    let entityClass = Case.pascalCase(atomic.name);

    let res = '';

    if (atomic.kind === 'int') {
        res += 'export class ' + entityClass + 'Factory extends FAtomicIntegerFactory {\n';
        res += '    constructor(connection: FConnection) {\n';
        res += '        super(\'' + entityKey + '\', connection);\n';
        res += '    }\n';

        res += '    byId(' + atomic.keys.map((v) => v.name + ': ' + v.type).join(', ') + ') {\n';
        res += '        return this._findById([' + atomic.keys.map((v) => v.name).join(', ') + ']);\n';
        res += '    }\n';

        res += '}';
    } else {
        res += 'export class ' + entityClass + 'Factory extends FAtomicBooleanFactory {\n';
        res += '    constructor(connection: FConnection) {\n';
        res += '        super(\'' + entityKey + '\', connection);\n';
        res += '    }\n';

        res += '    byId(' + atomic.keys.map((v) => v.name + ': ' + v.type).join(', ') + ') {\n';
        res += '        return this._findById([' + atomic.keys.map((v) => v.name).join(', ') + ']);\n';
        res += '    }\n';

        res += '}';
    }

    return res;
}