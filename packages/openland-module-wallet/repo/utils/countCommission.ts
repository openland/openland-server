export function countCommission(amount: number, commissionPercent: number) {
    let commission = Math.floor(amount / 100 * commissionPercent);
    return { commission, rest: amount - commission, amount };
}
