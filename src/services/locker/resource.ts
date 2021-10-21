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
import { nanoid } from 'nanoid';
import { getTime } from './redis';
import { addPing, removePing } from './pingbox';

const logger = {
    error: debug('redis-locker:resource-error'),
    info: debug('redis-locker:resource-info'),
    debug: debug('redis-locker:resource-debug'),
};

interface ResourceItem<T, E> {
    callback: () => Promise<T> | T;
    onError?: (error: E) => Promise<void> | void;
    onThrowError: (error: E) => Promise<void> | void;
    onFinished: (result: T | null) => void;
}

interface ControlItem<T, E> extends ResourceItem<T, E> {
    uniqueId: string;
    addedAt: number;
    startedAt?: number;
    running: boolean;
}

const control: {
    // eslint-disable-next-line
    [index: string]: ControlItem<any, any>[];
} = {};

interface addResourceOptions<T, E> extends ResourceItem<T, E> {
    resourcePath: string;
}

export const addResource = async <T, E>({
    resourcePath,
    callback,
    onError,
    onThrowError,
    onFinished,
}: addResourceOptions<T, E>) => {
    if (!control[resourcePath]) {
        logger.debug(`Creating resource: ${resourcePath}`);
        control[resourcePath] = [];
    }
    const currentTime = await getTime();
    const item: ControlItem<T, E> = {
        addedAt: currentTime,
        uniqueId: nanoid(),
        running: false,
        callback,
        onError,
        onThrowError,
        onFinished,
    };
    logger.info(`Adding on ${resourcePath}, request: ${item.uniqueId}`);
    control[resourcePath].push(item);
    addPing({ resourcePath, uniqueId: item.uniqueId });
};

interface cleanResourceOptions {
    resourcePath: string;
}

const cleanResource = async ({ resourcePath }: cleanResourceOptions) => {
    logger.debug(`Finishing resource: ${resourcePath}`);
    // stop to listening events
    delete control[resourcePath];
};

interface removeResourceOptions {
    uniqueId: string;
    resourcePath: string;
}

const removeResource = ({ resourcePath, uniqueId }: removeResourceOptions) => {
    removePing({ resourcePath, uniqueId });
    control[resourcePath] = control[resourcePath].filter((item) => item.uniqueId !== uniqueId);
    if (control[resourcePath].length === 0) cleanResource({ resourcePath });
};

interface runResourceOptions {
    resourcePath: string;
    uniqueId: string;
}

const runResource = async ({ resourcePath, uniqueId }: runResourceOptions) => {
    if (!control[resourcePath]) {
        logger.info(`Run resource path: ${resourcePath} not found`);
        return null;
    }

    const resourceToRun = control[resourcePath].find((item) => item.uniqueId === uniqueId);
    if (!resourceToRun) {
        logger.info(`Run resource item: ${uniqueId} not found`);
        return null;
    }

    /** Mark as in execution */
    logger.info(`Run resource path: ${resourcePath}, item: ${uniqueId} - started!`);
    resourceToRun.running = true;
    resourceToRun.startedAt = await getTime();

    /** Run the callback function */
    let result = null;
    try {
        result = await resourceToRun.callback();

        /** statistics purposes */
        const finishedTime = await getTime();
        logger.debug(
            `Run resource path: ${resourcePath}, item: ${uniqueId} - finished (${
                finishedTime - resourceToRun.startedAt
            })`,
        );
        removeResource({ resourcePath, uniqueId });
        resourceToRun.onFinished(result);
    } catch (err) {
        removeResource({ resourcePath, uniqueId });
        if (resourceToRun.onError) {
            const finishedTime = await getTime();
            logger.info(
                `Run resource path: ${resourcePath}, item: ${uniqueId} - started error callback (${
                    finishedTime - resourceToRun.startedAt
                })!`,
            );
            try {
                await resourceToRun.onError(err as Error);
                logger.debug(
                    `Run resource path: ${resourcePath}, item: ${uniqueId} - finished error callback WITHOUT a throw!`,
                );
                resourceToRun.onFinished(result);
            } catch (err2) {
                resourceToRun.onThrowError(err2);
            }
        } else {
            // quiet error logging
            logger.error(`Run resource path: ${resourcePath}, item: ${uniqueId} - error: ${err}!`);
            // eslint-disable-next-line no-console
            console.error(`Run resource path: ${resourcePath}, item: ${uniqueId} failed.`, err);
            resourceToRun.onFinished(result);
        }
    }
    return result;
};

interface eventResourceOptions {
    resourcePath: string;
    uniqueId: string;
}

export const eventResource = ({ resourcePath, uniqueId }: eventResourceOptions) => {
    if (control[resourcePath]) {
        const resource = control[resourcePath].find((item) => item.uniqueId === uniqueId);
        logger.debug(`(${process.pid}) eventResource - ${resourcePath}, ${JSON.stringify(resource)}`);
        if (resource && !resource.running) {
            runResource({ resourcePath, uniqueId });
        }
    }
};
