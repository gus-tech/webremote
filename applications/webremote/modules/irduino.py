#!/usr/bin/env python
# -*- coding: utf-8 -*-

import subprocess
import serial
import time
import json


class IRduino():
    def __init__(self, serial_prefix="/dev/ttyACM", baudrate=115200, timeout=10):
        self.serial_prefix = serial_prefix
        self.timeout = timeout
        self.baudrate = baudrate
        self.devices = []
        self.ports = []
        self.last_code = None
        self.find_devices()
        self.init_devices()
        self.output = self.devices[0]
        self.input  = self.devices[0]


    def find_devices(self):
        try:
            cmd = "ls {}*".format(self.serial_prefix)
            p = subprocess.Popen(cmd, stdout=subprocess.PIPE, shell=True)
            (output, err) = p.communicate()
            p_status = p.wait()
            self.ports = output.strip().split('\n')
        except Exception as error: print("Failed to find devices:", error)


    def init_devices(self):
        for port in self.ports:
            try: self.devices.append(serial.Serial(port, baudrate=self.baudrate, timeout=self.timeout))
            except Exception as error: print("Failed to init device:", port, error)


    def send_code(self, bytes):
        code = ""
        try:
            for byte in bytes: code += chr(byte)
            if self.last_code == code: self.output.write('d')
            else: self.output.write(code)
            self.last_code = code
            return True
        except Exception as error:
            print("Failed to tranmsit IR:", data, error)
            return False


    def learn_code(self):
        code = []
        try:
            self.input.write('r')
            while not self.input.inWaiting(): time.sleep(0.01)
            while self.input.inWaiting(): code.append(ord(self.input.read()))
            if len(code) < 4 or code[0] != 116 or code[2]*2+3 != len(code): return False
            self.last_code = code
            return code
        except Exception as error:
            print("Error learning IR code:", error)
            return False
