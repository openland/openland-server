import { createContextNamespace, Context } from '@openland/context';

export const SpaceXContext = createContextNamespace('spacex', false);

export function isWithinSpaceX(ctx: Context) {
    return SpaceXContext.get(ctx);
}