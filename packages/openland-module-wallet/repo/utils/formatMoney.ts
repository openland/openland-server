import { Nullable } from 'openland-module-api/schema/SchemaUtils';

export const formatMoney = (amount: number) => {
    let a = amount < 0 ? -amount : amount; // Division of incorrect numbers is incorrect in CPU
    let d = Math.floor(a / 100);
    let c = a % 100;

    let cs = c.toString();
    if (c < 10) {
        cs = '0' + cs;
    }
    return '$' + (amount < 0 ? '-' : '') + (d.toString() + '.' + cs);
};

type PremiumInterval = 'month' | 'week';

export const formatMoneyWithInterval = (amount: number, interval: Nullable<PremiumInterval>) => {
    if (!interval) {
        return formatMoney(amount);
    }
    let textByInterval: {[i in PremiumInterval]: string} = {
        month: 'mo',
        week: 'wk'
    };
    let intervalText = textByInterval[interval];
    return !!intervalText ? `${formatMoney(amount)} / ${intervalText}` : formatMoney(amount);
};