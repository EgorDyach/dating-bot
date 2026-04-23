export type AppEnv = {
  botToken: string;
  databaseUrl: string;
  redisUrl: string;
  rabbitMqUrl: string;
  rabbitMqExchange: string;
};

export function readEnv(): AppEnv {
  const botToken = process.env.BOT_TOKEN?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const redisUrl = process.env.REDIS_URL?.trim() ?? 'redis://localhost:6379';
  const rabbitMqUrl = process.env.RABBITMQ_URL?.trim() ?? 'amqp://localhost:5672';
  const rabbitMqExchange = process.env.RABBITMQ_EXCHANGE?.trim() ?? 'dating.interactions';

  if (!botToken) {
    throw new Error('BOT_TOKEN is not set');
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  return { botToken, databaseUrl, redisUrl, rabbitMqUrl, rabbitMqExchange };
}
