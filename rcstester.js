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
let emulatedClients;
let completedTests;
let requestedTests;
let failedTests;
let passedTests;
let numTestPatterns;
let acmTests;
let ccmTests;
let expectedFailedTests;
let expectedPassedTests;
// Execute based on incoming arguments
function run(argv) {
    let args = parseArguments(argv);
    if ((typeof args.url) == 'string') { settings.url = args.url ;}
    if ((typeof args.num) == 'string') { settings.num = parseInt(args.num); }
    if ((args.url == undefined) || (args.num == undefined)){
        consoleHelp();
    }
    if ((settings.num === 16992) || (settings.num === 16993)){ oamtct(); exit(0); }
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
    completedTests = 0;
    failedTests = 0;
    passedTests = 0;
    acmTests = 0;
    ccmTests = 0;
    expectedFailedTests = 0;
    expectedPassedTests = 0;
    requestedTests = settings.num;
    let testfile = JSON.parse(fs.readFileSync(__dirname + '/testmessages.json', 'utf8'));
    predictResults(testfile.messages, settings.num);
    let testPattern = 0;
    numTestPatterns = testfile.messages.length;
    for (let x = 0; x < settings.num; x++){
        if (testPattern == numTestPatterns){ testPattern = 0; }
        generateTestClientInformation(testfile.messages[testPattern], function(uuid, message){
            emulatedClients[uuid] = message;
        });
        testPattern++;
    }
    for (let x in emulatedClients){
        connectToServer(emulatedClients[x], function(resp, testComplete, testPass, testType){
            let guidCheck = false;
            let verifyNonce = nonceCheck(resp.nonce, resp.signature);
            if (emulatedClients[x].uuid == resp.uuid) { guidCheck = true; }
            testPass = (testPass && guidCheck && verifyNonce);
            recordTestResults(testComplete, testPass, testType);
            if (completedTests == requestedTests) {
                processTestResults(requestedTests, completedTests, acmTests, ccmTests);
            }
        });
    }
}

function generateTestClientInformation(testMessage, callback){
    let message = new Object();
    message.client = testMessage.client;
    message.action = testMessage.action;
    message.profile = testMessage.profile;
    message.fqdn = testMessage.fqdn;
    message.realm = testMessage.realm;
    message.hashes = testMessage.hashes;
    message.ver = testMessage.ver;
    message.modes = testMessage.modes;
    message.currentMode = testMessage.currentMode;
    message.nonce = generateFWNonce();
    message.uuid = generateUuid();
    callback(message.uuid, message);
}

function nonceCheck(nonce, signature){
    // Need to verify signature, verify the fwNonce matches what was sent and verify the mcNonce matches what is in the signature.
    return true;
}

function connectToServer(message, callback){
    let WebSocket = require('ws');
    let ws = new WebSocket(settings.url);
    ws.on('open', function(){
        for (let x in emulatedClients){
            if (message.uuid == emulatedClients[x].uuid){
                ws.send(JSON.stringify(message));
                emulatedClients[x].tunnel = ws;
            }
        }
    });
    ws.on('message', function(data){
        let cmd = null;
        try {
            cmd = JSON.parse(data);
        } catch(ex){
            console.log('Unable to parse server response: ' + data);
        }
        if (typeof cmd != 'object') { 
            console.log('Invalid server response: ' + cmd); 
        }
        if (typeof cmd.errorText == 'string') { 
            //console.log('Server error: ' + cmd.errorText); 
            callback(cmd, true, false, null);
            if (emulatedClients[cmd.uuid]){
                emulatedClients[cmd.uuid].tunnel.close();
            }
        }
        switch (cmd.action){
            case 'acmactivate': {
                if (callback) { callback(cmd); }
                for (let x in emulatedClients){
                    if (cmd.uuid == emulatedClients[x].uuid){
                        let response = {client:'meshcmd', version: 1, uuid: emulatedClients[x].uuid, action: 'acmactivate-success'};
                        emulatedClients[x].tunnel.send(JSON.stringify(response));
                        emulatedClients[x].tunnel.close();
                        callback(cmd, true, true, 'acm');
                    }
                }
                break;
            }
            case 'ccmactivate': {
                if (callback) { callback(cmd); }
                for (let x in emulatedClients){
                    if (cmd.uuid == emulatedClients[x].uuid){
                        let response = {client:'meshcmd', version: 1, uuid: emulatedClients[x].uuid, action: 'ccmactivate-success'};
                        emulatedClients[x].tunnel.send(JSON.stringify(response));
                        emulatedClients[x].tunnel.close();
                        callback(cmd, true, true, 'ccm');
                    }
                }
                break;
            }
            default: {
                if (cmd.action) { 
                    console.log('Unhandled server response, command: ' + cmd.action); 
                }
                if (callback) { callback(cmd); }
                for (let x in emulatedClients){
                    if (cmd.uuid == emulatedClients[x].uuid){
                        emulatedClients[x].tunnel.close();
                    }
                }
                break;
            }
        }
    });
    ws.on('error', function(err){
        console.log('Server error received: ' + err);
    });
}

function generateFWNonce(){
    return crypto.randomBytes(20); 
}

function generateUuid(){
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.randomFillSync(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

function recordTestResults(testComplete, testPass, testType){
    if (testComplete == true) { completedTests++ ;}
    if (testPass == true) { passedTests++; }
    if (testPass == false) { failedTests++; }
    if (testType == 'acm') { acmTests++; }
    if (testType == 'ccm') { ccmTests++; }
}

function processTestResults(requestedTests, completedTests, acmTests, ccmTests){
    let red = "\x1b[31m";
    let white = "\x1b[37m";
    let green = "\x1b[32m";
    let result;
    let successfulResults;
    let unsuccessfulResults;
    if (expectedPassedTests == (acmTests + ccmTests)) { successfulResults = green;} else { successfulResults = red;}
    if (expectedFailedTests == (completedTests - (acmTests + ccmTests))) { unsuccessfulResults = green;} else { unsuccessfulResults = red;}
    if ((successfulResults == green) && (unsuccessfulResults == green)) { result = green; } else { result = red; };
    console.log(result,"Test run complete!");
    console.log(white,'Test Configurations Run:   ' + numTestPatterns);
    console.log(white,'Tests requested:           ' + requestedTests);
    console.log(white,'Expected successful:       ' + expectedPassedTests);
    console.log(successfulResults,'Successful results:        ' + (acmTests + ccmTests));
    console.log(white,'Expected unsuccessful:     ' + expectedFailedTests);
    console.log(unsuccessfulResults,'Unsuccessful results:      ' + (completedTests - (acmTests + ccmTests)));
    console.log(white,'ACM tests ran:             ' + acmTests);
    console.log(white,'CCM tests ran:             ' + ccmTests);
}

function predictResults(testMessages, iterations){
    let y = 0;
    for (let x = 0; x < iterations; x++){
        if (y == testMessages.length) { y = 0; }
        if (testMessages[y].expectedResult == 'pass') { expectedPassedTests++; }
        if (testMessages[y].expectedResult == 'fail') { expectedFailedTests++; }
        y++
    }
}

function oamtct(){
    console.log('Open AMT Cloud Toolkit - Remote Configuration Service Scale Testing Tool.');
    console.log('Developed by Retail, Banking, Hospitality, and Education Transactional Team.');
    console.log('Part of Intel(r) IOTG');
}

// Figure out if any arguments were provided, otherwise show help
if (process.argv.length > 2) {
    run(process.argv);
} else {
    consoleHelp();
    exit(2); return;
}