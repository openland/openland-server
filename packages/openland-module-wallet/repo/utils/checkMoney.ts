export function checkMoney(amount: number) {
    if (amount <= 0) {
        throw Error('Money Amount must be postive ingeter');
    }
    if (!Number.isSafeInteger(amount)) {
        throw Error('Money Amount must be postive ingeter');
    }
}