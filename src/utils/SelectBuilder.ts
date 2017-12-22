import { DB } from '../tables/index';
import { sumRaw, countRaw, textLikeFieldsText } from './db_utils';
import * as sequelize from 'sequelize';

export type Order = 'ASC' | 'DESC' | 'ASC NULLS FIRST' | 'ASC NULLS LAST' | 'DESC NULLS FIRST' | 'DESC NULLS LAST'

export class SelectBuilder<TInstance, TAttributes> {

    table: sequelize.Model<TInstance, TAttributes>;

    private orderbyFields: Array<{ field: string, order: string }> = new Array();
    private textFilterFields: Array<string> = new Array();
    private filterText: string | null = null
    private conditions: Array<string> = new Array();
    private conditionsEq: Array<{ field: string, value: any }> = new Array();
    private limitValue: number | null = null
    private afterValue: string | null = null
    private pageValue: number | null = null
    private tx: sequelize.Transaction | null = null

    constructor(table: sequelize.Model<TInstance, TAttributes>) {
        this.table = table
    }

    withTx(tx?: sequelize.Transaction) {
        let cloned = this.clone();
        if (tx) {
            cloned.tx = tx
        } else {
            cloned.tx = null
        }
        return cloned
    }

    limit(limit?: number) {
        let cloned = this.clone();
        if (limit) {
            if (limit <= 0) {
                cloned.limitValue = null
            } else if (limit > 100) {
                throw "Maximum number of fetched results is " + 100
            } else {
                cloned.limitValue = limit;
            }
        } else {
            cloned.limitValue = null
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
        if (tuples.length == 0) {
            cloned.conditions.push("FALSE");
        } else {
            var attributes = (this.table as any).attributes
            var sqlFields = '(' + fields.map((p) => {
                let attr = attributes[p]
                if (!attr) {
                    throw "Attribute " + p + " not found"
                }
                return '"' + p + '"'
            }).join() + ')'
            var sqlTuples = '(' + tuples.map((p) =>
                '(' + p.map((v) => {
                    if (v == null || v == undefined) {
                        console.warn(p)
                        throw "Null value found!"
                    } else if (typeof v === "string") {
                        return DB.connection.escape(v)
                    } else {
                        return v
                    }
                }).join() + ')'
            ).join() + ')'
            cloned.conditions.push(sqlFields + " IN " + sqlTuples);
        }
        return cloned;
    }

    orderByRaw(field: string, order?: Order) {
        let cloned = this.clone();
        if (order) {
            cloned.orderbyFields.push({ field: field, order: order });
        } else {
            cloned.orderbyFields.push({ field: field, order: "ASC" });
        }
        return cloned;
    }

    orderBy(field: string, order?: Order) {
        return this.orderByRaw(`"${field}"`, order)
    }

    filter(text?: string) {
        let cloned = this.clone();
        if (text != undefined && text != null && text.trim().length > 0) {
            cloned.filterText = text;
        } else {
            cloned.filterText = null;
        }
        return cloned;
    }

    filterField(field: string) {
        let cloned = this.clone();
        cloned.textFilterFields.push(field)
        return cloned;
    }

    buildOrderBy() {
        let converted = this.orderbyFields.map((p) => `${p.field} ${p.order}`)
        let all = [...converted, `"id" ASC`];
        return all.join(", ");
    }

    buildWhere() {
        let eqConditions = this.conditionsEq.map((p) => {
            if (p.value === null) {
                return `"${p.field}" IS NULL`
            } else if (typeof (p.value) === "string") {
                return `"${p.field}" = ` + DB.connection.escape(p.value)
            } else {
                return `"${p.field}" = ` + p.value
            }
        })
        var conditions = [...this.conditions, ...eqConditions];
        if (this.filterText != null) {
            conditions.push(textLikeFieldsText(this.filterText.trim(), this.textFilterFields));
        }
        if (conditions.length == 0) {
            return null
        } else if (conditions.length == 1) {
            return conditions[0]
        } else {
            return conditions.join(' AND ')
        }
    }

    async findAllDirect(include?: Array<sequelize.Model<any, any> | sequelize.IncludeOptions>) {
        console.warn(this.buildWhere());
        return this.table.findAll({
            where: DB.connection.literal(this.buildWhere()) as any,
            include: include,
            transaction: this.tx ? this.tx : undefined
        })
    }

    async findAll(include?: Array<sequelize.Model<any, any> | sequelize.IncludeOptions>) {
        if (this.limitValue == null) {
            throw "Limit should be set!"
        }
        let offset = 0
        if (this.afterValue) {
            offset = parseInt(this.afterValue);
        } else if (this.pageValue) {
            offset = (this.pageValue - 1) * this.limitValue;
        }
        let res = await this.table.findAll({
            where: DB.connection.literal(this.buildWhere()) as any,
            order: DB.connection.literal(this.buildOrderBy()),
            limit: this.limitValue,
            offset: offset,
            include: include,
            transaction: this.tx ? this.tx : undefined
        })
        let count = await this.count()
        return {
            edges: res.map((p, i) => {
                return {
                    node: p,
                    cursor: (i + 1 + offset).toString()
                }
            }),
            pageInfo: {
                hasNextPage: res.length == this.limitValue,
                hasPreviousPage: false,

                itemsCount: count,
                pagesCount: Math.floor(count / this.limitValue),
                currentPage: Math.floor(offset / this.limitValue) + 1
            },
        }
    }

    async sum(field: string) {
        return sumRaw(this.table.getTableName() as string, field, this.buildWhere())
    }

    async count() {
        return countRaw(this.table.getTableName() as string, this.buildWhere())
    }

    private clone() {
        var res = new SelectBuilder(this.table);
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