#!/usr/bin/env python3
"""Simple HTTP CONNECT proxy for handling HTTPS requests."""

import asyncio
import socket
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def handle_client(reader, writer):
    try:
        # Read the request line
        request_line = await asyncio.wait_for(reader.readline(), timeout=5.0)
        if not request_line:
            writer.close()
            return

        request_line = request_line.decode().strip()
        parts = request_line.split()

        if len(parts) < 3:
            writer.close()
            return

        method, target, version = parts[0], parts[1], parts[2]
        logger.info(f"Request: {method} {target}")

        # Read headers
        headers = {}
        while True:
            line = await asyncio.wait_for(reader.readline(), timeout=5.0)
            if line == b'\r\n' or line == b'\n':
                break
            header_line = line.decode().strip()
            if ':' in header_line:
                key, value = header_line.split(':', 1)
                headers[key.strip().lower()] = value.strip()

        # Handle CONNECT for HTTPS
        if method == 'CONNECT':
            host, port = target.split(':')
            port = int(port)

            try:
                # Connect to the target
                target_reader, target_writer = await asyncio.wait_for(
                    asyncio.open_connection(host, port),
                    timeout=10.0
                )
                logger.info(f"Connected to {host}:{port}")

                # Send 200 OK response
                writer.write(b'HTTP/1.1 200 Connection Established\r\n\r\n')
                await writer.drain()

                # Relay data bidirectionally
                await asyncio.gather(
                    relay_data(reader, target_writer),
                    relay_data(target_reader, writer),
                    return_exceptions=True
                )
            except Exception as e:
                logger.error(f"Failed to connect to {host}:{port}: {e}")
                writer.write(b'HTTP/1.1 502 Bad Gateway\r\n\r\n')
                await writer.drain()
                writer.close()
        else:
            # For non-CONNECT requests, just close
            writer.write(b'HTTP/1.1 400 Bad Request\r\n\r\n')
            await writer.drain()
            writer.close()

    except asyncio.TimeoutError:
        logger.error("Request timeout")
        writer.close()
    except Exception as e:
        logger.error(f"Handler error: {e}")
        try:
            writer.close()
        except:
            pass


async def relay_data(reader, writer):
    try:
        while True:
            data = await reader.read(4096)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except Exception as e:
        logger.debug(f"Relay error: {e}")
    finally:
        try:
            writer.close()
        except:
            pass


async def main():
    host = os.environ.get("LISTEN_HOST", "0.0.0.0")
    port = int(os.environ.get("LISTEN_PORT", "8822"))

    logger.info(f"Starting HTTP CONNECT proxy on {host}:{port}")

    server = await asyncio.start_server(handle_client, host, port)

    async with server:
        logger.info(f"Listening on {host}:{port}")
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
