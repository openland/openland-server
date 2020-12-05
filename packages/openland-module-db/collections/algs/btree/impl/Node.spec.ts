import { Node, packNode, unpackNode } from './Node';

function testPack(node: Node) {
    let packed = packNode(node);
    let unpacked = unpackNode(packed);
    expect(unpacked).toMatchObject(node);
}

describe('Node', () => {
    it('should pack and unpack nodes', () => {
        testPack({ type: 'leaf', id: 1, parent: null, children: [] });
        testPack({ type: 'leaf', id: 2, parent: null, children: [{ key: 1, value: Buffer.from([]) }] });
        testPack({ type: 'leaf', id: 3, parent: 3, children: [{ key: 2, value: Buffer.from([]) }, { key: 1, value: Buffer.from([]) }] });

        testPack({ type: 'internal', id: 1, parent: null, children: [] });
        testPack({ type: 'internal', id: 2, parent: null, children: [{ count: 10, node: 1, min: 10, max: 10 }] });
        testPack({ type: 'internal', id: 3, parent: 2, children: [{ count: 10, node: 1, min: 9, max: 10 }, { count: 12, node: 5, min: 15, max: 16 }] });
    });
});