var ws = null

var focus = null
var remote_buttons = {}
var grid_size = 10

var remotes = JSON.parse('{{=XML(json.dumps(remotes).replace("'",""))}}')
                         console.log(remotes)
var button_counter = 0
var button_assignments = {}
var edit = false
var bt_button_pressed = false
var clear_bt_button_presses = {0: [0xFD, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                                   0xFD, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                                   0xFD, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,]}

$(document).ready(function(){
    ws = $.web2py.web2py_websocket("ws://{{=FQDN}}:{{=WEBSOCKET_PORT}}/realtime/");
    ws.onmessage = on_message
    load_button()
    populate_remotes(remotes)
    document.onkeydown = key_down;
    document.onkeyup = key_up;
    $("#trashcan").droppable({
        accept: ".deleteable",
        drop: delete_button,
        over: function(event, ui) {
            ui.draggable.css("cursor", "not-allowed");
        },
        out: function(event, ui) {
            ui.draggable.css("cursor", "initial");
        }
    });
    $(window).on('mouseup', function(e) {
        if(bt_button_pressed){
            bt_button_pressed = false
            console.log("Clearing BT Buttons")
            ws.send(JSON.stringify(clear_bt_button_presses));
        }
        for(var i in button_assignments){
            clearInterval(button_assignments[i]['interval'])
        }
    });
});

$("#toolbar").tabs();

$('#edit_box').change(
    function(){
        if ($(this).is(':checked')) {
            console.log(true)
            edit = true
            //$('.remote_button').draggable('enable')

        }else{
            console.log(false)
            edit = false
            //$('.remote_button').draggable('disable')
        }
    });

$('.template').draggable({
    //grid: [ grid_size, grid_size ],
    helper: "clone",
    revert: false,
    drag: function(e, ui) {
        ui.position.left = Math.floor(ui.position.left / 10) * 10;
        ui.position.top = Math.floor(ui.position.top / 10) * 10;
    },
});


$("#area").droppable({
    accept: ".template",
    drop: drop_template_button,
    over: function(event, ui) {
        ui.draggable.css("cursor", "copy");
    },
    out: function(event, ui) {
        ui.draggable.css("cursor", "no-drop");
    }
});

function drop_remote_button(event,ui){
    var remote_id = $(ui.helper).attr('remote_id')
    var button_id = $(ui.helper).attr('button_id')
    var assignment_id = $(event.target).attr('assignment_id')
    $(event.target).attr('remote_id', remote_id)
    $(event.target).attr('button_id', button_id)
    $(event.target).html('<div class="button_label">'+remotes[remote_id]['buttons'][button_id]['name']+'</div>')
    $(event.target).attr('remote_type', remotes[remote_id]['remote_type'])
    $(event.target).attr('code', remotes[remote_id]['buttons'][button_id]['code'])
    $(event.target).addClass("remote_type"+remotes[remote_id]['remote_type'])
    button_assignments[assignment_id]['remote_id'] = remote_id
    button_assignments[assignment_id]['button_id'] = button_id
    save_button_assignment($(event.target), button_assignments[assignment_id])
}

function drop_template_button(event,ui){
    var new_button = $(ui.helper).clone().removeClass('template').addClass('remote').addClass('deleteable');
    new_id = button_counter++
    new_id = "temp"+new_id
    new_button.attr('id', new_id)
    new_button.attr('assignment_id', new_id)
    /*
        var canvasOffset = {
            'top': parseInt($(this).position().top, 10) + parseInt($(this).css('border-top-width'), 10),
            'left': parseInt($(this).position().left, 10) - 10 +parseInt($(this).css('border-left-width'), 10)
        }
        */
    new_button.css({'-transform':'translate(15px)'})
    $(event.target).append(new_button);
    //new_button.offset({left: new_button.position()['left'] + 20})
    save_button_assignment(new_button)
    build_remote_button(new_button)
}

function build_remote_button(new_button){
    var id = new_button.attr('assignment_id')
    if(!button_assignments) button_assignments = {}
    button_assignments[id] = {}
    button_assignments[id]['button'] = new_button
    button_assignments[id]['interval'] = null
    new_button.draggable({
        grid: [ grid_size, grid_size ],
        containment: "parent",
        drag: function(e, ui) {
            ui.position.left = Math.floor(ui.position.left / 10) * 10;
            ui.position.top = Math.floor(ui.position.top / 10) * 10;
        },
        start: function(event,ui){
            $(this).css("cursor", "no-drop");
        },
        stop: function(event,ui){
            $(this).css("cursor", "initial");
        }
    });
    new_button.bind('dragstop', function(e){
        save_button_assignment($(this))
    })
    new_button.droppable({
        accept: ".pickable",
        drop: drop_remote_button,
        over: function(event, ui) {
            ui.draggable.css("cursor", "copy");
        },
        out: function(event, ui) {
            ui.draggable.css("cursor", "no-drop");
        }
    });
    new_button.on('mousedown', function(e) {
        var remote_id = $(this).attr('remote_id')
        var button_id = $(this).attr('button_id')
        var assignment_id = $(this).attr('assignment_id')
        if(!remote_id) return false
        send(remote_id, button_id);
        if(remotes[remote_id]['remote_type'] == 0) bt_button_pressed = true;
        else if (remotes[remote_id]['remote_type'] == 1){
            button_assignments[assignment_id]['interval'] = setInterval(function(){send(remote_id, button_id);}, 200);
        }
    });

}

function save_button_assignment(new_button){
    var data = {}
    var id = new_button.attr('id')
    if(id.indexOf("button") >= 0) data['id'] = id.replace("button", "")
    data['remote_id'] = new_button.attr('remote_id')
    data['button_id'] = new_button.attr('button_id')
    data['classes'] = new_button.attr('class')
    data['x'] = new_button.position()['left']
    data['y'] = new_button.position()['top']

    $.ajax({
        url:"{{=URL('save_button_assignment')}}",
        type:'POST',
        data: data,
        dataType: 'html',
        success: function(response){
            console.log(response)
            if(response) new_button.attr('id', "button"+response)
                },
        error: function(response){
            console.log("poop")
            new_button.remove()
        }
    });
}

function delete_button(event,ui){
    if($(ui.helper).hasClass("remote")){
        var id = $(ui.helper).attr('id').replace("button", "")
        $.ajax({
            url:"{{=URL('delete_button_assignment')}}",
            type:'POST',
            data: {'id': id},
            dataType: 'html',
            success: function(response){
                delete button_assignments[$(ui.helper).attr("assignment_id")]
                $(ui.helper).remove()
            },
            error: function(response){
                console.log("ERROR:")
                console.log(response)
            },
        });
    }else if($(ui.helper).hasClass("pickable")){
        var id = $(ui.helper).attr('button_id')
        $.ajax({
            url:"{{=URL('delete_button')}}",
            type:'POST',
            data: {'id': id},
            dataType: 'html',
            success: function(button_id){
                for(var i in button_assignments){
                    if(button_assignments[i]['button'].attr('button_id') == button_id){
                        button_assignments[i]['button'].html("")
                        button_assignments[i]['button'].attr('remote_id', null)
                        button_assignments[i]['button'].attr('button_id', null)
                    }
                }
                $('#'+button_id).remove()
            },
            error: function(response){
                console.log("ERROR:")
                console.log(response)
            },
        });
    }
}


function add_remote(){
    var name = prompt("Enter new remote name")
    if(name == null || name == "") return
    $.ajax({
        url:"{{=URL('add_remote')}}",
        type:'POST',
        data: {'name': name, 'remote_type': 1, 'device_id': 2},
        dataType: 'html',
        success: function(response){
            remotes[response] = {}
            remotes[response]['id'] = response
            remotes[response]['name'] = name
            remotes[response]['remote_type'] = 1
            remotes[response]['device_id'] = 2
            remotes[response]['device_id'] = 2
            remotes[response]['description '] = ""
            remotes[response]['buttons'] = {}
            populate_remotes(remotes)
        },
        error: function(response){
            console.log("MESSAGE:")
            console.log(response)
        },
    });
}

function delete_remote(remote_id){
    if (!confirm('Are you sure you want to delete this remote?')) return
    var id = remote_id
    $.ajax({
        url:"{{=URL('delete_remote')}}",
        type:'POST',
        data: {'id': id},
        dataType: 'html',
        success: function(remote_id){
            for(var i in button_assignments){
                if(button_assignments[i]['button'].attr('remote_id') == remote_id){
                    button_assignments[i]['button'].html("")
                    button_assignments[i]['button'].attr('remote_id', null)
                    button_assignments[i]['button'].attr('button_id', null)
                }
            }
            delete remotes[remote_id]
            populate_remotes(remotes)
        },
        error: function(response){
            console.log("ERROR:")
            console.log(response)
        },
    });
}

function send(remote_id, button_id){
    if(ws.readyState == 1){
        var remote = remotes[remote_id]
        if(remote == undefined) return false
        var button = remote['buttons'][button_id]
        if(button == undefined) return false
        console.log("Remote: "+remote['name']+" Button: "+button['name'])
        data = {}
        data[remote['remote_type']] = JSON.parse(button['code'])
        ws.send(JSON.stringify(data));
    } else location.reload();
}

function learn(remote_id){
    if(ws.readyState == 1){
        var name = prompt("Enter a name for the new button")
        if(name == null || name == "") return
        data = {}
        data[2] = {}
        data[2]['name'] = name
        data[2]['remote_id'] = remote_id
        ws.send(JSON.stringify(data));
    } else location.reload();
}

function on_message(event){
    data = JSON.parse(event.data)
    if('error' in data) console.log("Error: "+data['error']);
    else add_button(data);
}

function add_button(data){
    remotes[data['remote_id']]['buttons'][data['id']] = data
    var html = '<div id="'+data['id']+'" remote_id="'+data['remote_id']+'" button_id="'+data['id']+'" class="deleteable pickable" >'+data['name']+'</div>'
    $('#tabs-'+data['remote_id']).append(html)
    $("#"+data['id']).draggable({
        helper: "clone",
        revert: false
    });
}

function populate_remotes(remotes){
    $('#tabs-remotes').html("")
    var html = '<ul id="remote_list">'
    for(var i in remotes){
        html += '<li><a href="#tabs-'+i+'">'+remotes[i]['name']+'</a></li>'
    }
    html += "</ul>"
    $('#tabs-remotes').append(html)
    for(var i in remotes){
        html = '<div id="tabs-'+i+'" class="remote_buttons"></div>'
        $('#tabs-remotes').append(html)
        if(remotes[i]['remote_type'] == 1){
            html = '<div id="delete'+i+'" remote_id="'+i+'" class="pickable delete_remote">Delete Remote</div>'
            $('#tabs-'+i).append(html)
            $('#delete'+i).attr('onclick', "delete_remote($(this).attr('remote_id'))")
            html = '<div id="learn'+i+'" remote_id="'+i+'" class="pickable add_button">New Button</div><br><br>'
            $('#tabs-'+i).append(html)
            $('#learn'+i).attr('onclick', "learn($(this).attr('remote_id'))")
        }
        for(var j in remotes[i]['buttons']){
            if(remotes[i]['remote_type'] == 0) var classes = "pickable"
            else var classes = "deleteable pickable"
            html = '<div id="'+j+'" remote_id="'+i+'" button_id="'+j+'" class="'+classes+'">'+remotes[i]['buttons'][j]['name']+'</div>'
            $('#tabs-'+i).append(html)
            $("#"+j).draggable({
                helper: "clone",
                revert: false
            });
        }
    }
    $("#tabs-remotes").tabs();
    $("#tabs-remotes").tabs("destroy");
    $("#tabs-remotes").tabs();
}


var mask1 = 0x00
var mask2 = 0x00


function key_down(e) {
    e.preventDefault();
    console.log(e.keyCode)
    //ctrl+shift+R
    if(e.ctrlKey && e.shiftKey && e.which === 82){
        console.log("Rebooting System!");
        ws.send(JSON.stringify({'reboot':true}));
    }
    if(e.keyCode == 38) mask2 = 255-10;
    else if(e.keyCode == 40) mask2 = 10;
    if(e.keyCode == 37) mask1 = 255-10;
    else if(e.keyCode == 39) mask1 = 10;
    var data = {}
    if(mask1 != 0x00 || mask2 != 0x00){
        data[0] = [0xFD, 0x00, 0x03, 0x00, mask1, mask2, 0x00, 0x00, 0x00]
        ws.send(JSON.stringify(data));
    }
}

function key_up(e) {
    console.log(e.keyCode)
    var data = {}
    if(e.keyCode == 38) mask2 = 0x00;
    else if(e.keyCode == 40) mask2 = 0x00;
    if(e.keyCode == 37) mask1 = 0x00;
    else if(e.keyCode == 39) mask1 = 0x00;
    data[0] = [0xFD, 0x00, 0x03, 0x00, mask1, mask2, 0x00, 0x00, 0x00]
    ws.send(JSON.stringify(data));
}


function load_button(){
    //button_assignments = {}//JSON.parse(localStorage.getItem('button_assignments'));
    //$('#area').html("")
    //$('#area').append('<img id="trashcan" class="trashcan" src="{{=URL('static', 'images/trash_can_icon.png')}}" alt="Trash Can" height="100" width="100">')


    var to_delete = []
    {{for id, button in button_assignments.iteritems():}}
    {{if button['remote_id'] != None and button['remote_id'] not in remotes: continue}}
    var remote_id = {{if button['remote_id']:}} "{{=button['remote_id']}}" {{else:}} null {{pass}}
var button_id = {{if button['button_id']:}} "{{=button['button_id']}}" {{else:}} null {{pass}}
var html = '<div id="button{{=id}}" assignment_id="button{{=id}}'+
    '" remote_id="{{=button['remote_id'] or ""}}" button_id="{{=button['button_id'] or ""}}'+
        '" class="{{=button['classes']}}"></div>'
        $('#area').append(html)
        var new_button = $('#button{{=id}}')
        new_button.html('{{try:}}<div class="button_label">{{=remotes[button['remote_id']]['buttons'][button['button_id']]['name']}}</div>{{except:pass}}')
        new_button.css({ top: {{=button['y']}}, left: {{=button['x']}}, position: 'absolute'});
build_remote_button(new_button)
{{pass}}
for(var i in to_delete){
    console.log(i)
    //delete button_assignments[i]
}
}
