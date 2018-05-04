#!/usr/bin/env python
# -*- coding: utf-8 -*-
from gluon import *
from db import *
import traceback
import json



def add_activity(activity_dict):
    db.activities[0] = activity_dict
    db.commit()
    activity = db(db.activities).select().last().as_dict()
    default_key_to_button = db(db.default_key_to_button).select()
    for row in default_key_to_button:
        db.key_binds[0] = dict(key_code = row.key_code,
                                     remote_id = row.remote_id,
                                     button_id = row.button_id,
                                     activity_id = activity['id'])
    temp_key_binds = db(db.key_binds.activity_id == activity['id']).select().as_dict()
    key_binds = {}
    for bind_key, bind in temp_key_binds.iteritems():
        key_binds[activity['id']] = {}
        key_binds[activity['id']][bind['key_code']] = bind
    return dict(activity=activity, key_binds=key_binds)

def delete_activity(activity_id):
    db(db.activities.id == activity_id).delete()
    db(db.button_binds.activity_id == activity_id).delete()
    db(db.key_binds.activity_id == activity_id).delete()
    db.commit()
    return activity_id

def add_remote(remote_dict):
    db.remotes[0] = remote_dict
    db.commit()
    return db(db.remotes).select().last().as_dict()

def delete_remote(remote_id):
    del db.remotes[remote_id]
    db(db.remote_buttons.remote_id == remote_id).delete()
    db(db.button_binds.remote_id == remote_id).update(**dict(remote_id=None, button_id=None))
    db(db.key_binds.remote_id == remote_id).delete()
    db.commit()
    return remote_id

def add_remote_button(button_dict):
    db.remote_buttons[0] = button_dict
    db.commit()
    return db(db.remote_buttons).select().last().as_dict()

def delete_remote_button(button_id):
    del db.remote_buttons[button_id]
    db(db.button_binds.button_id == button_id).update(**dict(remote_id=None, button_id=None))
    db(db.key_binds.button_id == button_id).delete()
    db.commit()
    return button_id

def delete_button_bind(id):
    try:
        del db.button_binds[id]
        db.commit()
    except Exception as e: print('Error:', e)
    return id

def save_button_bind(button_dict):
    id = button_dict.pop('id', None)
    if id == None:
        db.button_binds[0] = button_dict
        db.commit()
        return db(db.button_binds).select().last().as_dict()
    else:
        db(db.button_binds.id == int(id)).update(**button_dict)
        db.commit()
        return db(db.button_binds.id == int(id)).select().as_dict()

def delete_key_bind(bind_id):
    try:
        id = bind_id.replace('k', '')
        bind_dict = db(db.key_binds.id == id).select().last().as_dict()
        db(db.key_binds.id == id).delete()
        db.commit()
        if bind_dict != None: return bind_dict
    except Exception as e: print('Error:', e)
    return bind_id

def save_key_bind(bind_dict):
    db.key_binds.update_or_insert((db.key_binds.key_code == bind_dict['key_code']) & (db.key_binds.activity_id == bind_dict['activity_id']), **bind_dict)
    db.commit()
    return db(db.key_binds).select().last().as_dict()

def delete_voice_bind(bind_id):
    try:
        id = bind_id.replace('voice_bind', '')
        bind_dict = db(db.voice_binds.id == id).select().last().as_dict()
        db(db.voice_binds.id == id).delete()
        db.commit()
        if bind_dict != None: return bind_dict
    except Exception as e: print('Error:', e)
    return bind_id

def save_voice_bind(bind_dict):
    id = bind_dict.pop('id', None)
    if id == None:
        db.voice_binds[0] = bind_dict
        db.commit()
        return db(db.voice_binds).select().last().as_dict()
    else:
        db(db.voice_binds.id == int(id)).update(**bind_dict)
        db.commit()
        return bind_dict


def get_tables():
    """
    remote_buttons = db(db.remote_buttons.remote_id == 1).select()
    for row in remote_buttons:
        new_code = json.loads(row.code)[1:]
        row.update_record(code = json.dumps([253,9,1]+new_code) )
    """
    remotes = db(db.remotes).select().as_dict()
    buttons = db(db.remote_buttons).select().as_dict()
    for key, button in buttons.iteritems():
        button['code'] = json.loads(button['code'])
    activities = db(db.activities).select().as_dict()
    button_binds = db(db.button_binds).select().as_dict()

    key_binds = {}
    voice_binds = {}
    temp_key_binds = db(db.key_binds).select().as_dict()
    temp_voice_binds = db(db.voice_binds).select().as_dict()
    for activity_id, activity in activities.iteritems():
        key_binds[activity_id] = {}
        voice_binds[activity_id] = {}
        for bind_id, bind in temp_key_binds.iteritems():
            if bind['activity_id'] == activity_id:
                key_binds[activity_id][bind['key_code']] = bind
        for bind_id, bind in temp_voice_binds.iteritems():
            if bind['activity_id'] == activity_id:
                voice_binds[activity_id][bind['id']] = bind


    return dict(remotes=remotes,
                buttons=buttons,
                button_binds=button_binds,
                key_binds=key_binds,
                voice_binds=voice_binds,
                activities=activities)
