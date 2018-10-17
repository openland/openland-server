import { EntityModel } from '../Model';
import * as Case from 'change-case';

export function generateEntity(entity: EntityModel): string {
    let entityKey = Case.camelCase(entity.name);
    let res = '';
    res += 'export class ' + Case.pascalCase(entity.name) + ' extends SEntity { \n';
    res += '    static namespace = new SNamespace(\'' + entityKey + '\');\n';
    for (let k of entity.keys) {
        res += '    get ' + k.name + '() { return this._value.' + k.name + '; }\n';
    }
    for (let k of entity.fields) {
        res += '    get ' + k.name + '() { return this._value.' + k.name + '; }\n';
    }
    res += '}';
    return res;
}