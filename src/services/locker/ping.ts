/**
 * Redis-locker Library
 * Copyright (C) 2020 E01-AIO Automação Ltda.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
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
import debug from 'debug';
import {
    LOCKER_CHECK_INTERVAL,
    LOCKER_PING_EVENT_FORCE,
    LOCKER_PING_INTERVAL,
    LOCKER_PING_TIMEOUT,
    LOCKER_RESOURCE_EXIT_TIMEOUT,
} from '../../constants';
import { getTime, addRemote, multipleSetRemote, deleteRemote, listRemote, RedisInstance } from './redis';
import type { ChildMessage } from './pingbox';

const logger = {
    error: debug('redis-locker:ping-error'),
    info: debug('redis-locker:ping-info'),
    debug: debug('redis-locker:ping-debug'),
};

const control: {
    [index: string]: {
        /** time to check the next current */
        interval: number;

        /** stop handler */
        stopHandler: NodeJS.Timeout | null;

        /** time to consider a ping timeout */
        pingTimeOut: number;

        /** control ping loop for this resource */
        running: boolean;

        items: string[];
    };
} = {};

const flowControl: {
    uniqueId: string;
    resourcePath: string;
} = {
    uniqueId: '',
    resourcePath: '',
};

interface eventPingOptions {
    resourcePath: string;
    uniqueId: string;
}

const eventPing = ({ resourcePath, uniqueId }: eventPingOptions) => {
    logger.debug(
        `(${process.pid}) eventPing: ${resourcePath}, ${flowControl.resourcePath}, ${uniqueId}, ${flowControl.uniqueId}`,
    );
    if (
        process.send &&
        (LOCKER_PING_EVENT_FORCE || flowControl.uniqueId !== uniqueId || flowControl.resourcePath !== resourcePath)
    ) {
        logger.info(`${process.pid} eventPing: send start ${resourcePath}, ${uniqueId}`);
        flowControl.uniqueId = uniqueId;
        flowControl.resourcePath = resourcePath;
        process.send({ type: 'next', resourcePath, uniqueId });
    }
};

interface loopPingOptions {
    resourcePath: string;
    redis?: RedisInstance;
}

const loopPing = async ({ resourcePath, redis }: loopPingOptions) => {
    let lastPing = 0;
    let lastDeaths = 0;
    let deaths: string[] = [];
    const resource = control[resourcePath];
    const delay = () => new Promise((resolve) => setTimeout(resolve, resource.interval));
    for (; resource.running; ) {
        // eslint-disable-next-line no-await-in-loop
        const currentTime = await getTime({ redis });

        if (currentTime - lastPing > LOCKER_PING_INTERVAL && resource.items.length > 0) {
            // update locals
            const updates: string[] = [];
            for (let x = 0; x < resource.items.length; x += 1) {
                updates.push(resource.items[x]);
                updates.push(currentTime.toString());
            }
            // eslint-disable-next-line no-await-in-loop
            await multipleSetRemote({ resourcePath, redis, keyValueArray: updates });
            lastPing = currentTime;
        }

        // eslint-disable-next-line no-await-in-loop
        const queue = await listRemote({ resourcePath, redis });
        if (currentTime - lastDeaths > resource.pingTimeOut) {
            // check deaths
            deaths = queue
                .filter((item) => currentTime - item.lastPing > resource.pingTimeOut)
                .map((item) => item.uniqueId);
            if (deaths.length > 0) {
                // eslint-disable-next-line no-await-in-loop
                await deleteRemote({ resourcePath, redis, keys: deaths });
            }
            lastDeaths = currentTime;
        }

        // take next
        // eslint-disable-next-line no-loop-func
        const next = queue.find((item) => !deaths.includes(item.uniqueId));
        logger.debug(
            `(${process.pid}) startPing item: ${next?.uniqueId} (ping: ${next?.lastPing}/${currentTime}), for ${resourcePath}`,
        );
        if (next && resource.items.includes(next.uniqueId)) {
            eventPing({ resourcePath, uniqueId: next.uniqueId });
        }

        // eslint-disable-next-line no-await-in-loop
        await delay();
    }
};

interface startPingOptions {
    resourcePath: string;
    redis?: RedisInstance;
}

const startPing = ({ resourcePath, redis }: startPingOptions) => {
    logger.info(`(${process.pid}) Starting ping control for resource: ${resourcePath}`);
    setTimeout(async () => {
        await loopPing({ resourcePath, redis });
        delete control[resourcePath];
        logger.debug(`Stopped ping control for resource: ${resourcePath}`);
        if (Object.keys(control).length === 0) {
            logger.debug(`Stopping thread`);
            /** This will stop the connections with redis too */
            process.exit(0);
        }
    }, control[resourcePath].interval);
};

interface stopPingOptions {
    resourcePath: string;
}

const stopPing = ({ resourcePath }: stopPingOptions) => {
    logger.info(`(${process.pid}) Stopping ping control for resource: ${resourcePath}`);
    if (control[resourcePath]) {
        control[resourcePath].stopHandler = setTimeout(() => {
            control[resourcePath].running = false;
        }, LOCKER_RESOURCE_EXIT_TIMEOUT);
    }
};

export interface addPingOptions {
    uniqueId: string;
    resourcePath: string;
    redis?: RedisInstance;
}

export const addPing = ({ resourcePath, redis, uniqueId }: addPingOptions) => {
    // add local
    if (!control[resourcePath]) {
        let interval = LOCKER_CHECK_INTERVAL;
        if (LOCKER_CHECK_INTERVAL < 5) {
            logger.info('addPing found a problem: too small LOCKER_CHECK_INTERVAL. Using a default');
            interval = 5;
        }
        let pingTimeOut = LOCKER_PING_TIMEOUT;
        if (LOCKER_PING_TIMEOUT < interval) {
            logger.info('addPing found a problem: LOCKER_PING_TIMEOUT < LOCKER_CHECK_INTERVAL. Using a default');
            pingTimeOut = interval * 2;
        }
        control[resourcePath] = {
            items: [],
            stopHandler: null,
            interval,
            pingTimeOut,
            running: true,
        };
        startPing({ resourcePath, redis });
    }
    getTime({ redis })
        .then((currentTime) => {
            const localControl = control[resourcePath];
            if (localControl.stopHandler) {
                clearTimeout(localControl.stopHandler);
                localControl.stopHandler = null;
            }
            localControl.items.push(uniqueId);
            return addRemote({ resourcePath, redis, uniqueId, lastPing: currentTime });
        })
        .catch((err) => {
            logger.info(`addPing failed: ${err}, for resource: ${resourcePath} and request: ${uniqueId}`);
        });
};

export interface removePingOptions {
    uniqueId: string;
    resourcePath: string;
    redis?: RedisInstance;
}

export const removePing = ({ resourcePath, redis, uniqueId }: removePingOptions) => {
    if (!control[resourcePath]) {
        logger.info(`Remove ping for resource: ${resourcePath}, failed`);
        return;
    }
    logger.info(`Removing ping for: ${resourcePath} and request: ${uniqueId}`);
    control[resourcePath].items = control[resourcePath].items.filter((c) => c !== uniqueId);
    deleteRemote({ resourcePath, redis, keys: [uniqueId] });
    if (control[resourcePath].items.length === 0) {
        logger.debug(`Cleaning ping control for resource: ${resourcePath}`);
        stopPing({ resourcePath });
    }
};

process.on('message', ({ type, resourcePath, redis, uniqueId }: ChildMessage) => {
    switch (type) {
        case 'addPing':
            addPing({ resourcePath, redis, uniqueId });
            break;
        case 'removePing':
            removePing({ resourcePath, redis, uniqueId });
            break;
        case 'exit':
            // pingbox asked us for die
            process.exit(0);
            break;
        default:
            logger.info(`Ping message unrecognized: ${type}`);
    }
});
