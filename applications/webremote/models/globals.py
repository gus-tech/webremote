# -*- coding: utf-8 -*-
import socket

HOSTNAME = socket.gethostname()
FQDN = socket.getfqdn()
WEBSOCKET_PORT = 8888

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    return s.getsockname()[0]
