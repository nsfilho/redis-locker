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
import { getConnection } from '@nsfilho/redis-connection';

const state: {
    deltaLocalTime: null | number;
} = {
    deltaLocalTime: null,
};

export interface RedisInstance {
    instance: string;
    nodes?: string;
    password?: string;
}

interface getTimeOptions {
    redis?: RedisInstance;
}

export const getTime = async ({ redis }: getTimeOptions) => {
    if (state.deltaLocalTime === null) {
        const redisInstance = await getConnection(redis);
        const current = await redisInstance.time();
        const remoteTimeSecs = parseInt(current.shift(), 10) * 1000;
        state.deltaLocalTime = new Date().getTime() - remoteTimeSecs;
    }
    return new Date().getTime() + state.deltaLocalTime;
};

interface addRemoteOptions {
    resourcePath: string;
    redis?: RedisInstance;
    uniqueId: string;
    lastPing: number;
}

export const addRemote = async ({ resourcePath, redis, uniqueId, lastPing }: addRemoteOptions) => {
    const redisInstance = await getConnection(redis);
    await redisInstance.hset(resourcePath, uniqueId, lastPing);
};

interface listRemoteOptions {
    resourcePath: string;
    redis?: RedisInstance;
}

interface listRemoteReturn {
    uniqueId: string;
    lastPing: number;
}

export const listRemote = async ({ resourcePath, redis }: listRemoteOptions): Promise<listRemoteReturn[]> => {
    const redisInstance = await getConnection(redis);
    const queue = await redisInstance.hgetall(resourcePath);
    if (!queue) {
        return [];
    }
    return Object.entries(queue).map(([uniqueId, lastPingRaw]) => ({
        uniqueId,
        lastPing: parseInt(lastPingRaw as string, 10),
    }));
};

interface deleteRemoteOptions {
    resourcePath: string;
    redis?: RedisInstance;
    keys: string[];
}

export const deleteRemote = async ({ resourcePath, redis, keys }: deleteRemoteOptions) => {
    const redisInstance = await getConnection(redis);
    await redisInstance.hdel(resourcePath, ...keys);
};

interface multipleSetRemoteOptions {
    resourcePath: string;
    redis?: RedisInstance;
    keyValueArray: string[];
}

export const multipleSetRemote = async ({ resourcePath, redis, keyValueArray }: multipleSetRemoteOptions) => {
    const redisInstance = await getConnection(redis);
    await redisInstance.hmset(resourcePath, keyValueArray);
};
