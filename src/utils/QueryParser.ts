
export type QueryPart = OrQuery | AndQuery | IntValueQuery | IntValueSpanQuery;

export interface OrQuery {
    type: 'or';
    clauses: QueryPart[];
}

export interface AndQuery {
    type: 'and';
    clauses: QueryPart[];
}

export interface IntValueQuery {
    type: 'field';
    field: string;
    exact: any;
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
    } else if (query.type === 'field') {
        return { match: { [query.field]: query.exact } };
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
        throw Error('Unknwon query ' + query);
    }
}

export class QueryParser {
    private registeredFields = new Map<string, { type: string, mappedName: string }>();

    registerInt = (name: string, mappedName: string) => {
        if (!this.registeredFields.has(name.toLocaleLowerCase())) {
            this.registeredFields.set(name.toLocaleLowerCase(), { type: 'int', mappedName: mappedName });
        } else {
            throw Error('Double field registration: ' + name);
        }
    }

    registerText = (name: string, mappedName: string) => {
        if (!this.registeredFields.has(name.toLocaleLowerCase())) {
            this.registeredFields.set(name.toLocaleLowerCase(), { type: 'text', mappedName: mappedName });
        } else {
            throw Error('Double field registration: ' + name);
        }
    }

    parseQuery = (query: string) => {
        let parsed: any;
        try {
            parsed = JSON.parse(query);
        } catch {
            throw Error('Unable to parse query');
        }

        return this.parseQueryParsed(parsed);
    }

    private parseQueryParsed: ((src: any) => QueryPart) = (src: any) => {
        let names = Object.getOwnPropertyNames(src);
        if (names.length !== 1) {
            throw Error('Expected to have only single field in json object');
        }
        let type = names[0];
        console.warn(type);
        if (type.toLocaleLowerCase() === '$or') {
            let clauses = src[type];
            if (!Array.isArray(clauses)) {
                throw Error('Expected array for OR clause');
            }
            return {
                type: 'or',
                clauses: clauses.map((v) => this.parseQueryParsed(v))
            };
        } else if (type.toLocaleLowerCase() === '$and') {
            let clauses = src[type];
            if (!Array.isArray(clauses)) {
                throw Error('Expected array for OR clause');
            }
            return {
                type: 'and',
                clauses: clauses.map((v) => this.parseQueryParsed(v))
            };
        } else {
            let tp = this.registeredFields.get(type.toLocaleLowerCase());
            if (!tp) {
                throw Error('Unknown field "' + type + '"');
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
                    throw Error('Unsupported int field value ' + value);
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
                } else {
                    throw Error('Unsupported int field value ' + value);
                }
            } else if (tp.type === 'text') {
                let value = src[type];
                if (typeof value === 'string') {
                    return {
                        type: 'field',
                        field: tp.mappedName,
                        exact: value
                    };
                } else {
                    throw Error('Unsupported int field value ' + value);
                }
            } else {
                throw Error('Unsupported field type ' + tp.type);
            }
        }
    }
}