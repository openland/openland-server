import { Container } from 'inversify';
import getDecorators from 'inversify-inject-decorators';

let container = new Container();
export const { lazyInject } = getDecorators(container, false);
export { container };