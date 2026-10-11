import { waitUntil } from '@vercel/functions';
import { createApp } from './app';
import { compose } from './composition';
import { loadEnv } from './env';

export default createApp(await compose(loadEnv(), (task) => waitUntil(task().catch((error) => console.error('background task failed', error)))));
