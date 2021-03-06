#!/usr/bin/env python
# -*- coding: utf-8 -*-

import subprocess
import serial
import json


class HC05():

    def __init__(self, port="/dev/ttyS1", baudrate=115200, timeout=10):
        self.port = port
        self.timeout = timeout
        self.baudrate = baudrate
        self.last_code = None
        self.output = serial.Serial(port, baudrate=baudrate, timeout=timeout)


    def send_code(self, bytes):
        try:
            for byte in bytes: self.output.write(chr(int(byte)))
            self.last_code = bytes
            return True
        except Exception as error:
            print("Failed to tranmsit BT:", bytes, error)
            return False
