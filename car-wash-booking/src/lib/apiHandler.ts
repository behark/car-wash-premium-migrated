import type { NextApiRequest, NextApiResponse } from 'next';
import { logger } from './logger';

type MethodHandlers = Partial<Record<string, (req: NextApiRequest, res: NextApiResponse) => Promise<void>>>;

interface ApiHandlerOptions {
  requireHttps?: boolean;
  validateOrigin?: boolean;
}

export function createApiHandler(handlers: MethodHandlers, options: ApiHandlerOptions = {}) {
  return async function apiHandler(req: NextApiRequest, res: NextApiResponse) {
    const startTime = Date.now();

    try {
      // Security checks for production
      if (process.env.NODE_ENV === 'production') {
        // HTTPS check
        if (options.requireHttps !== false) {
          const isHttps = req.headers['x-forwarded-proto'] === 'https' ||
                         (req as any).connection.encrypted ||
                         req.headers.host?.includes('localhost');

          if (!isHttps) {
            logger.warn('HTTP request to HTTPS-only endpoint', {
              url: req.url,
              method: req.method,
              ip: req.headers['x-forwarded-for'] || (req as any).connection.remoteAddress
            });
            return res.status(403).json({ error: 'HTTPS required' });
          }
        }

        // Origin validation
        if (options.validateOrigin !== false && req.method !== 'GET') {
          const origin = req.headers.origin;
          const allowedOrigins = [
            process.env.NEXTAUTH_URL,
            process.env.NEXT_PUBLIC_SITE_URL
          ].filter(Boolean);

          if (origin && !allowedOrigins.includes(origin)) {
            logger.warn('Request from unauthorized origin', {
              origin,
              allowedOrigins,
              url: req.url,
              method: req.method
            });
            return res.status(403).json({ error: 'Unauthorized origin' });
          }
        }
      }

      const method = req.method || 'GET';
      const handler = handlers[method];

      if (!handler) {
        res.setHeader('Allow', Object.keys(handlers));
        logger.warn('Method not allowed', {
          method,
          url: req.url,
          allowedMethods: Object.keys(handlers)
        });
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
      }

      await handler(req, res);

      const duration = Date.now() - startTime;
      logger.debug('API request completed', {
        method,
        url: req.url,
        duration: `${duration}ms`,
        status: res.statusCode
      });

    } catch (err: any) {
      const duration = Date.now() - startTime;
      logger.error('API request failed', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        error: err.message,
        stack: err.stack
      });

      if (!res.writableEnded) {
        res.status(500).json({
          error: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message
        });
      }
    }
  };
}

export function validateFields(body: any, fields: string[]): string[] {
  return fields.filter(f => body[f] === undefined || body[f] === null || body[f] === '');
}
