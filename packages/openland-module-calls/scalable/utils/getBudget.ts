export function getBudget(args: { producers: number, consumers: number }) {
    return args.producers + args.consumers + args.producers * args.consumers;
}

export function getBudgetDiff(a: { producers: number, consumers: number }, b: { producers: number, consumers: number }) {
    return getBudget(b) - getBudget(a);
}