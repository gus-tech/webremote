# -*- coding: utf-8 -*-
import socket

HOSTNAME = socket.gethostname()
FQDN = socket.getfqdn()
WEBSOCKET_PORT = 8888

LAYOUT_WIDTH = 1140
LAYOUT_HEIGHT = 800

MAIN_WIDTH = 600

PADDING = 20
GRID_SIZE = 10

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    return s.getsockname()[0]
