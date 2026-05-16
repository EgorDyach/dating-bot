#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until nc -z postgres 5432; do
  sleep 1
done
echo "PostgreSQL is ready"

echo "Waiting for Redis..."
until nc -z redis 6379; do
  sleep 1
done
echo "Redis is ready"

echo "Waiting for RabbitMQ..."
until nc -z rabbitmq 5672; do
  sleep 1
done
sleep 2
echo "RabbitMQ is ready"

echo "Starting application..."
exec npm run start:prod
