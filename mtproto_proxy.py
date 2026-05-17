#!/usr/bin/env python3
"""SOCKS5 server for MTProto proxy."""

import asyncio
import struct
import os
import socket

class SOCKS5Server:
    def __init__(self, target_host, target_port):
        self.target_host = target_host
        self.target_port = target_port

    async def handle_client(self, reader, writer):
        try:
            # SOCKS5 greeting
            data = await reader.readexactly(2)
            if data[0] != 0x05:
                print(f"Invalid SOCKS version: {data[0]}")
                writer.close()
                return

            # Send no auth required
            writer.write(b'\x05\x00')
            await writer.drain()

            # Read CONNECT request
            data = await reader.readexactly(4)
            if data[0] != 0x05 or data[1] != 0x01:
                print(f"Invalid request: version={data[0]}, cmd={data[1]}")
                writer.close()
                return

            # Parse address type and address
            addr_type = data[3]
            if addr_type == 0x01:  # IPv4
                addr_data = await reader.readexactly(4)
                addr = '.'.join(map(str, addr_data))
                port_data = await reader.readexactly(2)
                port = struct.unpack('!H', port_data)[0]
            elif addr_type == 0x03:  # Domain name
                length = (await reader.readexactly(1))[0]
                addr = (await reader.readexactly(length)).decode()
                port_data = await reader.readexactly(2)
                port = struct.unpack('!H', port_data)[0]
            else:
                print(f"Unknown address type: {addr_type}")
                writer.close()
                return

            print(f"Client request: {addr}:{port}, forwarding to {self.target_host}:{self.target_port}")

            # Connect to actual target (ignore client request address)
            try:
                target_reader, target_writer = await asyncio.wait_for(
                    asyncio.open_connection(self.target_host, self.target_port),
                    timeout=10.0
                )
                print(f"Connected to {self.target_host}:{self.target_port}")
            except Exception as e:
                print(f"Failed to connect to {self.target_host}:{self.target_port}: {e}")
                # Send error response
                writer.write(b'\x05\x01\x00\x01\x00\x00\x00\x00\x00\x00')
                await writer.drain()
                writer.close()
                return

            # Send success response
            writer.write(b'\x05\x00\x00\x01\x7f\x00\x00\x01\x00\x00')
            await writer.drain()

            # Relay data bidirectionally
            await asyncio.gather(
                self._relay(reader, target_writer),
                self._relay(target_reader, writer),
                return_exceptions=True
            )
        except Exception as e:
            print(f"Handler error: {e}")
        finally:
            try:
                writer.close()
            except:
                pass

    async def _relay(self, reader, writer):
        try:
            while True:
                data = await reader.read(4096)
                if not data:
                    break
                writer.write(data)
                await writer.drain()
        except:
            pass
        finally:
            try:
                writer.close()
            except:
                pass

async def main():
    target_host = os.environ.get("PROXY_SERVER", "31.97.184.155")
    target_port = int(os.environ.get("PROXY_PORT", "7343"))

    print(f"Starting SOCKS5 proxy on 0.0.0.0:8888")
    print(f"Forwarding to {target_host}:{target_port}")

    server = SOCKS5Server(target_host, target_port)

    async def client_handler(reader, writer):
        await server.handle_client(reader, writer)

    sock_server = await asyncio.start_server(client_handler, "0.0.0.0", 8888)

    print(f"Listening on 0.0.0.0:8888")

    async with sock_server:
        await sock_server.serve_forever()

if __name__ == "__main__":
    asyncio.run(main())
