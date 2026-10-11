import { createApp } from './app';
import { compose } from './composition';
import { loadEnv } from './env';

export default createApp(compose(loadEnv()));
