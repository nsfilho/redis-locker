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

export const REDIS_MAIN_CLUSTER = process.env.REDIS_MAIN_CLUSTER
    ? JSON.parse(process.env.REDIS_MAIN_CLUSTER)
    : [{ port: 6379, host: '127.0.0.1' }];

export const REDIS_MAIN_PASSWORD = process.env.REDIS_MAIN_PASSWORD || 'password';

export const REDIS_DEBUG_CONSOLE = process.env.REDIS_DEBUG_CONSOLE || false;
