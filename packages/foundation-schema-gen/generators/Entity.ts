import { EntityModel } from '../Model';
import * as Case from 'change-case';

export function generateEntity(entity: EntityModel): string {
    let entityKey = Case.camelCase(entity.name);
    let entityClass = Case.pascalCase(entity.name);
    let res = '';
    res += 'export interface ' + entityClass + 'Shape {\n';
    for (let k of entity.fields) {
        res += '    ' + k.name + ': ' + k.type + ';\n';
    }
    res += '}\n\n';

    // Entity
    res += 'export class ' + entityClass + ' extends FEntity {\n';

    // res += '    static namespace = new SNamespace(\'' + entityKey + '\');\n';
    // res += '    static findById(' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ') {\n';
    // res += '    }\n';
    // Keys
    for (let k of entity.keys) {
        res += '    get ' + k.name + '() { return this._value.' + k.name + '; }\n';
    }

    // Fields
    for (let k of entity.fields) {
        res += '    get ' + k.name + '() {\n';
        res += '        return this._value.' + k.name + ';\n';
        res += '    }\n';
        res += '    set ' + k.name + '(value: ' + k.type + ') {\n';
        res += '        this._checkIsWritable();\n';
        res += '        if (value === this._value.' + k.name + ') { return; }\n';
        res += '        this._value.' + k.name + ' = value;\n';
        res += '        this.markDirty();\n';
        res += '    }\n';
    }
    res += '}\n\n';

    // Factory
    res += 'export class ' + entityClass + 'Factory extends FEntityFactory<' + entityClass + ', ' + entityClass + 'Shape> {\n';
    res += '    constructor(connection: FConnection) {\n';
    res += '        super(connection, new FNamespace(\'entity\', \'' + entityKey + '\'), { enableVersioning: ' + entity.enableVersioning + ', enableTimestamps: ' + entity.enableTimestamps + ' });\n';
    res += '    }\n';
    // protected _createEntity(context: SContext, namespace: SNamespace, id: (string | number)[], value: any) {
    //     return new Online(context, namespace, id, value);
    // }
    res += '    async findById(' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ') {\n';
    res += '        return await this._findById([' + entity.keys.map((v) => v.name).join(', ') + ']);\n';
    res += '    }\n';
    res += '    createOrUpdate(' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ', shape: ' + entityClass + 'Shape) {\n';
    res += '        return this._create([' + entity.keys.map((v) => v.name).join(', ') + '], shape);\n';
    res += '    }\n';
    res += '    protected _createEntity(id: (string | number)[], value: any) {\n';
    res += '        return new ' + entityClass + '(this.connection, this.namespace, id, value, this.options);\n';
    res += '    }\n';
    res += '}';

    return res;
}