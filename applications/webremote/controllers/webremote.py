# -*- coding: utf-8 -*-
import traceback
import json

def webremote():return dict()

def index():
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
