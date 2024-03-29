import { debug } from 'debug';
import { nanoid } from 'nanoid';
import { disconnect } from '@nsfilho/redis-connection';
import { lockResource, stopLocalLockResource } from './index';
import { addRemote, getTime } from './redis';
import { LOCKER_PING_INTERVAL, LOCKER_PING_TIMEOUT } from '../../constants';

const logger = {
    info: debug('jest-info'),
};

const redis = {
    instance: 'redisLocker',
};

jest.setTimeout(30000);

describe('Simple concurrency', () => {
    const x = 10;
    const trava = 'iruli';
    it(`Process: ${x} requisitions, one per turn`, async () => {
        expect.assertions(x);
        const order: number[] = [];
        const funcTest = (index: number) =>
            new Promise((resolve) => {
                setTimeout(() => {
                    order.push(index);
                    // eslint-disable-next-line no-console
                    logger.info(`Finalizado: ${order.length}`);
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

describe('Throw tests', () => {
    it('Without onError', async () => {
        expect.assertions(1);
        try {
            await lockResource({
                resourceName: nanoid(),
                redis,
                callback: async () => {
                    throw new Error('this is an error');
                },
            });
            throw new Error('In this use case, needs stop the execution');
        } catch (err) {
            expect(err).toEqual(new Error('this is an error'));
        }
    });

    it('With onError, without Throw in onError', async () => {
        expect.assertions(2);
        try {
            const result = await lockResource({
                resourceName: nanoid(),
                redis,
                callback: async () => {
                    throw new Error('this is another error');
                },
                onError: (err) => {
                    expect(err).toEqual(new Error('this is another error'));
                },
            });
            expect(result).toBeNull();
        } catch (err) {
            throw new Error('When you not throw in onError, the function needs continue');
        }
    });

    it('With onError, with Throw in onError', async () => {
        expect.assertions(2);
        try {
            await lockResource({
                resourceName: nanoid(),
                redis,
                callback: async () => {
                    throw new Error('Original error');
                },
                onError: (err) => {
                    // eslint-disable-next-line no-console
                    expect(err).toEqual(new Error('Original error'));
                    throw new Error('Complete new error');
                },
            });
        } catch (err) {
            expect(err).toEqual(new Error('Complete new error'));
        }
    });
});

describe('Dealing death jobs', () => {
    it('Remove death jobs', async () => {
        expect.assertions(1);
        const currentTime = await getTime({ redis });
        await addRemote({
            resourcePath: 'dealingWithDeaths',
            redis,
            lastPing: currentTime - LOCKER_PING_TIMEOUT,
            uniqueId: nanoid(),
        });
        await lockResource({
            resourceName: 'dealingWithDeaths',
            redis,
            callback: async () => {
                const deltaTime = await getTime({ redis });
                expect(deltaTime - currentTime).toBeLessThanOrEqual(LOCKER_PING_INTERVAL * 2);
            },
        });
    });
});

afterAll((done) => {
    Promise.all([disconnect(), disconnect(redis), stopLocalLockResource()]).then(() => done());
});
