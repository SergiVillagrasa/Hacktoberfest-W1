import { createApp } from './app';
import { compose } from './composition';
import { loadEnv } from './env';

const env = loadEnv();
createApp(compose(env)).listen(env.PORT, () => console.log(`SnapHunt API listening on :${env.PORT}`));
