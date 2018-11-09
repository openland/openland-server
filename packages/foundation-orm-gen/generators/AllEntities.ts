import { EntityModel } from '../Model';

export function generateAllEntities(entity: EntityModel[]) {
    let res = '';
    res += 'export interface AllEntities {\n';
    res += '    readonly connection: FConnection;\n';
    for (let e of entity) {
        res += '    readonly ' + e.name + ': ' + e.name + 'Factory;\n';
    }
    res += '}\n';
    res += 'export class AllEntitiesDirect extends FDBInstance implements AllEntities {\n';
    res += '    static readonly schema: FEntitySchema[] = [\n';
    for (let e of entity) {
        res += '        ' + e.name + 'Factory.schema,\n';
    }
    res += '    ];\n';
    res += '    allEntities: FEntityFactory<FEntity>[] = [];\n';
    for (let e of entity) {
        res += '    ' + e.name + ': ' + e.name + 'Factory;\n';
    }
    res += '\n';
    res += '    constructor(connection: FConnection) {\n';
    res += '        super(connection);\n';
    for (let e of entity) {
        res += '        this.' + e.name + ' = new ' + e.name + 'Factory(connection);\n';
        res += '        this.allEntities.push(this.' + e.name + ');\n';
    }
    res += '    }\n';
    res += '}\n';
    res += 'export class AllEntitiesProxy implements AllEntities {\n';
    res += '    get connection(): FConnection {\n';
    res += '        return this.resolver().connection;\n'; 
    res += '    }\n';
    for (let e of entity) {
        res += '    get ' + e.name + '(): ' + e.name + 'Factory {\n';
        res += '        return this.resolver().' + e.name + ';\n';
        res += '    }\n';
    }
    res += '    private resolver: () => AllEntities;\n';
    res += '    constructor(resolver: () => AllEntities) {\n';
    res += '        this.resolver = resolver;\n';
    res += '    }\n';
    res += '}\n';
    return res;
}