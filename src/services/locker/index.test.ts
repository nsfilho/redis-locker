import { nanoid } from 'nanoid';
import { disconnect } from '@nsfilho/redis-connection';
import { lockResource } from './index';

jest.setTimeout(120000);
describe('Simple concurrency', () => {
    const x = 3000;
    const trava = 'iruli';
    it(`Protess: ${x} requisitions, one per turn`, async () => {
        expect.assertions(x);
        const order: number[] = [];
        const funcTest = (index: number) =>
            new Promise((resolve) => {
                setTimeout(() => {
                    order.push(index);
                    // eslint-disable-next-line no-console
                    console.log('Finalizado:', order.length);
                    resolve(true);
                }, 10);
            });
        const func = async (index: number) => {
            await lockResource({
                resourceName: trava,
                callback: () => funcTest(index),
            });
        };
        const myProcess = [];
        for (let k = 0; k < x; k += 1) myProcess.push(func(k));
        await Promise.all(myProcess);
        order.sort((a, b) => {
            if (a > b) return 1;
            if (a < b) return -1;
            return 0;
        });
        for (let y = 0; y < order.length; y += 1) expect(order[y]).toEqual(y);
    });
});

afterAll(() => {
    disconnect();
});
