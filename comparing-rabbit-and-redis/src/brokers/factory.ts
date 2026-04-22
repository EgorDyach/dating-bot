import type { BrokerKind } from "../types";
import type { IBrokerAdapter } from "./broker";
import { RabbitMqBroker } from "./rabbitmq";
import { RedisStreamsBroker } from "./redis-streams";

export function createBroker(kind: BrokerKind): IBrokerAdapter {
  switch (kind) {
    case "rabbitmq":
      return new RabbitMqBroker();
    case "redis":
      return new RedisStreamsBroker();
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
