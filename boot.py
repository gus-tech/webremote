#!/usr/bin/env python

import serial
import time

device = "/dev/ttyS0"
serial = serial.Serial(device, baudrate=115200, timeout=60)

serial.write("$$$")
time.sleep(2)
serial.write("S~,6\n")
serial.write("R,1\n")
