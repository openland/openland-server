import linkify from 'linkify-it';
import tlds from 'tlds';

export function createLinkifyInstance() {
    return linkify()
        .tlds(tlds)
        .add('zpl:', 'http:')
        .tlds('onion', true);
}