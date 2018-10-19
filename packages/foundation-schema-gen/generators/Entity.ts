import { EntityModel, EntityField } from '../Model';
import * as Case from 'change-case';

function resolveFieldType(field: EntityField) {
    let type: string = field.type;
    if (field.type === 'enum') {
        type = field.enumValues.map((v) => '\'' + v + '\'').join(' | ');
    }
    if (field.type === 'json') {
        type = 'any';
    }
    return type;
}

export function generateEntity(entity: EntityModel): string {
    let entityKey = Case.camelCase(entity.name);
    let entityClass = Case.pascalCase(entity.name);
    let res = '';
    res += 'export interface ' + entityClass + 'Shape {\n';
    for (let k of entity.fields) {
        res += '    ' + k.name + (k.isNullable ? '?' : '') + ': ' + resolveFieldType(k) + ';\n';
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
        let type: string = resolveFieldType(k);
        if (k.isNullable) {
            type = type + ' | null';
        }

        res += '    get ' + k.name + '(): ' + type + ' {\n';
        if (k.isNullable) {
            res += '        let res = this._value.' + k.name + ';\n';
            res += '        if (res) { return res; }\n';
            res += '        return null;\n';
        } else {
            res += '        return this._value.' + k.name + ';\n';
        }
        res += '    }\n';
        res += '    set ' + k.name + '(value: ' + type + ') {\n';
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
    res += '    async create(' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ', shape: ' + entityClass + 'Shape) {\n';
    res += '        return await this._create([' + entity.keys.map((v) => v.name).join(', ') + '], shape);\n';
    res += '    }\n';
    res += '    protected _createEntity(id: (string | number)[], value: any, isNew: boolean) {\n';
    res += '        return new ' + entityClass + '(this.connection, this.namespace, id, value, this.options, isNew);\n';
    res += '    }\n';
    res += '}';

    return res;
}