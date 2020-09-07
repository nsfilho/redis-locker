# Redis-Locker Library

A very simple and small library to guarantee a exclusive execution of a function in
a multi-instance environment like `docker` and `kubernetes` (k8s).

It is very useful for migrations (only one API/Micro-services instance will execute at
the same time).

> By design, for an easy use, this library will use some environment variables and an exclusive connection with `redis` (because sometimes your redis connection isn't available to guarantee the role process).

-   Project licensed under: GPLv3
-   Site Documentation: [Homepage](https://nsfilho.github.io/redis-locker/index.html)
-   Repository: [GitHub](https://github.com/nsfilho/redis-locker.git)

## Environment Variables

This services use some environment variables to pre-adjust some things, like:

-   `REDIS_MAIN_CLUSTER`: a redis cluster or host, example and default: `[{ port: 6379, host: '127.0.0.1' }]`;
-   `REDIS_MAIN_PASSWORD`: a password for access redis, example and default: `password`;
-   `REDIS_DEBUG_CONSOLE`: if true, show in a console some debug information. Default: false.
-   `LOCKER_PREFIX`: all calls has ben prefixed by this (facility to not share same resource by different micro-services). Default: LOCKER.
-   `LOCKER_PING_TIMEOUT`: maximum amount of time for consider a remote service un-responsive by not update their ping and consider death. Default: 5000.
-   `LOCKER_PING_INTERVAL`: maximum amount of time for a service update their ping. This value must be less than `LOCKER_PING_TIMEOUT`. Default: 2000.
-   `LOCKER_CHECK_INTERVAL`: timer to check if the resource is available now. This value could be like `LOCKER_PING_INTERVAL` or less. Default: 500.
-   `LOCKER_DEBUG_CONSOLE`: show in console some debug messages about locker process.

## Example

```javascript
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
```
