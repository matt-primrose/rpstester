/*
Copyright 2018-2019 Intel Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/** 
* @description A scale tester for RCS.
* @author Matt Primrose
* @version v0.0.1
*/

'use strict';
const fs = require('fs');
const crypto = require('crypto');
const rcsTesterVersion = '0.0.1';
const settings = new Object();
var emulatedClients;
// Execute based on incoming arguments
function run(argv) {
    let args = parseArguments(argv);
    if ((typeof args.url) == 'string') { settings.url = args.url ;}
    if ((typeof args.num) == 'string') { settings.num = parseInt(args.num); }
    if ((args.url == undefined) || (args.num == undefined)){
        consoleHelp();
    }
    if ((typeof settings.url == 'string') && (typeof settings.num == 'number')){
        startTest();
    }
}
function exit(status) { if (status == null) { status = 0; } try { process.exit(status); } catch (e) { } }
function parseArguments(argv) {let r = {};for (let i in argv) {i = parseInt(i);if (argv[i].startsWith('--') == true) {let key = argv[i].substring(2).toLowerCase();let val = true;if (((i + 1) < argv.length) && (argv[i + 1].startsWith('--') == false)) {val = argv[i + 1];}r[key] = val;}}return r;}
function consoleHelp(){
    console.log('RCS Scale Tester ver. ' + rcsTesterVersion);
    console.log('No action specified, use rcstester like this:\r\n');
    console.log('  rcstester --url [wss://server] --num [number]\r\n');
    console.log('  URL      - Server fqdn or IP:port of the RCS.');
    console.log('  NUM      - Number of connections to emulate.');
    exit(1); return;
}

function startTest(){
    emulatedClients = new Object();
    let testfile = JSON.parse(fs.readFileSync(__dirname + '/testmessages.json', 'utf8'));
    for (let x = 0; x < settings.num; x++){
        let test = new Object();
        test = testfile.messages[1];
        test.nonce = generateFWNonce();
        //console.log(test.nonce);
        test.uuid = generateUuid();
        //console.log(test.uuid);
        //console.log(test);
        emulatedClients[test.uuid] = test;
        //console.log(emulatedClients[x]);
    }
    console.log(emulatedClients);
    for (let x in emulatedClients){
        connectToServer(emulatedClients[x], function(resp){
            let guidCheck = false;
            if (emulatedClients[x].uuid == resp.uuid) { guidCheck = true; }
            console.log('Client UUID: ' + resp.uuid + '\n\rStatus: '+ resp.status + '\n\rAction: ' + resp.action + '\n\rRCS Nonce: ' + resp.nonce + '\n\rNonce Verification: '+ nonceCheck(resp.nonce, resp.signature) + '\n\rGuid Check: ' + guidCheck);
        });
    }
}

function nonceCheck(nonce, signature){
    // Need to verify signature, verify the fwNonce matches what was sent and verify the mcNonce matches what is in the signature.
    return true;
}

function connectToServer(message, callback){
    let WebSocket = require('ws');
    let ws = new WebSocket(settings.url);
    ws.on('open', function(){
        // for (let x = 0; x < emulatedClients.length; x++){
        //     if (message.uuid == emulatedClients[x].uuid){
        //         emulatedClients[x].tunnel = ws;
        //         emulatedClients[x].tunnel.send(JSON.stringify(message));
        //     }
        // }
    });
    ws.on('message', function(data){
        let cmd = null;
        try {
            cmd = JSON.parse(data);
        } catch(ex){
            console.log('Unable to parse server response: ' + data);
        }
        if (typeof cmd != 'object') { console.log('Invalid server response: ' + data); }
        if (typeof cmd.errorText == 'string') { console.log('Server error: ' + cmd.errorText); }
        switch (cmd.action){
            case 'acmactivate': {
                // if (callback) { callback(cmd); }
                // for (let x = 0; x < emulatedClients.length; x++){
                //     if (cmd.uuid == emulatedClients[x].uuid){
                //         emulatedClients[x].tunnel.close();
                //     }
                // }
                // break;
            }
            case 'ccmactivate': {
                // if (callback) { callback(cmd); }
                // for (let x = 0; x < emulatedClients.length; x++){
                //     if (cmd.uuid == emulatedClients[x].uuid){
                //         emulatedClients[x].tunnel.close();
                //     }
                // }
                // break;
            }
            default: {
                if (cmd.action) { console.log('Invalid server response, command: ' + cmd.action); }
                if (callback) { callback(cmd); }
                for (let x = 0; x < emulatedClients.length; x++){
                    if (cmd.uuid == emulatedClients[x].uuid){
                        emulatedClients[x].tunnel.close();
                    }
                }
                break;
            }
        }
    });
}

function generateFWNonce(){
    return crypto.randomBytes(20); 
}

function generateUuid(){
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.randomFillSync(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

// Figure out if any arguments were provided, otherwise show help
if (process.argv.length > 2) {
    run(process.argv);
} else {
    consoleHelp();
    exit(2); return;
}