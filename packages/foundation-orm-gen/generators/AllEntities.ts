import { EntityModel } from '../Model';

export function generateAllEntities(entity: EntityModel[]) {
    let res = '';
    res += 'export class AllEntities extends FDBInstance {\n';
    for (let e of entity) {
        res += '    ' + e.name + ': ' + e.name + 'Factory;\n';
    }
    res += '\n';
    res += '    constructor(connection: FConnection) {\n';
    res += '        super(connection);\n';
    for (let e of entity) {
        res += '        this.' + e.name + ' = new ' + e.name + 'Factory(connection);\n';
    }
    res += '    }\n';
    res += '}\n';
    return res;
}