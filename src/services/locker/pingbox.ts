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
import { debug } from 'debug';
import { join } from 'path';
import { fork, ChildProcess } from 'child_process';
import type { removePingOptions, addPingOptions } from './ping';
import { eventResource } from './resource';

const logger = {
    info: debug('redis-locker:pingbox-info'),
    debug: debug('redis-locker:pingbox-debug'),
};

const control: {
    [index: string]: ChildProcess;
} = {};

export interface ChildMessage {
    type: string;
    resourcePath: string;
    uniqueId: string;
}

export const addPing = async ({ resourcePath, uniqueId }: addPingOptions) => {
    if (!control[resourcePath]) {
        control[resourcePath] = process.env.JEST_WORKER_ID
            ? fork(join(__dirname, 'ping'), {
                  execArgv: ['-r', 'ts-node/register'],
              })
            : fork(join(__dirname, 'ping'));
        control[resourcePath].on('exit', () => {
            delete control[resourcePath];
            logger.info(`Resource exited: ${resourcePath}`);
        });
        control[resourcePath].on('message', (data: ChildMessage) => {
            if (data.type === 'next') {
                logger.info(`From pingbox: ${process.pid}, ${data.resourcePath}, ${data.uniqueId}`);
                eventResource({ resourcePath: data.resourcePath, uniqueId: data.uniqueId });
            }
        });
    }
    try {
        control[resourcePath].send({ type: 'addPing', resourcePath, uniqueId });
    } catch (err) {
        await addPing({ resourcePath, uniqueId });
    }
};

export const removePing = async ({ resourcePath, uniqueId }: removePingOptions) => {
    if (control[resourcePath]) {
        control[resourcePath].send({ type: 'removePing', resourcePath, uniqueId });
    }
};
