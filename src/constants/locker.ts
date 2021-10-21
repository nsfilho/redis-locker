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

export const LOCKER_PREFIX = process.env.LOCKER_PREFIX || 'LOCKER';

/** maximum amount of time a host not respond about ping to consider death request */
export const LOCKER_PING_TIMEOUT = process.env.LOCKER_PING_TIMEOUT
    ? parseInt(process.env.LOCKER_PING_TIMEOUT, 10)
    : 5000;

/** maximum amount of time a host not respond about ping to consider death request */
export const LOCKER_PING_INTERVAL = process.env.LOCKER_PING_INTERVAL
    ? parseInt(process.env.LOCKER_PING_INTERVAL, 10)
    : 2500;

/**
 * interval to check if resources is available.
 * important: ping interval must be greather than that.
 */
export const LOCKER_CHECK_INTERVAL = process.env.LOCKER_CHECK_INTERVAL
    ? parseInt(process.env.LOCKER_CHECK_INTERVAL, 10)
    : 200;

export const LOCKER_RESOURCE_EXIT_TIMEOUT = process.env.LOCKER_RESOURCE_EXIT_TIMEOUT
    ? parseInt(process.env.LOCKER_RESOURCE_EXIT_TIMEOUT, 10)
    : 1000;

export const LOCKER_PING_EVENT_FORCE = process.env.LOCKER_PING_EVENT_FORCE === 'true';

export const LOCKER_SINGLE_PING_THREAD = process.env.LOCKER_SINGLE_PING_THREAD === 'true';
