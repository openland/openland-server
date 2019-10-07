import { UserError } from '../openland-errors/UserError';

export type QueryPart = OrQuery | AndQuery | IntValueQuery | IntValueSpanQuery | ValueEnumQuery | NotQuery;

export interface OrQuery {
    type: 'or';
    clauses: QueryPart[];
}

export interface AndQuery {
    type: 'and';
    clauses: QueryPart[];
}

export interface NotQuery {
    type: 'not';
    clauses: QueryPart[];
}

export interface IntValueQuery {
    type: 'field' | 'field_text' | 'prefix';
    field: string;
    exact: any;
}

export interface ValueEnumQuery {
    type: 'field_enum';
    field: string;
    values: any[];
}

export interface IntValueSpanQuery {
    type: 'range';
    field: string;
    gte?: number;
    gt?: number;
    lte?: number;
    lt?: number;
}

export function buildElasticQuery(query: QueryPart): any {
    if (query.type === 'or') {
        return {
            'bool': {
                'should': query.clauses.map((v) => buildElasticQuery(v))
            }
        };
    } else if (query.type === 'and') {
        return {
            'bool': {
                'must': query.clauses.map((v) => buildElasticQuery(v))
            }
        };
    } else if (query.type === 'not') {
        return {
            'bool': {
                'must_not': query.clauses.map((v) => buildElasticQuery(v))
            }
        };
    } else if (query.type === 'field_text') {
        return { match: { [query.field]: { query: query.exact, operator: 'and' } } };
    } else if (query.type === 'prefix') {
        return { match_phrase_prefix: { [query.field]: query.exact } };
    } else if (query.type === 'field') {
        return { match: { [query.field]: query.exact } };
    } else if (query.type === 'field_enum') {
        return {
            bool: {
                should: query.values.map((v) => ({ match: { [query.field]: v } }))
            }
        };
    } else if (query.type === 'range') {
        let fields: any = {};
        if (query.gte !== undefined) {
            fields.gte = query.gte;
        }
        if (query.gt !== undefined) {
            fields.gt = query.gt;
        }
        if (query.lt !== undefined) {
            fields.lt = query.lt;
        }
        if (query.lte !== undefined) {
            fields.lte = query.lte;
        }
        return {
            range: {
                [query.field]: fields
            }
        };
    } else {
        throw new UserError('Unknwon query ' + query);
    }
}

interface SortEntry {
    [type: string]: {
        order?: 'asc' | 'desc';
        mode?: 'min' | 'max' | 'sum' | 'avg' | 'median';
        nested?: any;
    };
}
export class QueryParser {
    private registeredFields = new Map<string, { type: string, mappedName: string }>();

    registerInt = (name: string, mappedName: string) => {
        if (!this.registeredFields.has(name.toLocaleLowerCase())) {
            this.registeredFields.set(name.toLocaleLowerCase(), { type: 'int', mappedName: mappedName });
        } else {
            throw new UserError('Double field registration: ' + name);
        }
    }

    registerBoolean = (name: string, mappedName: string) => {
        if (!this.registeredFields.has(name.toLocaleLowerCase())) {
            this.registeredFields.set(name.toLocaleLowerCase(), { type: 'bool', mappedName: mappedName });
        } else {
            throw new UserError('Double field registration: ' + name);
        }
    }

    registerText = (name: string, mappedName: string) => {
        if (!this.registeredFields.has(name.toLocaleLowerCase())) {
            this.registeredFields.set(name.toLocaleLowerCase(), { type: 'text', mappedName: mappedName });
        } else {
            throw new UserError('Double field registration: ' + name);
        }
    }

    registerPrefix = (name: string, mappedName: string) => {
        if (!this.registeredFields.has(name.toLocaleLowerCase())) {
            this.registeredFields.set(name.toLocaleLowerCase(), { type: 'prefix', mappedName: mappedName });
        } else {
            throw new UserError('Double field registration: ' + name);
        }
    }

    parseQuery = (query: string) => {
        let parsed: any;
        try {
            parsed = JSON.parse(query);
        } catch {
            throw new UserError('Unable to parse query');
        }

        return this.parseQueryParsed(parsed);
    }

    parseSort: (query: string) => (string | SortEntry)[] = (query: string) => {
        let parsed: any;
        try {
            parsed = JSON.parse(query);
        } catch {
            throw new UserError('Unable to parse sort');
        }

        if (!Array.isArray(parsed)) {
            throw new UserError('Sort must by array');
        }

        let res: (string | SortEntry)[] = [];

        for (let sortEntry of parsed) {
            res.push(this.parseSortParsed(sortEntry));
        }

        return res;
    }

    private parseSortParsed = (sortEntry: any) => {
        if (typeof sortEntry === 'string') {
            let tp = this.registeredFields.get(sortEntry.toLocaleLowerCase());
            if (!tp) {
                throw new UserError('Unknown field "' + sortEntry + '"');
            }
            return sortEntry;
        } else {
            let names = Object.getOwnPropertyNames(sortEntry);
            if (names.length !== 1) {
                throw new UserError('Expected to have only single field in json object');
            }
            let type = names[0];
            let tp = this.registeredFields.get(type.toLocaleLowerCase());
            if (!tp) {
                throw new UserError('Unknown field "' + type + '"');
            }
            return { [type]: { order: sortEntry[type].order, mode: sortEntry[type].mode } };
        }
    }

    private parseQueryParsed: ((src: any) => QueryPart) = (src: any) => {
        let names = Object.getOwnPropertyNames(src);
        if (names.length !== 1) {
            throw new UserError('Expected to have only single field in json object');
        }
        let type = names[0];
        if (type.toLocaleLowerCase() === '$or') {
            let clauses = src[type];
            if (!Array.isArray(clauses)) {
                throw new UserError('Expected array for OR clause');
            }
            return {
                type: 'or',
                clauses: clauses.map((v) => this.parseQueryParsed(v))
            };
        } else if (type.toLocaleLowerCase() === '$and') {
            let clauses = src[type];
            if (!Array.isArray(clauses)) {
                throw new UserError('Expected array for OR clause');
            }
            return {
                type: 'and',
                clauses: clauses.map((v) => this.parseQueryParsed(v))
            };
        } else if (type.toLocaleLowerCase() === '$not') {
            let clauses = src[type];
            if (!Array.isArray(clauses)) {
                throw new UserError('Expected array for OR clause');
            }
            return {
                type: 'not',
                clauses: clauses.map((v) => this.parseQueryParsed(v))
            };
        } else {
            let tp = this.registeredFields.get(type.toLocaleLowerCase());
            if (!tp) {
                throw new UserError('Unknown field "' + type + '"');
            }
            if (tp.type === 'int') {
                let value = src[type];
                if (typeof value === 'number') {
                    return {
                        type: 'field',
                        field: tp.mappedName,
                        exact: value
                    };
                } else if (typeof value === 'string') {
                    try {
                        let intval = parseInt(value, 10);
                        return {
                            type: 'field',
                            field: tp.mappedName,
                            exact: intval
                        };
                    } catch {
                        // Ignore
                    }
                    throw new UserError('Unsupported int field value ' + value);
                } else if (typeof value.gte === 'number' || typeof value.gt === 'number' || typeof value.lte === 'number' || typeof value.lt === 'number') {
                    let res = {
                        type: 'range',
                        field: tp.mappedName,
                    };
                    if (typeof value.gte === 'number') {
                        (res as any).gte = value.gte;
                    }
                    if (typeof value.gt === 'number') {
                        (res as any).gt = value.gt;
                    }
                    if (typeof value.lte === 'number') {
                        (res as any).lte = value.lte;
                    }
                    if (typeof value.lt === 'number') {
                        (res as any).lt = value.lt;
                    }

                    return res as IntValueSpanQuery;
                } else if (Array.isArray(value)) {
                    let vals: number[] = [];
                    for (let v of value) {
                        if (typeof v !== 'string' && typeof v !== 'number') {
                            throw new UserError('Unsupported int field value ' + v);
                        }
                        if (typeof v === 'string') {
                            vals.push(parseInt(v, 10));
                        } else {
                            vals.push(v);
                        }
                    }
                    return {
                        type: 'field_enum',
                        field: tp.mappedName,
                        values: vals
                    };
                } else {
                    throw new UserError('Unsupported int field value ' + value);
                }
            } else if (tp.type === 'text') {
                let value = src[type];
                if (typeof value === 'string') {
                    return {
                        type: 'field_text',
                        field: tp.mappedName,
                        exact: value
                    };
                } else if (Array.isArray(value)) {
                    for (let v of value) {
                        if (typeof v !== 'string') {
                            throw new UserError('Unsupported text field value ' + v);
                        }
                    }
                    return {
                        type: 'field_enum',
                        field: tp.mappedName,
                        values: value
                    };
                } else {
                    throw new UserError('Unsupported text field value ' + value);
                }
            } else if (tp.type === 'bool') {
                let value = src[type];
                if (typeof value === 'string') {
                    return {
                        type: 'field',
                        field: tp.mappedName,
                        exact: value === 'true'
                    };
                } else if (typeof value === 'boolean') {
                    return {
                        type: 'field',
                        field: tp.mappedName,
                        exact: value
                    };
                } else {
                    throw new UserError('Unsupported boolean field value ' + value);
                }
            } else if (tp.type === 'prefix') {
                let value = src[type];
                if (typeof value === 'string') {
                    return {
                        type: 'prefix',
                        field: tp.mappedName,
                        exact: value
                    };
                } else {
                    throw new UserError('Unsupported prefix field value ' + value);
                }
            } else {
                throw new UserError('Unsupported field type ' + tp.type);
            }
        }
    }
}