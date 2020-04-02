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
* @description A scale tester for RPS.
* @author Matt Primrose
* @version v0.0.1
*/

'use strict';
const fs = require('fs');
const crypto = require('crypto');
const parseWsman = require('./amt-xml').ParseWsman;
const wsmanMessages = require('./wsmanMessages');
const utils = require('./utils');
const rpsTesterVersion = '0.0.1';
const settings = new Object();
let emulatedClients;
let completedTests;
let requestedTests;
let failedTests;
let passedTests;
let numTestPatterns;
let failedTestCaseNames;
let passingTestCaseNames;
let expectedFailedTests;
let expectedPassedTests;
let maxWsConnections = 500;
let curWsConnections = 0;
let batchSize = 500;
let connectionIndex = 1;
let wsmanHeader;

// Execute based on incoming arguments
function run(argv) {
    // Validate command line parameters
    let args = parseArguments(argv);
    if ((typeof args.url) == 'string') { settings.url = args.url; }
    if ((typeof args.num) == 'string') { settings.num = parseInt(args.num); }
    if ((typeof args.verbose) == 'string') { settings.verbose = parseInt(args.verbose); } else { settings.verbose = 0; }
    if ((typeof args.batchsize) == 'string') { settings.batchSize = parseInt(args.batchsize); }
    if ((args.url == undefined) || (args.num == undefined)){
        consoleHelp();
    }
    if ((typeof settings.url == 'string') && (typeof settings.num == 'number')){
        startTest();
    }
}

// Cleanly exit the application and provide an exit code to STDOUT
function exit(status) { if (status == null) { status = 0; } try { process.exit(status); } catch (e) { } }

// Parse command line arguments when running out of Node.  TODO: Update this to take command line arguments when running out of NPM Start Script
function parseArguments(argv) {let r = {};for (let i in argv) {i = parseInt(i);if (argv[i].startsWith('--') == true) {let key = argv[i].substring(2).toLowerCase();let val = true;if (((i + 1) < argv.length) && (argv[i + 1].startsWith('--') == false)) {val = argv[i + 1];}r[key] = val;}}return r;}

// Present instructions to user if missing required parameters aren't provided at the command line
function consoleHelp(){
    oamtct();
    console.log('RPS Scale Tester ver. ' + rpsTesterVersion);
    console.log('No action specified, use rpstester like this:\r\n');
    console.log('  rpstester --url [wss://server] --num [number] --verbose [number] --batchsize [number]\r\n');
    console.log('  URL        - Server fqdn or IP:port of the RPS.');
    console.log('  NUM        - Number of connections to emulate.');
    console.log('  VERBOSE    - (optional) Verbocity level: 0 = Status only, 1 = Critical messages, 2 = All messages.  Default is 0.');
    console.log('  BATCHSIZE  - (optional) Number of simultaneous connections to the server.  Default is 500.');
    exit(1); return;
}

// Entry point for tester
function startTest(){
    // Initialize global variables for tracking emulated clients and test results
    emulatedClients = new Object();
    completedTests = 0;
    failedTests = 0;
    failedTestCaseNames = new Array();
    passingTestCaseNames = new Array();
    passedTests = 0;
    expectedFailedTests = 0;
    expectedPassedTests = 0;
    if (settings.batchSize) { batchSize = settings.batchSize; maxWsConnections = settings.batchSize; }

    // Load test cases from testmessages.json file
    requestedTests = settings.num;
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
        generateTestClientInformation(testfile.testCases[activeTCs[y]], x, function(uuid, message){
            emulatedClients[uuid] = message;
        });
        y++;
    }
    
    numTestPatterns = (settings.num > emulatedClients.length ? emulatedClients.length : settings.num);
    // Evaluate test case information and predict pass/fail results
    predictResults(emulatedClients, settings.num);
    if (settings.verbose == 0) { console.log('Testing Data Generation Complete.  Starting tests...'); }

    // Launch the connection manager queue for executing tests
    connectionManagerQueue();
}

// Manages the queue of emulated clients.  Also throttles the number of connections based on the hard coded values maxWsConnections & batchSize
function connectionManagerQueue(){
    for (let x in emulatedClients){
        if (emulatedClients[x].index < (batchSize * connectionIndex)){
            if (emulatedClients[x].complete == false){
                if (settings.verbose == 0) { console.log("Running Test Case: " + emulatedClients[x].testCaseName); }
                if (settings.verbose == 1) { console.log("Starting client: " + x); }
                connectionManagerEx(emulatedClients[x]);
            } 
        } else {
            break;
        }
    }
    connectionIndex++;
}

// Checks for available execution slots
function connectionSlotAvailable(){
    if (curWsConnections == 0){
        return true;
    } else {
        return false;
    }
}

// Starts the emulated client connection to server.  Prompts the recording of test results when test complets and test summary when test run completes
function connectionManagerEx(client){
    connectToServer(client, function(resp, testComplete, testPass, testCaseName){
        let guidCheck = false;
        if (client.uuid == resp.uuid) { guidCheck = true; }
        testPass = (testPass && guidCheck);
        recordTestResults(testComplete, testPass, testCaseName, client.expectedResult);
    });
}

// Processes the test client information from the test cases.  Creates global object to hold each test client's data
function generateTestClientInformation(testMessage, index, callback){
    if (testMessage.include) {
        let message = new Object();
        message.complete = false;
        message.index = index;
        message.testCaseName = testMessage.testCaseName;
        message.testCaseDescription = testMessage.testCaseDescription;
        message.expectedResult = testMessage.expectedResult;
        message.jsonCmds = new Object();
        message.jsonCmds.apiKey = testMessage.jsonCmds.apiKey;
        message.jsonCmds.appVersion = testMessage.jsonCmds.appVersion;
        message.jsonCmds.message = testMessage.jsonCmds.message;
        message.jsonCmds.method = testMessage.jsonCmds.method;
        message.jsonCmds.protocolVersion = testMessage.jsonCmds.protocolVersion;
        message.jsonCmds.status = testMessage.jsonCmds.status;
        message.jsonCmds.payload = new Object();
        message.jsonCmds.payload.build = testMessage.jsonCmds.payload.build;
        message.jsonCmds.payload.certHashes = testMessage.jsonCmds.payload.certHashes;
        message.jsonCmds.payload.client = testMessage.jsonCmds.payload.client;
        message.jsonCmds.payload.currentMode = testMessage.jsonCmds.payload.currentMode;
        message.jsonCmds.payload.fqdn = testMessage.jsonCmds.payload.fqdn;
        message.jsonCmds.payload.password = utils.generateOSAdminPassword();
        message.jsonCmds.payload.profile = testMessage.jsonCmds.payload.profile;
        message.jsonCmds.payload.sku = testMessage.jsonCmds.payload.sku;
        message.jsonCmds.payload.username = testMessage.jsonCmds.payload.username;
        if (testMessage.jsonCmds.payload.uuid) { message.jsonCmds.payload.uuid = utils.generateUuid(); } else { message.jsonCmds.payload.uuid = testMessage.jsonCmds.payload.uuid; }
        message.jsonCmds.payload.ver = testMessage.jsonCmds.payload.ver;
        message.wsmanCmds = new Object();
        message.wsmanCmds.hostBasedSetupServiceResponse = new Object();
        message.wsmanCmds.hostBasedSetupServiceResponse.allowedControlModes = testMessage.wsmanCmds.hostBasedSetupServiceResponse.allowedControlModes;
        message.wsmanCmds.hostBasedSetupServiceResponse.certChainStatus = testMessage.wsmanCmds.hostBasedSetupServiceResponse.certChainStatus;
        message.wsmanCmds.hostBasedSetupServiceResponse.configurationNonce = utils.generateNonce(20);
        message.wsmanCmds.hostBasedSetupServiceResponse.currentControlMode = testMessage.wsmanCmds.hostBasedSetupServiceResponse.currentControlMode;
        message.wsmanCmds.hostBasedSetupServiceResponse.messageId = 0;
        message.wsmanCmds.hostBasedSetupServiceResponse.digestRealm = null;
        message.wsmanCmds.certInjectionResponse = new Object();
        message.wsmanCmds.certInjectionResponse.returnValue = testMessage.wsmanCmds.certInjectionResponse.returnValue;
        message.wsmanCmds.adminSetupResponse = new Object();
        message.wsmanCmds.adminSetupResponse.returnValue = testMessage.wsmanCmds.adminSetupResponse.returnValue;
        message.wsmanCmds.setupResponse = new Object();
        message.wsmanCmds.setupResponse.returnValue = testMessage.wsmanCmds.setupResponse.returnValue;
        callback(utils.getUUID((message.jsonCmds.payload.uuid ? message.jsonCmds.payload.uuid : utils.generateUuid())), message);
    }
}

// Handles WebSocket connection and message processing
function connectToServer(message, callback){
    let WebSocket = require('ws');
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
                    if (settings.verbose == 2) { console.log("authHeader: " + authHeader); }
                    let step = determineWsmanStep(wsman, authHeader);
                    if (settings.verbose == 1) { console.log("Sending this step to executeWsmanStage: " + step); }
                    executeWsmanStage(step, emulatedClients[x]);
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
    ws.on('close', function(){
        curWsConnections--;
        if (settings.verbose == 0) { console.log('Connections: ' + curWsConnections + ' of ' + maxWsConnections); }
        if (connectionSlotAvailable()){
            if (settings.verbose == 1) { console.log('running CMQ'); }
            connectionManagerQueue();
        }
        if (curWsConnections == 0) {
            processTestResults(requestedTests, passedTests, failedTests);
        }
    });
}

// Parses the WSMAN object and determines where in the activation flow the emulated client is currently
function determineWsmanStep(wsmanObj, authHeader){
    let stepVal, resourceVal, actionVal;
    if (authHeader == false){ stepVal = 0; }
    else {
        for (var x = 0; x < wsmanResourceUri.length; x++){
            if (settings.verbose == 2) { console.log("wsmanResourceURI: " + wsmanResourceUri[x] + "\n\rwsmanObj.ResourceURI: " + wsmanObj.Header.ResourceURI); }
            if (wsmanResourceUri[x] == wsmanObj.Header.ResourceURI){ resourceVal = x; break; }
        }
        for (var y = 0; y < wsmanAction.length; y++){
            if (settings.verbose == 2) { console.log("wsmanAction: " + wsmanAction[y] + "\n\rwsmanObj.Action: " + wsmanObj.Header.Action); }
            if (wsmanAction[y] == wsmanObj.Header.Action) { actionVal = y; break; }
        }
        stepVal = resourceVal + actionVal + 1;
        if (settings.verbose == 1) { console.log("Step Value: " + stepVal); }
    }
    return stepVal;
}

// Arrays for holding the WSMAN ResourceURI and Action strings for determining the current request from the server
const wsmanResourceUri = ['http://intel.com/wbem/wscim/1/amt-schema/1/AMT_GeneralSettings','http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService',]
const wsmanAction = ['http://schemas.xmlsoap.org/ws/2004/09/transfer/Get','http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/AddNextCertInChain','http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/AdminSetup','http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/Setup'];

// Constructs the emulated PPC message and sends to server based on the current client execution stage
function executeWsmanStage(stage, client){
    client.step = stage;
    let returnValue = null;
    let wsmanMessage, header, combinedMessage, payloadB64, response;
    if (settings.verbose == 1) { console.log("Step " + client.step + " - Start"); }
    client.wsmanCmds.hostBasedSetupServiceResponse.messageId++;
    if (settings.verbose == 1) { console.log("Message ID: " + utils.generateMessageId(client.wsmanCmds.hostBasedSetupServiceResponse.messageId)); }
    if (client.wsmanCmds.hostBasedSetupServiceResponse.digestRealm == null) client.wsmanCmds.hostBasedSetupServiceResponse.digestRealm = utils.generateDigestRealm();
    if (settings.verbose == 1) { console.log("Digest Realm: " + client.wsmanCmds.hostBasedSetupServiceResponse.digestRealm); }
    if (client.step == 3) { returnValue = client.wsmanCmds.certInjectionResponse.returnValue; } 
    if (client.step == 4) { returnValue = client.wsmanCmds.adminSetupResponse.returnValue; }
    if (client.step == 5) { returnValue = client.wsmanCmds.setupResponse.returnValue; }
    if (settings.verbose == 1) { console.log("Return Value: " + returnValue); }
    wsmanMessage = wsmanMessages.createWsmanMessage(client.step, utils.generateMessageId(client.wsmanCmds.hostBasedSetupServiceResponse.messageId), client.wsmanCmds.hostBasedSetupServiceResponse.digestRealm, client.wsmanCmds.hostBasedSetupServiceResponse.currentControlMode, client.wsmanCmds.hostBasedSetupServiceResponse.allowedControlModes, client.wsmanCmds.hostBasedSetupServiceResponse.certChainStatus, client.wsmanCmds.hostBasedSetupServiceResponse.configurationNonce, returnValue);
    // wsmanMessage = createWsmanMessage(client.step, generateMessageId(client.wsmanCmds.hostBasedSetupServiceResponse.messageId), client.wsmanCmds.hostBasedSetupServiceResponse.digestRealm, client.wsmanCmds.hostBasedSetupServiceResponse.currentControlMode, client.wsmanCmds.hostBasedSetupServiceResponse.allowedControlModes, client.wsmanCmds.hostBasedSetupServiceResponse.certChainStatus, client.wsmanCmds.hostBasedSetupServiceResponse.configurationNonce, returnValue);
    let headerInfo = new Object();
    if (client.step == 0){
        headerInfo.status = wsmanHeader.header.status.unauthorized;
        headerInfo.digestAuth = wsmanHeader.header.digestAuth;
        headerInfo.contentType = wsmanHeader.header.contentType[0];
        headerInfo.connection = wsmanHeader.header.connection;
        headerInfo.xFrameOptions = null;
        headerInfo.encoding = null;
    } else {
        headerInfo.status = wsmanHeader.header.status.ok;
        headerInfo.digestAuth = null;
        headerInfo.contentType = wsmanHeader.header.contentType[1];
        headerInfo.connection = null;
        headerInfo.xFrameOptions = wsmanHeader.header.xFrameOptions;
        headerInfo.encoding = wsmanHeader.header.encoding;
    }
    headerInfo.server = wsmanHeader.header.server;
    header = wsmanMessages.createWsmanHeader(headerInfo.status, headerInfo.digestAuth, utils.generateDigestRealm(), utils.generateNonce(16), headerInfo.contentType, headerInfo.server, wsmanMessage.length, headerInfo.connection, headerInfo.xFrameOptions, headerInfo.encoding);
    combinedMessage = header + wsmanMessage.wsman;
    if (settings.verbose == 2) { console.log("---SENDING MESSAGE TO RPS---"); }
    if (settings.verbose == 2) { console.log("WSMan Payload: \n\r" + combinedMessage); }
    payloadB64 = Buffer.from(combinedMessage).toString('base64');
    response = {"apiKey": client.jsonCmds.apiKey,"appVersion":client.jsonCmds.appVersion,"message":client.jsonCmds.message,"method":"response","payload":payloadB64,"protocolVersion":client.jsonCmds.protocolVersion,"status":client.jsonCmds.status};
    if (settings.verbose == 2) { console.log("Message: \n\r" + JSON.stringify(response)); }
    client.tunnel.send(JSON.stringify(response));
    if (settings.verbose == 2) { console.log("---MESSAGE SENT---"); }
    if (settings.verbose == 2) { console.log("Step " + stage + " - End"); }
}

// Records the test results when a test case completes
function recordTestResults(testComplete, testPass, testCaseName, expectedResult){
    let expectedResultBool = (expectedResult == "pass" ? true : false);
    let testPassCheck = (expectedResultBool == testPass);
    if (testComplete == true) { completedTests++ ;}
    if (testPassCheck == true) {
        if (expectedResult == "pass") { passedTests++; } 
        else { failedTests++; }
        if (!passingTestCaseNames.includes(testCaseName)) { passingTestCaseNames.push(testCaseName);}
    } else {
        if (testCaseName !== null) { failedTestCaseNames.push(testCaseName); }
        else { failedTestCaseNames.push("Missing TC Name"); }
    }
}

// Processes all of the test results when the test run completes and summarizes them for the user
function processTestResults(requestedTests, passedTests, failedTests){
    let red = "\x1b[31m";
    let white = "\x1b[37m";
    let green = "\x1b[32m";
    let result;
    let successfulResults;
    let unsuccessfulResults;
    if (expectedPassedTests == passedTests) { successfulResults = green;} else { successfulResults = red;}
    if (expectedFailedTests == failedTests) { unsuccessfulResults = green;} else { unsuccessfulResults = red;}
    if ((successfulResults == green) && (unsuccessfulResults == green)) { result = green; } else { result = red; };
    console.log(result,"Test run complete!");
    console.log(white,'Test Configurations Run:   ' + numTestPatterns);
    console.log(white,'Tests requested:           ' + requestedTests);
    console.log(white,'Expected successful:       ' + expectedPassedTests);
    console.log(successfulResults,'Successful results:        ' + passedTests);
    console.log(white,'Expected unsuccessful:     ' + expectedFailedTests);
    console.log(unsuccessfulResults,'Unsuccessful results:      ' + failedTests);
    console.log(white,'Passing Test Cases:             ' + passingTestCaseNames.toString());
    console.log(white,'Failing Test Cases:             ' + failedTestCaseNames.toString());
}

// Predicts the test results based on the test case information.  Used to determine if test cases acheive the desired state
function predictResults(clients, iterations){
    let y = 0;
    while (y < iterations){
        for (let x in clients){
            if (clients[x].expectedResult == 'pass') { expectedPassedTests++; }
            if (clients[x].expectedResult == 'fail') { expectedFailedTests++; }
            y++;
            if (y == iterations) { break; }
        }
    }
}

function oamtct(){
    console.log('Open AMT Cloud Toolkit - Remote Provisioning Software Scale Testing Tool.');
}

// Figure out if any arguments were provided, otherwise show help
if (process.argv.length > 2) {
    run(process.argv);
} else {
    consoleHelp();
    exit(2); return;
}