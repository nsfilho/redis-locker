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
import { LOCKER_PREFIX } from '../../constants';
import { addResource } from './resource';

export interface lockerResourceOptions<T, E> {
    resourceName: string;
    callback: () => Promise<T> | T;
    onError?: (err: E) => Promise<void> | void;
}

/**
 * Lock resource between many instances of this software
 * @param options parameters to lock some resource in all instance
 * @returns a number of other instances asked to lock the same resource
 */
export const lockResource = async <T, E>({
    resourceName,
    callback,
    onError,
}: lockerResourceOptions<T, E>): Promise<T | null> => {
    const resourcePath = `${LOCKER_PREFIX}:${resourceName}`;
    return new Promise((resolve, reject) => {
        const onFinished = (result: T | null) => {
            resolve(result);
        };
        const onThrowError = (err: E) => {
            reject(err);
        };
        const localError = onError || onThrowError;
        addResource({
            resourcePath,
            callback,
            onError: localError,
            onThrowError,
            onFinished,
        });
    });
};
