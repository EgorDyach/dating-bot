import { config as loadDotenv } from 'dotenv';

loadDotenv();

export type AppEnv = {
  botToken: string;
  databaseUrl: string;
  redisUrl: string;
  rabbitMqUrl: string;
  rabbitMqExchange: string;
  proxyServer?: string;
  proxyPort?: number;
  proxySecret?: string;
};

export function readEnv(): AppEnv {
  const botToken = process.env.BOT_TOKEN?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const redisUrl = process.env.REDIS_URL?.trim() ?? 'redis://localhost:6379';
  const rabbitMqUrl = process.env.RABBITMQ_URL?.trim() ?? 'amqp://localhost:5672';
  const rabbitMqExchange = process.env.RABBITMQ_EXCHANGE?.trim() ?? 'dating.interactions';
  const proxyServer = process.env.PROXY_SERVER?.trim();
  const proxyPort = process.env.PROXY_PORT ? parseInt(process.env.PROXY_PORT) : undefined;
  const proxySecret = process.env.PROXY_SECRET?.trim();

  if (!botToken) {
    throw new Error('BOT_TOKEN не установлен');
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL не установлен');
  }

  return { botToken, databaseUrl, redisUrl, rabbitMqUrl, rabbitMqExchange, proxyServer, proxyPort, proxySecret };
}
