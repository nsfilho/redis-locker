import { nanoid } from 'nanoid';
import { disconnect } from '@nsfilho/redis-connection';
import { lockResource } from './index';

jest.setTimeout(90000);
describe('Simple concurrency', () => {
    const x = 100;
    const trava = nanoid();
    it('Five process, one per turn', async () => {
        expect.assertions(x);
        const order: number[] = [];
        const funcTest = (index: number) =>
            new Promise((resolve) => {
                // console.log('Agendado:', index);
                setTimeout(() => {
                    order.push(index);
                    // console.log('Finalizado:', index);
                    resolve(true);
                }, 1);
            });
        const func = async (index: number) => {
            await lockResource({
                resourceName: trava,
                callback: () => funcTest(index),
            });
        };
        const myProcess = [];
        for (let k = 0; k < 100; k += 1) myProcess.push(func(k));
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
