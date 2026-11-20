import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import env from './config/env.js';
import { globalLimiter } from './middleware/rateLimiters.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';

const JSON_BODY_LIMIT = '10kb';

const app = express();

// Behind a hosting proxy, trust exactly one hop so rate limiting sees real client IPs (ADR-018).
if (env.isProduction) {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'DELETE'],
  }),
);
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(globalLimiter);

app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);

export default app;

