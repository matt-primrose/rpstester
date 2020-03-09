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
const parseWsman = require('./amt-xml').ParseWsman;
const rcsTesterVersion = '0.0.1';
const settings = new Object();
let emulatedClients;
let completedTests;
let requestedTests;
let failedTests;
let passedTests;
let numTestPatterns;
let failedTestCaseNames;
let acmTests;
let ccmTests;
let expectedFailedTests;
let expectedPassedTests;
let maxWsConnections = 500;
let curWsConnections = 0;
let batchSize = 500;
let connectionIndex = 1;
let wsmanHeader;

// Execute based on incoming arguments
function run(argv) {
    let args = parseArguments(argv);
    if ((typeof args.url) == 'string') { settings.url = args.url; }
    if ((typeof args.num) == 'string') { settings.num = parseInt(args.num); }
    if ((typeof args.verbose) == 'string') { settings.verbose = (args.verbose.toLowerCase() == "true"); }
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
    oamtct();
    console.log('RCS Scale Tester ver. ' + rcsTesterVersion);
    console.log('No action specified, use rcstester like this:\r\n');
    console.log('  rcstester --url [wss://server] --num [number]\r\n');
    console.log('  URL      - Server fqdn or IP:port of the RCS.');
    console.log('  NUM      - Number of connections to emulate.');
    console.log('  VERBOSE  - Verbose logging to console.');
    exit(1); return;
}

function startTest(){
    emulatedClients = new Object();
    completedTests = 0;
    failedTests = 0;
    failedTestCaseNames = new Array();
    passedTests = 0;
    acmTests = 0;
    ccmTests = 0;
    expectedFailedTests = 0;
    expectedPassedTests = 0;

    requestedTests = settings.num;
    let testfile = JSON.parse(fs.readFileSync(__dirname + '/testmessages.json', 'utf8'));
    predictResults(testfile.testCases, settings.num);
    wsmanHeader = testfile.wsmanTestMessages;
    let testPattern = 0;
    numTestPatterns = (settings.num > testfile.testCases.length ? testfile.testCases.length : settings.num);
    console.log('Generating Test Client Information...');
    for (let x = 0; x < settings.num; x++){
        if (testPattern == numTestPatterns){ testPattern = 0; }
        generateTestClientInformation(testfile.testCases[testPattern], x, function(uuid, message){
            emulatedClients[uuid] = message;
        });
        testPattern++;
    }
    console.log('Testing Data Generation Complete.  Starting tests...');
    connectionManagerQueue();
}

function connectionManagerQueue(){
    for (let x in emulatedClients){
        if (emulatedClients[x].index < (batchSize * connectionIndex)){
            if (emulatedClients[x].complete == false){
                connectionManagerEx(emulatedClients[x]);
            } 
        } else {
            break;
        }
    }
    connectionIndex++;
}

function connectionSlotAvailable(){
    if (curWsConnections == 0){
        return true;
    } else {
        return false;
    }
}

function connectionManagerEx(client){
    connectToServer(client, function(resp, testComplete, testPass, testType, testCaseName){
        let guidCheck = false;
        if (client.uuid == resp.uuid) { guidCheck = true; }
        testPass = (testPass && guidCheck);
        recordTestResults(testComplete, testPass, testType, testCaseName, client.expectedResult);
        if (completedTests == requestedTests) {
            processTestResults(requestedTests, acmTests, ccmTests, passedTests, failedTests);
        }
    });
}

function generateTestClientInformation(testMessage, index, callback){
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
    message.jsonCmds.payload.password = generateOSAdminPassword();
    message.jsonCmds.payload.profile = testMessage.jsonCmds.payload.profile;
    message.jsonCmds.payload.sku = testMessage.jsonCmds.payload.sku;
    message.jsonCmds.payload.username = testMessage.jsonCmds.payload.username;
    message.jsonCmds.payload.uuid = generateUuid();
    message.jsonCmds.payload.ver = testMessage.jsonCmds.payload.ver;
    message.wsmanCmds = new Object();
    message.wsmanCmds.hostBasedSetupServiceResponse = new Object();
    message.wsmanCmds.hostBasedSetupServiceResponse.allowedControlModes = testMessage.wsmanCmds.hostBasedSetupServiceResponse.allowedControlModes;
    message.wsmanCmds.hostBasedSetupServiceResponse.certChainStatus = testMessage.wsmanCmds.hostBasedSetupServiceResponse.certChainStatus;
    message.wsmanCmds.hostBasedSetupServiceResponse.configurationNonce = generateFWNonce(20);
    message.wsmanCmds.hostBasedSetupServiceResponse.currentControlMode = testMessage.wsmanCmds.hostBasedSetupServiceResponse.currentControlMode;
    message.wsmanCmds.certInjectionResponse = new Object();
    message.wsmanCmds.certInjectionResponse.returnValue = testMessage.wsmanCmds.certInjectionResponse.returnValue;
    message.wsmanCmds.adminSetupResponse = new Object();
    message.wsmanCmds.adminSetupResponse.returnValue = testMessage.wsmanCmds.adminSetupResponse.returnValue;
    callback(getUUID(message.jsonCmds.payload.uuid), message);
}

function connectToServer(message, callback){
    let WebSocket = require('ws');
    let ws = new WebSocket(settings.url);
    ws.on('open', function(){
        for (let x in emulatedClients){
            if (message.jsonCmds.payload.uuid == emulatedClients[x].jsonCmds.payload.uuid){
                let ppcMessage = JSON.parse(JSON.stringify(message.jsonCmds));
                if (settings.verbose) { console.log("---SENDING MESSAGE TO RPS---"); }
                if (settings.verbose) { console.log(ppcMessage); }
                ppcMessage.payload = Buffer.from(JSON.stringify(ppcMessage.payload)).toString('base64');
                ws.send(JSON.stringify(ppcMessage));
                if (settings.verbose) { console.log("---MESSAGE SENT---"); }
                emulatedClients[x].tunnel = ws;
                emulatedClients[x].step = 0;
                curWsConnections++;
                console.log('Connections: ' + curWsConnections + ' of ' + maxWsConnections);
            }
        }
    });
    ws.on('message', function(data){
        if (settings.verbose) { console.log("---RECEIVED MESSAGE FROM RPS---"); }
        let cmd = null;
        let payload = {};
        let uuid = null;
        let wsman = null;
        let authHeader = false;
        try {
            cmd = JSON.parse(data);
            if (settings.verbose) { console.log("JSON Msg: \n\r" + JSON.stringify(cmd)); }
        } catch(ex){
            if (settings.verbose) { console.log('Unable to parse server response: ' + data); }
        }
        if (typeof cmd != 'object') { 
            if (settings.verbose) { console.log('Invalid server response: ' + cmd); }
        }
        if (cmd.status !== 'ok') { 
            
        }
        switch (cmd.method){
            case 'wsman': {
                // Decode payload from JSON message
                let pl = Buffer.from(cmd.payload, 'base64').toString('utf8');
                if (settings.verbose) { console.log("PAYLOAD Msg: \n\r" + JSON.stringify(pl)); }
                if (settings.verbose) { console.log("---END OF MESSAGE---"); }
                //console.log(pl);
                // Split payload up so we can extract important pieces
                payload = pl.split("\r\n");
                //console.log(payload);
                // Set flag for getting WSMAN
                let xml = false;
                // Create WSMAN temporary holder
                let xmlHolder = new Array();
                //Parse through Payload and extract important pieces
                for (let x in payload){
                    // Check for Authentication Header
                    if (payload[x].substring(0,14) == "Authorization:"){ authHeader = true; }
                    // Grab the UUID for this message
                    if (payload[x].substring(0,5) == "Host:"){ uuid = payload[x].substring(6,42); }
                    // Find where WSMAN message begins and extract message parts
                    if (payload[x].substring(0,5) == "<?xml"){ xml = true; }
                    // Put WSMAN message parts into array
                    if (xml == true){ xmlHolder.push(payload[x]); }
                }
                wsman = parseWsman(xmlHolder.join())
                console.log(wsman);
                let wsmanMessage, header, combinedMessage, payloadB64, response;
                for (let x in emulatedClients){
                    if (uuid == getUUID(emulatedClients[x].jsonCmds.payload.uuid)){
                        switch (emulatedClients[x].step){
                            case 0: //General Settings with no Authentication WSMan message from RPS
                            if (settings.verbose) { console.log("Step 0 - Start"); }
                                emulatedClients[x].messageId = generateMessageId(0);
                                emulatedClients[x].digestRealm = generateDigestRealm();
                                emulatedClients[x].step++;
                                wsmanMessage = createWsmanMessage(0);
                                header = createHeader(wsmanHeader.header.status.unauthorized, wsmanHeader.header.digestAuth, wsmanHeader.header.contentType[0], wsmanHeader.header.server, wsmanMessage.length, wsmanHeader.header.connection, null, null);
                                combinedMessage = header + wsmanMessage.wsman;
                                if (settings.verbose) { console.log("---SENDING MESSAGE TO RPS---"); }
                                if (settings.verbose) { console.log("WSMan Payload: \n\r" + combinedMessage); }
                                payloadB64 = Buffer.from(combinedMessage).toString('base64');
                                response = {"apiKey": emulatedClients[x].jsonCmds.apiKey,"appVersion":emulatedClients[x].jsonCmds.appVersion,"message":emulatedClients[x].jsonCmds.message,"method":"response","payload":payloadB64,"protocolVersion":emulatedClients[x].jsonCmds.protocolVersion,"status":emulatedClients[x].jsonCmds.status};
                                if (settings.verbose) { console.log("Message: \n\r" + JSON.stringify(response)); }
                                emulatedClients[x].tunnel.send(JSON.stringify(response));
                                if (settings.verbose) { console.log("---MESSAGE SENT---"); }
                                if (settings.verbose) { console.log("Step 0 - End"); }
                                break;
                            case 1: //General Settings with Authentication WSMan message from RPS
                                if (settings.verbose) { console.log("Step 1 - Start"); }
                                emulatedClients[x].messageId = generateMessageId(emulatedClients[x].messageId);
                                emulatedClients[x].step++;
                                wsmanMessage = createWsmanMessage(1, emulatedClients[x].messageId, emulatedClients[x].digestRealm);
                                header = createHeader(wsmanHeader.header.status.ok, null, wsmanHeader.header.contentType[1], wsmanHeader.header.server, wsmanMessage.length, null, wsmanHeader.header.xFrameOptions, wsmanHeader.header.encoding);
                                combinedMessage = header + wsmanMessage.wsman;
                                if (settings.verbose) { console.log("---SENDING MESSAGE TO RPS---"); }
                                if (settings.verbose) { console.log("WSMan Payload: \n\r" + combinedMessage); }
                                payload = Buffer.from(combinedMessage).toString('base64');
                                response = {"apiKey": emulatedClients[x].jsonCmds.apiKey,"appVersion":emulatedClients[x].jsonCmds.appVersion,"message":emulatedClients[x].jsonCmds.message,"method":"response","payload":payload,"protocolVersion":emulatedClients[x].jsonCmds.protocolVersion,"status":emulatedClients[x].jsonCmds.status};
                                if (settings.verbose) { console.log("Message: \n\r" + JSON.stringify(response)); }
                                emulatedClients[x].tunnel.send(JSON.stringify(response));
                                if (settings.verbose) { console.log("---MESSAGE SENT---"); }
                                if (settings.verbose) { console.log("Step 1 - End"); }
                                break;
                            case 2: //Host Base Setup Service WSMan message from RPS
                                if (settings.verbose) { console.log("Step 2 - Start"); }
                                emulatedClients[x].messageId = generateMessageId(emulatedClients[x].messageId);
                                emulatedClients[x].step++;
                                emulatedClients[x].fwNonce = generateFWNonce(20);
                                wsmanMessage = createWsmanMessage(2, emulatedClients[x].messageId, null, emulatedClients[x].wsmanCmds.hostBasedSetupServiceResponse.currentControlMode, emulatedClients[x].wsmanCmds.hostBasedSetupServiceResponse.allowedControlModes, emulatedClients[x].wsmanCmds.hostBasedSetupServiceResponse.certChainStatus, emulatedClients[x].fwNonce, null);
                                header = createHeader(wsmanHeader.header.status.ok, null, wsmanHeader.header.contentType[1], wsmanHeader.header.server, wsmanMessage.length, null, wsmanHeader.header.xFrameOptions, wsmanHeader.header.encoding);
                                combinedMessage = header + wsmanMessage.wsman;
                                if (settings.verbose) { console.log("---SENDING MESSAGE TO RPS---"); }
                                if (settings.verbose) { console.log("WSMan Payload: \n\r" + combinedMessage); }
                                payload = Buffer.from(combinedMessage).toString('base64');
                                response = {"apiKey": emulatedClients[x].jsonCmds.apiKey,"appVersion":emulatedClients[x].jsonCmds.appVersion,"message":emulatedClients[x].jsonCmds.message,"method":"response","payload":payload,"protocolVersion":emulatedClients[x].jsonCmds.protocolVersion,"status":emulatedClients[x].jsonCmds.status};
                                if (settings.verbose) { console.log("Message: \n\r" + JSON.stringify(response)); }
                                emulatedClients[x].tunnel.send(JSON.stringify(response));
                                if (settings.verbose) { console.log("---MESSAGE SENT---"); }
                                if (settings.verbose) { console.log("Step 2 - End"); }
                                break;
                            case 3: //Certificate Injection WSMan message from RPS
                                if (settings.verbose) { console.log("Step 3 - Start"); }
                                emulatedClients[x].messageId = generateMessageId(emulatedClients[x].messageId);
                                emulatedClients[x].step++;
                                wsmanMessage = createWsmanMessage(3, emulatedClients[x].messageId, null, null, null, null, null, emulatedClients[x].wsmanCmds.certInjectionResponse.returnValue);
                                header = createHeader(wsmanHeader.header.status.ok, null, wsmanHeader.header.contentType[1], wsmanHeader.header.server, wsmanMessage.length, null, wsmanHeader.header.xFrameOptions, wsmanHeader.header.encoding);
                                combinedMessage = header + wsmanMessage.wsman;
                                if (settings.verbose) { console.log("---SENDING MESSAGE TO RPS---"); }
                                if (settings.verbose) { console.log("WSMan Payload: \n\r" + combinedMessage); }
                                payload = Buffer.from(combinedMessage).toString('base64');
                                response = {"apiKey": emulatedClients[x].jsonCmds.apiKey,"appVersion":emulatedClients[x].jsonCmds.appVersion,"message":emulatedClients[x].jsonCmds.message,"method":"response","payload":payload,"protocolVersion":emulatedClients[x].jsonCmds.protocolVersion,"status":emulatedClients[x].jsonCmds.status};
                                if (settings.verbose) { console.log("Message: \n\r" + JSON.stringify(response)); }
                                emulatedClients[x].tunnel.send(JSON.stringify(response));
                                if (settings.verbose) { console.log("---MESSAGE SENT---"); }
                                if (settings.verbose) { console.log("Step 3 - End"); }
                                break;
                            case 4: //Admin Control Setup WSMan message from RPS
                                if (settings.verbose) { console.log("Step 4 - Start"); }
                                emulatedClients[x].messageId = generateMessageId(emulatedClients[x].messageId);
                                emulatedClients[x].step++;
                                wsmanMessage = createWsmanMessage(4, emulatedClients[x].messageId, null, null, null, null, null, emulatedClients[x].wsmanCmds.adminSetupResponse.returnValue);
                                header = createHeader(wsmanHeader.header.status.ok, null, wsmanHeader.header.contentType[1], wsmanHeader.header.server, wsmanMessage.length, null, wsmanHeader.header.xFrameOptions, wsmanHeader.header.encoding);
                                combinedMessage = header + wsmanMessage.wsman;
                                if (settings.verbose) { console.log("---SENDING MESSAGE TO RPS---"); }
                                if (settings.verbose) { console.log("WSMan Payload: \n\r" + combinedMessage); }
                                payload = Buffer.from(combinedMessage).toString('base64');
                                response = {"apiKey": emulatedClients[x].jsonCmds.apiKey,"appVersion":emulatedClients[x].jsonCmds.appVersion,"message":emulatedClients[x].jsonCmds.message,"method":"response","payload":payload,"protocolVersion":emulatedClients[x].jsonCmds.protocolVersion,"status":emulatedClients[x].jsonCmds.status};
                                if (settings.verbose) { console.log("Message: \n\r" + JSON.stringify(response)); }
                                emulatedClients[x].tunnel.send(JSON.stringify(response));
                                if (settings.verbose) { console.log("---MESSAGE SENT---"); }
                                if (settings.verbose) { console.log("Step 4 - Start"); }
                                break;
                            default:
                                break;
                        }
                    }
                }
                break;
            }
            case 'success': {
                //if(callback) { callback(cmd); }
                emulatedClients[cmd.message.substring(7,43)].complete = true;
                emulatedClients[cmd.message.substring(7,43)].tunnel.close();
                let testCaseName = emulatedClients[cmd.message.substring(7,43)].testCaseName;
                curWsConnections--;
                if (connectionSlotAvailable()){
                    //console.log('running CMQ');
                    connectionManagerQueue();
                }
                console.log('Connections: ' + curWsConnections + ' of ' + maxWsConnections);
                callback(cmd, true, true, null, testCaseName);
                break;
            }
            case 'error': {
                //if(callback) { callback(cmd); }
                emulatedClients[cmd.message.substring(7,43)].complete = true;
                emulatedClients[cmd.message.substring(7,43)].tunnel.close();
                let testCaseName = emulatedClients[cmd.message.substring(7,43)].testCaseName;
                curWsConnections--;
                if (connectionSlotAvailable()){
                    //console.log('running CMQ');
                    connectionManagerQueue();
                }
                console.log('Connections: ' + curWsConnections + ' of ' + maxWsConnections);
                callback(cmd, true, false, null, testCaseName);
                break;
            }
            default: {
                if (cmd.method) { 
                    if (settings.verbose) { console.log('Unhandled server response, command: ' + data); }
                }
                break;
            }
        }
    });
    ws.on('error', function(err){
        if (settings.verbose) { console.log('Server error received: ' + err); }
    });
}

function createWsmanMessage(messageType, messageId, digestRealm, currentControlMode, allowedControlModes, certChainStatus, configurationNonce, returnValue){
    let message = {}
    switch (messageType){
        case 0:
            let unauthorized = '<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01 Transitional//EN\" >\n<html><head><link rel=stylesheet href=/styles.css>\n<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\">\n<title>Intel&reg; Active Management Technology</title></head>\n<body>\n<table class=header>\n<tr><td valign=top nowrap>\n<p class=top1>Intel<font class=r><sup>&reg;</sup></font> Active Management Technology\n<td valign=\"top\"><img src=\"logo.gif\" align=\"right\" alt=\"Intel\">\n</table>\n<br />\n<h2 class=warn>Log on failed. Incorrect user name or password, or user account temporarily locked.</h2>\n\n<p>\n<form METHOD=\"GET\" action=\"index.htm\"><h2><input type=submit value=\"Try again\">\n</h2></form>\n<p>\n\n</body>\n</html>\n';
            message.wsman = unauthorized;
            message.length = unauthorized.length;            
            break;
        case 1:
            //let generalSettingsResponse = '0513\r\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><a:Envelope xmlns:a=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:b=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:c=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:d=\"http://schemas.xmlsoap.org/ws/2005/02/trust\" xmlns:e=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:f=\"http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd\" xmlns:g=\"http://intel.com/wbem/wscim/1/amt-schema/1/AMT_GeneralSettings\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>1</b:RelatesTo><b:Action a:mustUnderstand=\"true\">http://schemas.xmlsoap.org/ws/2004/09/transfer/GetResponse</b:Action><b:MessageID>uuid:'+messageId+'</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/amt-schema/1/AMT_GeneralSettings</c:ResourceURI></a:Header><a:Body><g:AMT_GeneralSettings><g:AMTNetworkEnabled>1</g:AMTNetworkEnabled><g:DDNSPeriodicUpdateInterval>1440</g:DDNSPeriodicUpdateInterval><g:DDNSTTL>900</g:DDNSTTL><g:DDNSUpdateByDHCPServerEnabled>true</g:DDNSUpdateByDHCPServerEnabled><g:DDNSUpdateEnabled>false</g:DDNSUpdateEnabled><g:DHCPv6ConfigurationTimeout>0</g:DHCPv6ConfigurationTimeout><g:DigestRea\r\n030B\r\nlm>'+digestRealm+'</g:DigestRealm><g:DomainName></g:DomainName><g:ElementName>Intel(r) AMT: General Settings</g:ElementName><g:HostName></g:HostName><g:HostOSFQDN></g:HostOSFQDN><g:IdleWakeTimeout>65535</g:IdleWakeTimeout><g:InstanceID>Intel(r) AMT: General Settings</g:InstanceID><g:NetworkInterfaceEnabled>true</g:NetworkInterfaceEnabled><g:PingResponseEnabled>true</g:PingResponseEnabled><g:PowerSource>0</g:PowerSource><g:PreferredAddressFamily>0</g:PreferredAddressFamily><g:PresenceNotificationInterval>0</g:PresenceNotificationInterval><g:PrivacyLevel>0</g:PrivacyLevel><g:RmcpPingResponseEnabled>true</g:RmcpPingResponseEnabled><g:SharedFQDN>true</g:SharedFQDN><g:WsmanOnlyMode>false</g:WsmanOnlyMode></g:AMT_GeneralSettings></a:Body></a:Envelope>\r\n0\r\n\r\n';
            let generalSettingsResponse = '0513\r\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><a:Envelope xmlns:a=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:b=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:c=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:d=\"http://schemas.xmlsoap.org/ws/2005/02/trust\" xmlns:e=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:f=\"http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd\" xmlns:g=\"http://intel.com/wbem/wscim/1/amt-schema/1/AMT_GeneralSettings\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>1</b:RelatesTo><b:Action a:mustUnderstand=\"true\">http://schemas.xmlsoap.org/ws/2004/09/transfer/GetResponse</b:Action><b:MessageID>uuid:'+messageId+'</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/amt-schema/1/AMT_GeneralSettings</c:ResourceURI></a:Header><a:Body><g:AMT_GeneralSettings><g:AMTNetworkEnabled>1</g:AMTNetworkEnabled><g:DDNSPeriodicUpdateInterval>1440</g:DDNSPeriodicUpdateInterval><g:DDNSTTL>900</g:DDNSTTL><g:DDNSUpdateByDHCPServerEnabled>true</g:DDNSUpdateByDHCPServerEnabled><g:DDNSUpdateEnabled>false</g:DDNSUpdateEnabled><g:DHCPv6ConfigurationTimeout>0</g:DHCPv6ConfigurationTimeout><g:DigestRealm>'+digestRealm+'</g:DigestRealm><g:DomainName></g:DomainName><g:ElementName>Intel(r) AMT: General Settings</g:ElementName><g:HostName></g:HostName><g:HostOSFQDN></g:HostOSFQDN><g:IdleWakeTimeout>65535</g:IdleWakeTimeout><g:InstanceID>Intel(r) AMT: General Settings</g:InstanceID><g:NetworkInterfaceEnabled>true</g:NetworkInterfaceEnabled><g:PingResponseEnabled>true</g:PingResponseEnabled><g:PowerSource>0</g:PowerSource><g:PreferredAddressFamily>0</g:PreferredAddressFamily><g:PresenceNotificationInterval>0</g:PresenceNotificationInterval><g:PrivacyLevel>0</g:PrivacyLevel><g:RmcpPingResponseEnabled>true</g:RmcpPingResponseEnabled><g:SharedFQDN>true</g:SharedFQDN><g:WsmanOnlyMode>false</g:WsmanOnlyMode></g:AMT_GeneralSettings></a:Body></a:Envelope>\r\n0\r\n\r\n';
            message.wsman = generalSettingsResponse;
            message.length = generalSettingsResponse.length;
            break;
        case 2:
            //let hostBasedSetupServiceResponse = '0513\r\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><a:Envelope xmlns:a=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:b=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:c=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:d=\"http://schemas.xmlsoap.org/ws/2005/02/trust\" xmlns:e=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:f=\"http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd\" xmlns:g=\"http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService\" xmlns:h=\"http://schemas.dmtf.org/wbem/wscim/1/common\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>2</b:RelatesTo><b:Action a:mustUnderstand=\"true\">http://schemas.xmlsoap.org/ws/2004/09/transfer/GetResponse</b:Action><b:MessageID>uuid:'+messageId+'</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService</c:ResourceURI></a:Header><a:Body><g:IPS_HostBasedSetupService><g:AllowedControlModes>'+allowedControlModes[0]+'</g:AllowedControlModes><g:AllowedControlModes>'+allowedControlModes[1]+'</g:AllowedControlModes><g:CertChainStatus>'+certChainStatus+'</g:CertChainStatus><g:ConfigurationNonce>'+configurationNonce+'</g:ConfigurationNonce><g:CreationClassName>IPS_HostBasedSetupService<\r\n0163\r\n/g:CreationClassName><g:CurrentControlMode>'+currentControlMode+'</g:CurrentControlMode><g:ElementName>Intel(r) AMT Host Based Setup Service</g:ElementName><g:Name>Intel(r) AMT Host Based Setup Service</g:Name><g:SystemCreationClassName>CIM_ComputerSystem</g:SystemCreationClassName><g:SystemName>Intel(r) AMT</g:SystemName></g:IPS_HostBasedSetupService></a:Body></a:Envelope>\r\n0\r\n\r\n';
            let hostBasedSetupServiceResponse = '0513\r\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><a:Envelope xmlns:a=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:b=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:c=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:d=\"http://schemas.xmlsoap.org/ws/2005/02/trust\" xmlns:e=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:f=\"http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd\" xmlns:g=\"http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService\" xmlns:h=\"http://schemas.dmtf.org/wbem/wscim/1/common\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>2</b:RelatesTo><b:Action a:mustUnderstand=\"true\">http://schemas.xmlsoap.org/ws/2004/09/transfer/GetResponse</b:Action><b:MessageID>uuid:'+messageId+'</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService</c:ResourceURI></a:Header><a:Body><g:IPS_HostBasedSetupService><g:AllowedControlModes>'+allowedControlModes[0]+'</g:AllowedControlModes><g:AllowedControlModes>'+allowedControlModes[1]+'</g:AllowedControlModes><g:CertChainStatus>'+certChainStatus+'</g:CertChainStatus><g:ConfigurationNonce>'+configurationNonce+'</g:ConfigurationNonce><g:CreationClassName>IPS_HostBasedSetupService</g:CreationClassName><g:CurrentControlMode>'+currentControlMode+'</g:CurrentControlMode><g:ElementName>Intel(r) AMT Host Based Setup Service</g:ElementName><g:Name>Intel(r) AMT Host Based Setup Service</g:Name><g:SystemCreationClassName>CIM_ComputerSystem</g:SystemCreationClassName><g:SystemName>Intel(r) AMT</g:SystemName></g:IPS_HostBasedSetupService></a:Body></a:Envelope>\r\n0\r\n\r\n';
            message.wsman = hostBasedSetupServiceResponse;
            message.length = hostBasedSetupServiceResponse.length;
            break;
        case 3:
            let certinjectionResponse = '<?xml version="1.0" encoding="UTF-8"?><a:Envelope xmlns:a="http://www.w3.org/2003/05/soap-envelope" xmlns:b="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:c="http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd" xmlns:d="http://schemas.xmlsoap.org/ws/2005/02/trust" xmlns:e="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:f="http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd" xmlns:g="http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>3</b:RelatesTo><b:Action a:mustUnderstand="true">http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/AddNextCertInChainResponse</b:Action><b:MessageID>uuid:00000000-8086-8086-8086-000000000066</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService</c:ResourceURI></a:Header><a:Body><g:AddNextCertInChain_OUTPUT><g:ReturnValue>'+returnValue+'</g:ReturnValue></g:AddNextCertInChain_OUTPUT></a:Body></a:Envelope>';
            message.wsman = certinjectionResponse;
            message.length = certinjectionResponse.length;
            break;
        case 4:
            let adminSetupResponse = '<?xml version="1.0" encoding="UTF-8"?><a:Envelope xmlns:a="http://www.w3.org/2003/05/soap-envelope" xmlns:b="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:c="http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd" xmlns:d="http://schemas.xmlsoap.org/ws/2005/02/trust" xmlns:e="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:f="http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd" xmlns:g="http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>7</b:RelatesTo><b:Action a:mustUnderstand="true">http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/AdminSetupResponse</b:Action><b:MessageID>uuid:00000000-8086-8086-8086-00000000006A</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService</c:ResourceURI></a:Header><a:Body><g:AdminSetup_OUTPUT><g:ReturnValue>'+returnValue+'</g:ReturnValue></g:AdminSetup_OUTPUT></a:Body></a:Envelope>';
            message.wsman = adminSetupResponse;
            message.length = adminSetupResponse.length;
            break;
        default:
            break;
    }
    return message;
}

function createHeader(status, auth, contentType, server, contentLength, connection, xFrame, encoding){
    let header = null;
    if (status !== null) { header = status + "\r\n";}
    if (auth !== null) { header  += auth.auth + 'Digest realm="' + generateDigestRealm() + '", ' + auth.nonce + '"' + generateFWNonce(16) + '", ' + auth.stale + '"false", ' + auth.qop + '"auth"\r\n'; }
    if (contentType !== null) { header  += 'Content-Type: ' +contentType + '\r\n'; }
    if (server !== null) { header  += 'Server: ' + server + '\r\n'; }
    if (contentLength !== null) { header  += 'Content-Length: ' + contentLength + '\r\n'; }
    if (connection !== null) { header  += 'Connection: ' + connection + '\r\n\r\n'; }
    if (xFrame !== null) { header  += 'X-Frame-Options: ' + xFrame + '\r\n'; }
    if (encoding !== null) { header  += 'Transfer-Encoding: ' + encoding + '\r\n\r\n'; }
    return header;
}

function generateFWNonce(length){
    let nonce = crypto.randomBytes(length).toString('hex'); 
    return nonce;
    
}

function generateUuid(){
    const uuidv4 = require('uuid').v4;
    let buf = new Array();
    let amtUuid = uuidv4(null, buf);
    //console.log(amtUuid);
    //console.log(getUUID(amtUuid));
    //let uuid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.randomFillSync(new Uint8Array(1))[0] & 15 >> c / 4));
    return amtUuid;
}

function getUUID(uuid) {
    uuid = Buffer.from(uuid);
    let guid = [
      zeroLeftPad(uuid.readUInt32LE(0).toString(16), 8),
      zeroLeftPad(uuid.readUInt16LE(4).toString(16), 4),
      zeroLeftPad(uuid.readUInt16LE(6).toString(16), 4),
      zeroLeftPad(uuid.readUInt16BE(8).toString(16), 4),
      zeroLeftPad(uuid.slice(10).toString("hex").toLowerCase(), 12)].join("-");

    return guid;
  }

  function zeroLeftPad(str, len) {
    if (len == null && typeof len != "number") {
      return null;
    }
    if (str == null) str = ""; // If null, this is to generate zero leftpad string
    let zlp = "";
    for (var i = 0; i < len - str.length; i++) {
      zlp += "0";
    }
    return zlp + str;
  }

function generateMessageId(previousMessageId){
    return previousMessageId++;
}

function generateDigestRealm(){
    let digestRealm = null;
    digestRealm = 'Digest:'+getRandomHex(4)+'0000000000000000000000000000';
    return digestRealm;
}
function getRandomHex(length){
    let num;
    for (var x = 0; x < length; x++){
        if (x === 0) { num = Math.floor(Math.random() * 15).toString(16); }
        else { num += Math.floor(Math.random() * 15).toString(16); }
    }
    return num;
}

function generateOSAdminPassword(){
    let length = 32;
    let password = '';
    let validChars = "abcdefghijklmnopqrstuvwxyz";
    let validNums = "0123456789";
    let validSpec = "!@#$%^&*()_-+=?.>,<";
    let numLen = Math.floor(Math.random() * length/3) + 1;
    let specLen = Math.floor(Math.random() * length/3) + 1;
    let charLen = length-numLen-specLen;
    for (let x = 0; x < charLen; x++){
        let upper = Math.random() >= 0.5;
        if (upper == true){ password += validChars.charAt(Math.floor(Math.random() * validChars.length)).toUpperCase(); }
        else { password += validChars.charAt(Math.floor(Math.random() * validChars.length)); }
    }
    for (let x = 0; x < specLen; x++){
        password += validSpec.charAt(Math.floor(Math.random() * validSpec.length));
    }
    for (let x = 0; x < numLen; x++){
        password += validNums.charAt(Math.floor(Math.random() * validNums.length));
        password = password.split('').sort(function(){ return 0.5 - Math.random() }).join('');
    }
    return password;
}

function recordTestResults(testComplete, testPass, testType, testCaseName, expectedResult){
    let expectedResultBool = (expectedResult == "pass" ? true : false);
    if (testComplete == true) { completedTests++ ;}
    if (testPass == true) { passedTests++; }
    if (testPass == false) { failedTests++; }
    if (testCaseName !== null && testPass !== expectedResultBool) { failedTestCaseNames.push(testCaseName); }
    if (testType == 'acm') { acmTests++; }
    if (testType == 'ccm') { ccmTests++; }
}

function processTestResults(requestedTests, acmTests, ccmTests, passedTests, failedTests){
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
    console.log(white,'Failing Test Cases:             ' + failedTestCaseNames.toString());
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
    console.log('Open AMT Cloud Toolkit - Remote Provisioning Software Scale Testing Tool.');
}

// Figure out if any arguments were provided, otherwise show help
if (process.argv.length > 2) {
    run(process.argv);
} else {
    consoleHelp();
    exit(2); return;
}