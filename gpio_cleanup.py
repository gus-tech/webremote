#!/usr/bin/env python
import CHIP_IO.GPIO as GPIO
GPIO.cleanup()
GPIO.setup("CSID0",GPIO.OUT, initial=0)
