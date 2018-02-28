import { DB } from '../tables';
import { sumRaw, countRaw, textLikeFieldsText, percentileRaw, histogramCountRaw, histogramSumRaw } from '../utils/db_utils';
import * as sequelize from 'sequelize';
import { SearchResponse } from 'elasticsearch';

export type Order = 'ASC' | 'DESC' | 'ASC NULLS FIRST' | 'ASC NULLS LAST' | 'DESC NULLS FIRST' | 'DESC NULLS LAST';

export class SelectBuilder<TInstance, TAttributes> {

    table: sequelize.Model<TInstance, TAttributes>;

    private orderbyFields: Array<{ field: string, order: string }> = [];
    private textFilterFields: Array<string> = [];
    private filterText: string | null = null;
    private conditions: Array<string> = [];
    private conditionsEq: Array<{ field: string, value: any }> = [];
    private limitValue: number | null = null;
    private afterValue: string | null = null;
    private pageValue: number | null = null;
    private tx: sequelize.Transaction | null = null;
    private processor: ((src: TInstance[]) => TInstance[]) | null = null;

    constructor(table: sequelize.Model<TInstance, TAttributes>) {
        this.table = table;
    }

    withTx(tx?: sequelize.Transaction) {
        let cloned = this.clone();
        if (tx) {
            cloned.tx = tx;
        } else {
            cloned.tx = null;
        }
        return cloned;
    }

    limit(limit?: number) {
        let cloned = this.clone();
        if (limit) {
            if (limit <= 0) {
                cloned.limitValue = null;
            } else if (limit > 100) {
                throw 'Maximum number of fetched results is ' + 100;
            } else {
                cloned.limitValue = limit;
            }
        } else {
            cloned.limitValue = null;
        }
        return cloned;
    }

    after(after?: string) {
        let cloned = this.clone();
        if (after) {
            cloned.afterValue = after;
        } else {
            cloned.afterValue = null;
        }
        return cloned;
    }

    page(page?: number) {
        let cloned = this.clone();
        if (page) {
            if (page <= 1) {
                cloned.pageValue = null;
            } else {
                cloned.pageValue = page;
            }
        } else {
            cloned.pageValue = null;
        }
        return cloned;
    }

    where(condition: string) {
        let cloned = this.clone();
        cloned.conditions.push(condition);
        return cloned;
    }

    whereEq(field: string, value: any) {
        let cloned = this.clone();
        cloned.conditionsEq.push({ field: field, value: value });
        return cloned;
    }

    whereIn(fields: string[], tuples: any[][]) {
        let cloned = this.clone();
        if (tuples.length === 0) {
            cloned.conditions.push('FALSE');
        } else {
            let attributes = (this.table as any).attributes;
            let sqlFields = fields.map((p) => {
                let attr = attributes[p];
                if (!attr) {
                    throw 'Attribute ' + p + ' not found';
                }
                return '"' + p + '"';
            }).join();
            let sqlTuples = '(' + tuples.map((p) => {
                let res = p.map((v) => {
                    if (v == null || v === undefined) {
                        console.warn(p);
                        throw 'Null value found!';
                    } else if (typeof v === 'string') {
                        return DB.connection.escape(v);
                    } else {
                        return v;
                    }
                }).join();
                if (fields.length > 1) {
                    res = '(' + res + ')';
                }
                return res;
            }
            ).join() + ')';
            if (fields.length > 1) {
                sqlFields = '(' + sqlFields + ')';
            }
            cloned.conditions.push(sqlFields + ' IN ' + sqlTuples);
        }
        return cloned;
    }

    orderByRaw(field: string, order?: Order) {
        let cloned = this.clone();
        if (order) {
            cloned.orderbyFields.push({ field: field, order: order });
        } else {
            cloned.orderbyFields.push({ field: field, order: 'ASC' });
        }
        return cloned;
    }

    orderBy(field: string, order?: Order) {
        return this.orderByRaw(`"${field}"`, order);
    }

    postProcessor(processor?: (src: TInstance[]) => TInstance[]) {
        let cloned = this.clone();
        if (processor) {
            cloned.processor = processor;
        } else {
            cloned.processor = null;
        }
        return cloned;
    }

    filter(text?: string) {
        let cloned = this.clone();
        if (text !== undefined && text != null && text.trim().length > 0) {
            cloned.filterText = text;
        } else {
            cloned.filterText = null;
        }
        return cloned;
    }

    filterField(field: string) {
        let cloned = this.clone();
        cloned.textFilterFields.push(field);
        return cloned;
    }

    buildOrderBy() {
        let converted = this.orderbyFields.map((p) => `${p.field} ${p.order}`);
        let all = [...converted, `"id" ASC`];
        return all.join(', ');
    }

    buildWhere() {
        let eqConditions = this.conditionsEq.map((p) => {
            if (p.value === null) {
                return `"${p.field}" IS NULL`;
            } else if (typeof (p.value) === 'string') {
                return `"${p.field}" = ` + DB.connection.escape(p.value);
            } else {
                return `"${p.field}" = ` + p.value;
            }
        });
        let conditions = [...this.conditions, ...eqConditions];
        if (this.filterText != null) {
            conditions.push(textLikeFieldsText(this.filterText.trim(), this.textFilterFields));
        }
        if (conditions.length === 0) {
            return null;
        } else if (conditions.length === 1) {
            return conditions[0];
        } else {
            return conditions.join(' AND ');
        }
    }

    async findAllDirect(include?: Array<sequelize.Model<any, any> | sequelize.IncludeOptions>) {
        console.warn(this.buildWhere());
        return this.table.findAll({
            where: DB.connection.literal(this.buildWhere()) as any,
            include: include,
            transaction: this.tx ? this.tx : undefined
        });
    }

    async findElastic(response: SearchResponse<any>, include?: Array<sequelize.Model<any, any> | sequelize.IncludeOptions>) {
        if (this.limitValue == null) {
            throw 'Limit should be set!';
        }
        let ids = response.hits.hits.map((v) => parseInt(v._id, 10));
        let elements = await this.table.findAll({
            where: {
                id: {
                    $in: ids
                }
            } as any,
            include: include
        });
        let mappedElements = new Map<number, TInstance>();
        for (let e of elements) {
            mappedElements.set((e as any).id!!, e);
        }
        let restored = [];
        for (let i of ids) {
            if (mappedElements.get(i)) {
                restored.push(mappedElements.get(i)!!);
            }
        }
        let offset = 0;
        if (this.afterValue) {
            offset = parseInt(this.afterValue, 10);
        } else if (this.pageValue) {
            offset = (this.pageValue - 1) * this.limitValue;
        }
        let total = response.hits.total;

        return {
            edges: restored.map((p, i) => {
                return {
                    node: p,
                    cursor: (i + 1 + offset).toString()
                };
            }),
            pageInfo: {
                hasNextPage: ids.length === this.limitValue,
                hasPreviousPage: false,

                itemsCount: total,
                pagesCount: Math.min(Math.floor(8000 / this.limitValue), Math.floor(total / this.limitValue)),
                currentPage: Math.floor(offset / this.limitValue) + 1,
                openEnded: true
            },
        };
    }

    async findAll(include?: Array<sequelize.Model<any, any> | sequelize.IncludeOptions>) {
        if (this.limitValue == null) {
            throw 'Limit should be set!';
        }
        let offset = 0;
        if (this.afterValue) {
            offset = parseInt(this.afterValue, 10);
        } else if (this.pageValue) {
            offset = (this.pageValue - 1) * this.limitValue;
        }
        let where = this.buildWhere();
        let orderBy = this.buildOrderBy();
        let res = await this.table.findAll({
            where: DB.connection.literal(where) as any,
            order: DB.connection.literal(orderBy),
            limit: this.processor === null ? this.limitValue : undefined,
            offset: this.processor === null ? offset : undefined,
            include: include,
            transaction: this.tx ? this.tx : undefined
        });
        if (this.processor !== null) {
            res = this.processor(res);
            res = res.splice(offset, this.limitValue);
        }
        let count = await this.count();
        return {
            edges: res.map((p, i) => {
                return {
                    node: p,
                    cursor: (i + 1 + offset).toString()
                };
            }),
            pageInfo: {
                hasNextPage: res.length === this.limitValue,
                hasPreviousPage: false,

                itemsCount: count,
                pagesCount: Math.floor(count / this.limitValue),
                currentPage: Math.floor(offset / this.limitValue) + 1,
                openEnded: false
            },
        };
    }

    async sum(field: string) {
        return sumRaw(this.table.getTableName() as string, field, this.buildWhere());
    }

    async count() {
        return countRaw(this.table.getTableName() as string, this.buildWhere());
    }

    async percentile(percentiles: [number], by: string) {
        return percentileRaw(this.table.getTableName() as string, percentiles, by, this.buildWhere());
    }

    async histogramCount(by: string) {
        return histogramCountRaw(this.table.getTableName() as string, by, this.buildWhere());
    }

    async histogramSum(field: string, by: string) {
        return histogramSumRaw(this.table.getTableName() as string, by, field, this.buildWhere());
    }

    private clone() {
        let res = new SelectBuilder(this.table);
        res.orderbyFields = JSON.parse(JSON.stringify(this.orderbyFields));
        res.textFilterFields = JSON.parse(JSON.stringify(this.textFilterFields));
        res.filterText = this.filterText;
        res.conditions = JSON.parse(JSON.stringify(this.conditions));
        res.conditionsEq = JSON.parse(JSON.stringify(this.conditionsEq));
        res.limitValue = this.limitValue;
        res.afterValue = this.afterValue;
        res.pageValue = this.pageValue;
        res.tx = this.tx;
        return res;
    }
}