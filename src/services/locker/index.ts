/**
 * Redis-locker Library
 * Copyright (C) 2020 E01-AIO Automação Ltda.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Nelio Santos <nsfilho@icloud.com>
 * 
 */
/* eslint-disable no-console */

import dayjs from 'dayjs';
import { getConnection, disconnect } from '@nsfilho/redis-connection';
import { nanoid } from 'nanoid';
import {
    LOCKER_PREFIX,
    LOCKER_PING_TIMEOUT,
    LOCKER_CHECK_INTERVAL,
    LOCKER_PING_INTERVAL,
    LOCKER_DEBUG_CONSOLE,
} from '../../constants';

export interface ResourceContent {
    uniqueId: string;
    from: string;
    ping: string;
}

export interface askForResourceOptions {
    resourceName: string;
    resourcePath: string;
}

export interface lockerResourceOptions {
    resourceName: string;
    interval?: number;
    callback: () => Promise<void>;
}

const internalState: {
    count: number;
} = {
    count: 0,
};

/** Exclusive name */
export const lockerFrom = nanoid();

/**
 * Add to queue of a specific resource
 * @param options resource ask for
 */
const askForResource = async (options: askForResourceOptions): Promise<ResourceContent> => {
    const { resourceName, resourcePath } = options;
    const redis = await getConnection();
    const asking: ResourceContent = {
        uniqueId: nanoid(),
        from: lockerFrom,
        ping: dayjs().toISOString(),
    };
    if (LOCKER_DEBUG_CONSOLE) console.log(`LOCKER(${asking.uniqueId}): Asking for lock resource: ${resourceName}`);
    await redis.rpush(resourcePath, JSON.stringify(asking));
    return asking;
};

/**
 * Lock resource between many instances of this software
 * @param options parameters to lock some resource in all instance
 * @returns a number of other instances asked to lock the same resource
 */
export const lockResource = async (options: lockerResourceOptions): Promise<void> => {
    const { resourceName, interval, callback } = options;
    const resourcePath = `${LOCKER_PREFIX}:${resourceName}`;
    const redis = await getConnection();
    const asked = await askForResource({ resourceName, resourcePath });
    internalState.count += 1;
    return new Promise((resolve) => {
        // check actual resource waiting list
        let executing = false;
        const waitingForResource = setInterval(async () => {
            // update ping for this resource
            if (dayjs().diff(asked.ping, 'millisecond') > LOCKER_PING_INTERVAL) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const index = await redis.lpos(resourcePath, JSON.stringify(asked));
                asked.ping = dayjs().toISOString();
                await redis.lset(resourcePath, index, JSON.stringify(asked));
            }

            // check if it is my turn to execute
            const indexZero = await redis.lindex(resourcePath, 0);
            const actual = JSON.parse(indexZero) as ResourceContent;
            if (actual.uniqueId === asked.uniqueId && !executing) {
                executing = true;
                setImmediate(async () => {
                    if (LOCKER_DEBUG_CONSOLE)
                        console.log(`LOCKER(${asked.uniqueId}): Executing locked resource: ${resourceName}`);
                    await callback();

                    /** Maintain until callback finished, because we need update ping */
                    clearInterval(waitingForResource);

                    /** release the resource */
                    await redis.ltrim(resourcePath, 1, -1);

                    /** check for disconnect or not from redis */
                    internalState.count -= 1;
                    if (internalState.count === 0) await disconnect();

                    /** finish this process */
                    resolve();
                });
            } else if (!executing && dayjs().diff(actual.ping, 'millisecond') > LOCKER_PING_TIMEOUT) {
                // who asked by resource is die
                await redis.ltrim(resourcePath, 1, -1);
            }
        }, interval || LOCKER_CHECK_INTERVAL);
    });
};
