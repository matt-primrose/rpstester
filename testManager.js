/*
Copyright 2018-2020 Intel Corporation

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
'use strict'

const fs = require('fs');
const parseWsman = require('./amt-xml').ParseWsman;
const wma = require('./wsmanMsgAssy');
const wem = require('./wsmanExecMgr');
const utils = require('./utils');
const client = require('./clientClass');
const resultsMgr = require('./testResultMgr');
const WebSocket = require('ws');

// Define Global Variables
let emulatedClients, settings, testResultMgr, wsmanHeader, curWsConnections, maxWsConnections, batchSize, connectionIndex;

/**
 * @description Test Manager Class
 * @param {Object} settings contains settings passed in from the command line
 * @returns {Object} Test Manager class
 */
class TestManager{
    constructor(parentSettings){
        emulatedClients = new Object();
        settings = parentSettings;
        curWsConnections = 0;
        connectionIndex = 1;
        if (settings.batchSize) { batchSize = settings.batchSize; maxWsConnections = settings.batchSize; } else { batchSize = 500; maxWsConnections = 500; }
    }
    /**
     * @description Starts the test run
     */
    startTest(){
        // Load test cases from testmessages.json file
        let testfile = JSON.parse(fs.readFileSync(__dirname + '/testmessages.json', 'utf8'));
        // Initialize the variable that holds the WSMAN Header data
        wsmanHeader = testfile.wsmanTestMessages;
        // Create the test patterns to be run based on the test cases.
        if (settings.verbose == 0) { console.log('Generating Test Client Information...'); }
        let activeTCs = new Array();
        for (let i in testfile.testCases){
            if (testfile.testCases[i].include == true) { activeTCs.push(i); }
        }
        let y = 0;
        for (let x = 0; x < settings.num; x++){
            if (y == activeTCs.length) { y = 0; }
            let c = new client(settings);
            c.createClient(testfile.testCases[activeTCs[y]], x, function(uuid, message){
                emulatedClients[uuid] = message;
            });
            y++;
        }
        testResultMgr = new resultsMgr(settings, activeTCs.length);
        // Evaluate test case information and predict pass/fail results
        testResultMgr.predictResults(emulatedClients, settings.num);
        if (settings.verbose == 0) { console.log('Testing Data Generation Complete.  Starting tests...'); }

        // Launch the connection manager queue for executing tests
        this.connectionManagerQueue();
    }
    /**
     * @description Manages the current queue of connections.  Limits based on settings.batchSize
     */
    connectionManagerQueue(){
        for (let x in emulatedClients){
            if (emulatedClients[x].index < (batchSize * connectionIndex)){
                if (emulatedClients[x].complete == false){
                    if (settings.verbose == 0) { console.log("Running Test Case: " + emulatedClients[x].testCaseName); }
                    if (settings.verbose == 1) { console.log("Starting client: " + x); }
                    this.connectionManagerEx(emulatedClients[x]);
                } 
            } else {
                break;
            }
        }
        connectionIndex++;
    }
    /**
     * @description Checks if there are connections available.
     */
    connectionSlotAvailable(){
        if (curWsConnections == 0){
            return true;
        } else {
            return false;
        }
    }
    /**
     * @description Connections a test case client to the server.  Records results once test case client disconnects
     * @param {Object} client 
     */
    connectionManagerEx(client){
        this.connectToServer(client, function(resp, testComplete, testPass, testCaseName){
            let guidCheck = false;
            if (client.uuid == resp.uuid) { guidCheck = true; }
            testPass = (testPass && guidCheck);
            testResultMgr.recordTestResults(testComplete, testPass, testCaseName, client.expectedResult);
        });
    }
    /**
     * @description Manages the websocket connection to server.
     * @param {Object} message 
     * @param {Function} callback 
     */
    connectToServer(message, callback){
        let ws = new WebSocket(settings.url);
        ws.on('open', function(){
            for (let x in emulatedClients){
                // Sends initial message from test client to server
                if (message.jsonCmds.payload.uuid == emulatedClients[x].jsonCmds.payload.uuid && message.index == emulatedClients[x].index){
                    let ppcMessage = JSON.parse(JSON.stringify(message.jsonCmds));
                    if (settings.verbose == 2) { console.log("---SENDING MESSAGE TO RPS---"); }
                    if (settings.verbose == 2) { console.log(ppcMessage); }
                    ppcMessage.payload = Buffer.from(JSON.stringify(ppcMessage.payload)).toString('base64');
                    ws.send(JSON.stringify(ppcMessage));
                    if (settings.verbose == 2) { console.log("---MESSAGE SENT---"); }
                    emulatedClients[x].tunnel = ws;
                    emulatedClients[x].step = 0;
                    curWsConnections++;
                    if (settings.verbose == 0) { console.log('Connections: ' + curWsConnections + ' of ' + maxWsConnections); }
                }
            }
        });
        // Processes messages back from server
        ws.on('message', function(data){
            if (settings.verbose == 2) { console.log("---RECEIVED MESSAGE FROM RPS---"); }
            let cmd = null;
            let payload = {};
            let uuid = null;
            let wsman = null;
            let authHeader = false;
            let testResult = null;
            // Parse the message
            try {
                cmd = JSON.parse(data);
                if (settings.verbose == 2) { console.log("JSON Msg: \n\r" + JSON.stringify(cmd)); }
            } catch(ex){
                if (settings.verbose == 2) { console.log('Unable to parse server response: ' + data); }
            }
            if (typeof cmd != 'object') { 
                if (settings.verbose == 2) { console.log('Invalid server response: ' + cmd); }
            }
            if (cmd.status !== 'ok') { 
                
            }
            if (cmd.method == 'wsman'){
                // If message contains WSMAN message, parse and process
                // Decode payload from JSON message
                let pl = Buffer.from(cmd.payload, 'base64').toString('utf8');
                if (settings.verbose == 2) { console.log("PAYLOAD Msg: \n\r" + JSON.stringify(pl)); }
                if (settings.verbose == 2) { console.log("---END OF MESSAGE---"); }
                // Split payload up so we can extract important pieces
                payload = pl.split("\r\n");
                // Set flag for getting WSMAN
                let xml = false;
                // Create WSMAN temporary holder
                let xmlHolder = new Array();
                //Parse through Payload and extract important pieces
                for (let x in payload){
                    // Check for Authentication Header
                    if (payload[x].substring(0,14) == "Authorization:"){ 
                        authHeader = true; 
                        if (settings.verbose == 2) { console.log("authHeader: " + authHeader); }
                    }
                    // Grab the UUID for this message
                    if (payload[x].substring(0,5) == "Host:"){ 
                        uuid = payload[x].substring(6,42); 
                        if (settings.verbose == 2) { console.log("Host: " + uuid); }
                    }
                    // Find where WSMAN message begins and extract message parts
                    if (payload[x].substring(0,5) == "<?xml"){ 
                        xml = true; 
                        if (settings.verbose == 2) { console.log("XML Section Found"); }
                    }
                    // Put WSMAN message parts into array
                    if (xml == true){ xmlHolder.push(payload[x]); }
                }
                // Parse the full WSMAN message and turn into an Object
                wsman = parseWsman(xmlHolder.join())
                if (settings.verbose == 2 && xml) { console.log(wsman); }
                for (let x in emulatedClients){
                    if (uuid == utils.getUUID(emulatedClients[x].jsonCmds.payload.uuid)){
                        let wsmanExecMgr = new wem(settings, wsmanHeader);
                        if (settings.verbose == 2) { console.log("authHeader: " + authHeader); }
                        let step = wsmanExecMgr.determineWsmanStep(wsman, authHeader);
                        if (settings.verbose == 1) { console.log("Sending this step to executeWsmanStage: " + step); }
                        wsmanExecMgr.executeWsmanStage(step, emulatedClients[x]);
                    }
                }
            } else {
                let key = cmd.message.substring(7,43);
                if (!(key in emulatedClients)){
                    if (settings.verbose == 2) { console.log("Key not in list of clients"); }
                    for (let x in emulatedClients){
                        if (emulatedClients[x].jsonCmds.payload.uuid == false && emulatedClients[x].complete == false){
                            if (settings.verbose == 2) { console.log("Identified UUID of device: " + x); }
                            key = x;
                        }
                    }
                }
                emulatedClients[key].complete = true;
                emulatedClients[key].tunnel.close();
                let testCaseName = emulatedClients[key].testCaseName;
                if (cmd.method == 'success') { testResult = true; }
                else if (cmd.method == 'error') { testResult = false; }
                else { if (settings.verbose == 0) { console.log('Unhandled server response, command: ' + data); } }
                callback(cmd, emulatedClients[key].complete, testResult, testCaseName);
            }
        });
        // Handles WebSocket errors
        ws.on('error', function(err){
            if (settings.verbose == 0) { console.log('Server error received: ' + err); }
        });
        let csa = this.connectionSlotAvailable.bind();
        let cmq = this.connectionManagerQueue.bind();
        ws.on('close', function(){
            curWsConnections--;
            if (settings.verbose == 0) { console.log('Connections: ' + curWsConnections + ' of ' + maxWsConnections); }
            if (csa()){
                if (settings.verbose == 1) { console.log('running CMQ'); }
                cmq();
            }
            if (curWsConnections == 0) {
                testResultMgr.processTestResults();
            }
        });
    }
}
module.exports = TestManager;