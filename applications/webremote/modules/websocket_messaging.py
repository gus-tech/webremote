#!/usr/bin/env python

from __future__ import print_function
import tornado.httpserver
import tornado.websocket
import tornado.ioloop
import tornado.web
import hmac
import optparse
import time
import sys
import os
sys.path.append('/home/www-data/web2py')
import json
import serial
import requests
import subprocess
import traceback
#from db import *
from webremote import *
import webremote
try:
    import CHIP_IO.GPIO as GPIO
except: pass
import atexit

try:
    GPIO.cleanup()
    GPIO.setup("CSID0",GPIO.OUT, initial=1)
except: pass

if (sys.version_info[0] == 2):
    from urllib import urlencode, urlopen
    def to_bytes(obj, charset='utf-8', errors='strict'):
        if obj is None:
            return None
        if isinstance(obj, (bytes, bytearray, buffer)):
            return bytes(obj)
        if isinstance(obj, unicode):
            return obj.encode(charset, errors)
        raise TypeError('Expected bytes')
else:
    from urllib.request import urlopen
    from urllib.parse import urlencode
    def to_bytes(obj, charset='utf-8', errors='strict'):
        if obj is None:
            return None
        if isinstance(obj, (bytes, bytearray, memoryview)):
            return bytes(obj)
        if isinstance(obj, str):
            return obj.encode(charset, errors)
        raise TypeError('Expected bytes')

listeners, names, tokens = {}, {}, {}

def websocket_send(url, message, hmac_key=None, group='default'):
    sig = hmac_key and hmac.new(to_bytes(hmac_key), to_bytes(message)).hexdigest() or ''
    params = urlencode(
        {'message': message, 'signature': sig, 'group': group})
    f = urlopen(url, to_bytes(params))
    data = f.read()
    f.close()
    return data

@atexit.register
def on_exit():
    try:
        GPIO.cleanup()
        GPIO.setup("CSID0",GPIO.OUT, initial=0)
    except: pass
    exit(0)

class PostHandler(tornado.web.RequestHandler):
    """
    only authorized parties can post messages
    """
    def post(self):
        if hmac_key and not 'signature' in self.request.arguments:
            self.send_error(401)
        if 'message' in self.request.arguments:
            message = self.request.arguments['message'][0]
            group = self.request.arguments.get('group', ['default'])[0]
            print('%s:MESSAGE to %s:%s' % (time.time(), group, message))
            if hmac_key:
                signature = self.request.arguments['signature'][0]
                actual_signature = hmac.new(to_bytes(hmac_key), to_bytes(message)).hexdigest()
                if not gluon.utils.compare(to_native(signature), actual_signature):
                    self.send_error(401)
            for client in listeners.get(group, []):
                client.write_message(message)


class TokenHandler(tornado.web.RequestHandler):
    """
    if running with -t post a token to allow a client to join using the token
    the message here is the token (any uuid)
    allows only authorized parties to joins, for example, a chat
    """
    def post(self):
        if hmac_key and not 'message' in self.request.arguments:
            self.send_error(401)
        if 'message' in self.request.arguments:
            message = self.request.arguments['message'][0]
            if hmac_key:
                signature = self.request.arguments['signature'][0]
                actual_signature = hmac.new(to_bytes(hmac_key), to_bytes(message)).hexdigest()
                if not gluon.utils.compare(to_native(signature), actual_signature):
                    self.send_error(401)
            tokens[message] = None


class DistributeHandler(tornado.websocket.WebSocketHandler):

    def __init__(self, application, request, **kwargs):
        tornado.web.RequestHandler.__init__(self, application, request,
                                            **kwargs)
        self.stream = request.connection.stream
        self.ws_connection = None
        self.close_code = None
        self.close_reason = None
        self._on_close_called = False

        self.bt = self.get_bt()
        self.ir_out = self.get_ir(0)
        self.ir_in = self.get_ir(0)
        self.ir_ready = True
        self.ir_last_code = None
        self.ir_error_count = 0
        self.ir_max_errors = 3




    def get_ir(self, x):
        try:
            device_ir = "/dev/ttyACM"+str(x)
            return serial.Serial(device_ir, baudrate=115200, timeout=60)
        except: print("Failed to find IrToy device!")

    def send_ir(self, data):
        code = ""
        for byte in data:
            code += chr(byte)
        try:
            if self.ir_last_code == code:
                self.write_message("sending ditto code")
                self.ir_out.write('d')
            else:
                print("Code:")
                print(code)
                self.ir_out.write(code)
                response = ""
                while not self.ir_out.inWaiting(): time.sleep(0.01)
                time.sleep(0.01)
                while self.ir_out.inWaiting():
                    response += self.ir_out.read()
                while True:
                    print("Response:")
                    print(response)
                    if response == code:
                        self.ir_last_code = code
                        break
                    self.ir_out.write(code)
                    response = ""
                    while not self.ir_out.inWaiting(): time.sleep(0.01)
                    time.sleep(0.01)
                    while self.ir_out.inWaiting():
                        response += self.ir_out.read()
            return True
        except:
            self.error_ir("Failed to tranmsit IR: " + str(data), traceback.format_exc())

    def receive_ir(self, data):
        try:
            code = []
            self.ir_in.write('r')
            while not self.ir_in.inWaiting():
                time.sleep(0.01)
            time.sleep(0.01)
            while self.ir_in.inWaiting():
                code.append(ord(self.ir_in.read()))
            if code[0] != 116:
                self.write_message("Bad mode recieved! Got '{0}', expecting '116'".format(code[0]))
                return False
            if code[2]*2+3 != len(code):
                self.write_message("Bad length recieved! Got '{0}', expecting '{1}'".format(code[2]*2+3, len(code)))
                return False
            #if code[1] != 't': self.write_message("Bad mode recieved! Got '{0}', expecting '116'".format(code[0]))
            self.write_message("Mode: {0} Freq: {1}, cLen: {2}\nCode[{4}]: {3}".format(code[0], code[1], code[2], code, len(code)))
            data['code'] = json.dumps(code)
            #r = requests.post("http://localhost/add_remote_button", data=data)
            data['id'] = add_remote_button(data)
            self.write_message(json.dumps(data))
            self.ir_error_count = 0
        except:
            self.error_ir("Error reading IR signal!", traceback.format_exc())

    def error_ir(self, message, traceback=None):
        self.ir_error_count += 1
        print(message)
        self.write_message(dict(message=message))
        print("Error count: {0}".format(self.ir_error_count))
        self.write_message(dict(message="Error count: {0}".format(self.ir_error_count)))
        print(traceback)
        self.write_message(dict(message=traceback))

    def get_bt(self):
        try:
            device_bt = "/dev/ttyS1"
            self.bt = serial.Serial(device_bt, baudrate=115200)
            return self.bt
        except: pass
        print("Failed to find BT device!")

    def send_bt(self, bytes):
        try:
            for byte in bytes:
                self.bt.write(chr(int(byte)))
            return True
        except:
            message = "Failed to tranmsit BT: " + str(bytes)
            print(message)
            self.write_message(dict(message=message))
            print(traceback.format_exc())
            self.write_message(dict(message=traceback.format_exc()))
            return False

    def reboot(self):
        message = "Rebooting System!"
        print(message)
        self.write_message(dict(message=message))
        subprocess.Popen("sudo reboot", shell=True)
        sys.exit(0)

    def reset_usb_devices(self, port=2):
        #self.ir = None
        set_usb_power(port, False)
        time.sleep(2)
        set_usb_power(port, True)
        time.sleep(3)
        self.ir_error_count = 0

    def check_origin(self, origin):
        return True

    def open(self, params):
        group, token, name = params.split('/') + [None, None]
        self.group = group or 'default'
        self.token = token or 'none'
        self.name = name or 'anonymous'
        # only authorized parties can join
        if DistributeHandler.tokens:
            if not self.token in tokens or not token[self.token] is None:
                self.close()
            else:
                tokens[self.token] = self
        if not self.group in listeners:
            listeners[self.group] = []
        # notify clients that a member has joined the groups
        for client in listeners.get(self.group, []):
            client.write_message('+' + self.name)
        listeners[self.group].append(self)
        names[self] = self.name
        print('%s:CONNECT to %s' % (time.time(), self.group))

    def on_message(self, message):
        print(message)
        try: obj = json.loads(message)
        except: return False
        if '1' in obj:
            self.send_bt(obj['1'])
            return True
        elif '2' in obj:
            self.send_ir(obj['2'])
            return True
        elif '3' in obj:
            self.receive_ir(obj['3'])
            return True
        elif 'reboot' in obj:
            self.reboot()
            return True

        try:
            key = obj.keys()[0]
            print(key)
            method = getattr(webremote, key)
            self.write_message({key+"_callback":method(obj[key])})
        except Exception as e:
            print("Error:")
            print(e)


    def on_close(self):
        if self.group in listeners:
            listeners[self.group].remove(self)
        del names[self]
        # notify clients that a member has left the groups
        for client in listeners.get(self.group, []):
            client.write_message('-' + self.name)
        print('%s:DISCONNECT from %s' % (time.time(), self.group))

# if your webserver is different from tornado server uncomment this
# or override using something more restrictive:
# http://tornado.readthedocs.org/en/latest/websocket.html#tornado.websocket.WebSocketHandler.check_origin
# def check_origin(self, origin):
#    return True

if __name__ == "__main__":
    usage = __doc__
    version = ""
    parser = optparse.OptionParser(usage, None, optparse.Option, version)
    parser.add_option('-p',
                      '--port',
                      default='8888',
                      dest='port',
                      help='socket')
    parser.add_option('-l',
                      '--listen',
                      default='0.0.0.0',
                      dest='address',
                      help='listener address')
    parser.add_option('-k',
                      '--hmac_key',
                      default='',
                      dest='hmac_key',
                      help='hmac_key')
    parser.add_option('-t',
                      '--tokens',
                      action='store_true',
                      default=False,
                      dest='tokens',
                      help='require tockens to join')
    parser.add_option('-s',
                      '--sslkey',
                      default=False,
                      dest='keyfile',
                      help='require ssl keyfile full path')
    parser.add_option('-c',
                      '--sslcert',
                      default=False,
                      dest='certfile',
                      help='require ssl certfile full path')
    (options, args) = parser.parse_args()
    hmac_key = options.hmac_key
    DistributeHandler.tokens = options.tokens
    urls = [
        (r'/', PostHandler),
        (r'/token', TokenHandler),
        (r'/realtime/(.*)', DistributeHandler)]
    application = tornado.web.Application(urls, auto_reload=True)
    if options.keyfile and options.certfile:
        ssl_options = dict(certfile=options.certfile, keyfile=options.keyfile)
    else:
        ssl_options = None
    http_server = tornado.httpserver.HTTPServer(application, ssl_options=ssl_options)
    http_server.listen(int(options.port), address=options.address)
    tornado.ioloop.IOLoop.instance().start()
