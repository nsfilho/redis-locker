/* eslint-disable no-console */
import { lockResource } from '../src';

/** Create a delay timer */
const delay = async (timer: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, timer);
    });

/** Locking a resource for all instances of this software */
lockResource({
    resourceName: 'lockTest',
    callback: async () => {
        console.log('Locking this resource for all instance by 10 secs');
        await delay(10000);
        console.log('Unlocking, making available for others!');
    },
});
