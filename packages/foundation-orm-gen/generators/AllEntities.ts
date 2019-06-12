import { EntityModel, AtomicModel, DirectoryModel } from '../Model';
import * as Case from 'change-case';

export function generateAllEntities(entity: EntityModel[], atomics: AtomicModel[], directories: DirectoryModel[]) {
    let res = '';
    res += 'export interface AllEntities {\n';
    res += '    readonly connection: FConnection;\n';
    res += '    readonly allEntities: FEntityFactory<FEntity>[];\n';
    for (let d of directories) {
        res += '    readonly ' + d.name + 'Directory: FDirectory;\n';
    }
    for (let e of entity) {
        res += '    readonly ' + e.name + ': ' + e.name + 'Factory;\n';
    }
    for (let a of atomics) {
        res += '    readonly ' + a.name + ': ' + a.name + 'Factory;\n';
    }
    res += '}\n';
    res += 'export class AllEntitiesDirect extends FDBInstance implements AllEntities {\n';
    res += '    static readonly schema: FEntitySchema[] = [\n';
    for (let e of entity) {
        res += '        ' + e.name + 'Factory.schema,\n';
    }
    res += '    ];\n';
    res += '    readonly allEntities: FEntityFactory<FEntity>[] = [];\n';
    for (let d of directories) {
        res += '    readonly ' + d.name + 'Directory: FDirectory;\n';
    }
    for (let a of entity) {
        res += '    readonly ' + a.name + ': ' + a.name + 'Factory;\n';
    }
    for (let a of atomics) {
        res += '    readonly ' + a.name + ': ' + a.name + 'Factory;\n';
    }
    res += '\n';
    res += '    constructor(connection: FConnection) {\n';
    res += '        super(connection);\n';
    for (let e of entity) {
        res += '        this.' + e.name + ' = new ' + e.name + 'Factory(connection);\n';
        res += '        this.allEntities.push(this.' + e.name + ');\n';
    }
    for (let a of atomics) {
        res += '        this.' + a.name + ' = new ' + a.name + 'Factory(connection);\n';
    }
    for (let e of directories) {
        res += '        this.' + e.name + 'Directory = connection.directories.getDirectory([\'custom\', \'' + Case.camelCase(e.name) + '\']);\n';
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
    for (let e of atomics) {
        res += '    get ' + e.name + '(): ' + e.name + 'Factory {\n';
        res += '        return this.resolver().' + e.name + ';\n';
        res += '    }\n';
    }
    for (let e of directories) {
        res += '    get ' + e.name + 'Directory(): FDirectory {\n';
        res += '        return this.resolver().' + e.name + 'Directory;\n';
        res += '    }\n';
    }
    res += '    get allEntities(): FEntityFactory<FEntity>[] {\n';
    res += '        return this.resolver().allEntities;\n';
    res += '    }\n';

    res += '    private resolver: () => AllEntities;\n';
    res += '    constructor(resolver: () => AllEntities) {\n';
    res += '        this.resolver = resolver;\n';
    res += '    }\n';
    res += '}\n';
    return res;
}