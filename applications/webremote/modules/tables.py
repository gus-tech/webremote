#!/usr/bin/env python
# -*- coding: utf-8 -*-
from gluon import *


def define_tables(db):
    db.define_table('serial_devices',
                    Field('name', 'string'),
                    Field('description', 'string'),
                    Field('port', 'string'),
                    Field('remote_type', 'integer'))

    db.define_table('remotes',
                    Field('name', 'string'),
                    Field('description', 'string'),
                    Field('remote_type', 'integer'),
                    Field('device_id', 'integer'))

    db.define_table('remote_buttons',
                    Field('name', 'string'),
                    Field('button_type', 'integer'),
                    Field('remote_id', 'integer'),
                    Field('code', 'text'))

    db.define_table('activities',
                    Field('name', 'string'))

    db.define_table('button_binds',
                    Field('classes', 'string'),
                    Field('x', 'integer'),
                    Field('y', 'integer'),
                    Field('delay', 'integer'),
                    Field('remote_id', 'integer'),
                    Field('button_id', 'integer'),
                    Field('activity_id', 'integer'))

    db.define_table('key_binds',
                    Field('key_code', 'string'),
                    Field('delay', 'integer'),
                    Field('remote_id', 'integer'),
                    Field('button_id', 'integer'),
                    Field('activity_id', 'integer'))

    db.define_table('default_key_to_button',
                    Field('key_code', 'string'),
                    Field('remote_id', 'integer'),
                    Field('button_id', 'integer'))

    db.define_table('voice_binds',
                    Field('name', 'string'),
                    Field('remote_id', 'integer'),
                    Field('button_id', 'integer'),
                    Field('activity_id', 'integer'))

    db.define_table('macros',
                    Field('name', 'string'),
                    Field('macro', 'text'),
                    Field('activity_id', 'integer'))
    return db
