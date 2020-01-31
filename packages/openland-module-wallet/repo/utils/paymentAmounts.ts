import { checkMoney } from './checkMoney';

export function paymentAmounts(walletBalance: number, amount: number) {
    if (walletBalance !== 0) {
        checkMoney(walletBalance);
    }
    checkMoney(amount);

    if (amount < 100) {
        throw Error('Amount can not be less than 1$');
    }

    if (walletBalance === 0) {
        return { wallet: 0, charge: amount };
    } else {
        if (walletBalance >= amount) {
            return { wallet: amount, charge: 0 };
        }
        if (amount - walletBalance < 100) {
            return { wallet: amount - 100, charge: 100 };
        } else {
            return { wallet: walletBalance, charge: amount - walletBalance };
        }
    }
}